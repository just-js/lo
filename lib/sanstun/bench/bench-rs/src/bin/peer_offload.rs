//! The Rust twin of `lib/sanstun/peer.js <role> <workers> ... gso` with workers > 0: GSO + GRO over UDP with the
//! crypto on worker threads, the same structure as peer.js's offload path:
//! - the main thread owns the Interface and Tunnel and does begin_encapsulate / receive + begin_decapsulate and the
//!   in-order commit; worker k (a pinned std thread) encrypts or decrypts the packets s with s % workers == k
//! - a 256-entry ring, one progress counter per worker per stage on its own cache line, everything busy-spins
//! - sender: one sendmsg() per batch with an iovec over up to GSO_MAX ready entries and UDP_SEGMENT
//! - receiver: recvmsg() scatters a GRO super-datagram straight into GSO_MAX consecutive entries (only read when that
//!   many are free); every segment takes an entry, non-data or failed ones are marked skip for the commit
//! One difference from peer.js, the natural choice here: the iovec table is built once (ring order, with GSO_MAX
//! entries repeated at the end so every window is contiguous), not rebuilt per call.
//! usage: peer_offload <send|recv> <workers> <packets> <size> <my_port> <peer_port> <dir> gso

#[path = "../peer_common.rs"]
#[allow(dead_code)]
mod peer_common;

use peer_common::{set_int_opt, write_send_result, Args, Peer, Result, GRO_BUF};
use sanstun::{Committed, Decrypted, PendingDecapsulate, PendingEncapsulate, Received, ReceivedMessage};
use std::cell::UnsafeCell;
use std::io::ErrorKind;
use std::net::UdpSocket;
use std::os::fd::{AsRawFd, RawFd};
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::{Duration, Instant};

const RING: usize = 256;
const CAP: usize = 1536;

/// The decryption destination: an entry's plain buffer, owned by the ring.
struct RawBuf {
    ptr: *mut u8,
    cap: usize,
}
unsafe impl Send for RawBuf {}
impl AsMut<[u8]> for RawBuf {
    fn as_mut(&mut self) -> &mut [u8] {
        unsafe { std::slice::from_raw_parts_mut(self.ptr, self.cap) }
    }
}

/// One ring entry; the stage counters hand it between the main thread and its worker.
#[repr(C, align(64))]
struct Entry {
    enc: UnsafeCell<Option<PendingEncapsulate>>,
    dec: UnsafeCell<Option<PendingDecapsulate>>,
    done: UnsafeCell<Option<Decrypted<RawBuf>>>,
    wire_len: UnsafeCell<usize>,
    skip: UnsafeCell<bool>,
    failed: UnsafeCell<bool>,
    pt: UnsafeCell<[u8; CAP]>,
    wire: UnsafeCell<[u8; CAP]>,
    plain: UnsafeCell<[u8; CAP]>,
}

impl Entry {
    fn new(size: usize) -> Self {
        let mut pt = [0u8; CAP];
        pt[..size].fill(0x45);
        Entry {
            enc: UnsafeCell::new(None),
            dec: UnsafeCell::new(None),
            done: UnsafeCell::new(None),
            wire_len: UnsafeCell::new(0),
            skip: UnsafeCell::new(false),
            failed: UnsafeCell::new(false),
            pt: UnsafeCell::new(pt),
            wire: UnsafeCell::new([0; CAP]),
            plain: UnsafeCell::new([0; CAP]),
        }
    }
}

#[repr(align(64))]
struct Line(AtomicU32);

struct Shared {
    cursor_a: Line, // packets begun (encapsulate), for the workers
    cursor_c: Line, // packets received + begun (decapsulate), for the workers
    stop: Line,
    ready: Line,
    done_b: Vec<Line>,
    done_d: Vec<Line>,
    ring: Vec<Entry>,
    size: usize,
    workers: u32,
}
unsafe impl Sync for Shared {}

extern "C" {
    fn sched_setaffinity(pid: i32, size: usize, mask: *const u8) -> i32;
}

fn pin(cpu: usize) {
    let mut mask = [0u8; 128];
    mask[cpu >> 3] |= 1 << (cpu & 7);
    unsafe { sched_setaffinity(0, mask.len(), mask.as_ptr()) };
}

fn worker(sh: &'static Shared, k: usize) {
    // not pinned by default, like lo's cells: pinning worker k to the same cpu in both processes put the sender's
    // and the receiver's busy-spinning workers on one core. PEER_PIN=<first cpu> pins worker k to first + k.
    if let Some(first) = std::env::var("PEER_PIN").ok().and_then(|v| v.parse::<usize>().ok()) {
        pin(first + k);
    }
    sh.ready.0.fetch_add(1, Ordering::SeqCst);
    let (kk, mut s, mut t) = (sh.workers, k as u32, k as u32);
    loop {
        let a = sh.cursor_a.0.load(Ordering::SeqCst);
        if s < a {
            while s < a {
                let e = &sh.ring[s as usize % RING];
                unsafe {
                    let p = (*e.enc.get()).take().expect("enc slot");
                    match p.encrypt(&(&*e.pt.get())[..sh.size], &mut *e.wire.get()) {
                        Ok(m) => {
                            *e.wire_len.get() = m.len();
                            *e.failed.get() = false;
                        }
                        Err(_) => *e.failed.get() = true,
                    }
                }
                s += kk;
            }
            sh.done_b[k].0.store(s, Ordering::SeqCst);
        }
        let c = sh.cursor_c.0.load(Ordering::SeqCst);
        if t < c {
            while t < c {
                let e = &sh.ring[t as usize % RING];
                unsafe {
                    if let Some(p) = (*e.dec.get()).take() {
                        let wire = &(&*e.wire.get())[..*e.wire_len.get()];
                        let plain = RawBuf { ptr: e.plain.get().cast::<u8>(), cap: CAP };
                        *e.done.get() = Some(p.decrypt(wire, plain));
                    }
                }
                t += kk;
            }
            sh.done_d[k].0.store(t, Ordering::SeqCst);
        }
        if s >= a && t >= c && sh.stop.0.load(Ordering::SeqCst) != 0 {
            break;
        }
    }
}

/// A one-socket epoll set, as in peer.rs.
struct Epoll(RawFd);
impl Epoll {
    fn new(fd: RawFd) -> Result<Self> {
        let ep = unsafe { libc::epoll_create1(libc::EPOLL_CLOEXEC) };
        let mut ev = libc::epoll_event { events: libc::EPOLLIN as u32, u64: fd as u64 };
        if ep < 0 || unsafe { libc::epoll_ctl(ep, libc::EPOLL_CTL_ADD, fd, &mut ev) } != 0 {
            return Err(std::io::Error::last_os_error().into());
        }
        Ok(Epoll(ep))
    }
    fn wait(&self, timeout_ms: i32) -> bool {
        let mut ev = libc::epoll_event { events: 0, u64: 0 };
        unsafe { libc::epoll_wait(self.0, &mut ev, 1, timeout_ms) > 0 }
    }
}
impl Drop for Epoll {
    fn drop(&mut self) {
        unsafe { libc::close(self.0) };
    }
}

/// The iovec table over the ring's wire buffers, built once: RING entries in ring order plus the first `gso_max`
/// again, so the window of any `gso_max` consecutive entries starting at `s % RING` is contiguous.
fn iov_table(sh: &Shared, seg: usize, gso_max: usize) -> Vec<libc::iovec> {
    (0..RING + gso_max)
        .map(|i| libc::iovec { iov_base: sh.ring[i % RING].wire.get().cast(), iov_len: seg })
        .collect()
}

fn msghdr(iov: *mut libc::iovec, n: usize) -> libc::msghdr {
    let mut m: libc::msghdr = unsafe { std::mem::zeroed() };
    m.msg_iov = iov;
    m.msg_iovlen = n as _;
    m
}

fn socket(args: &Args) -> Result<UdpSocket> {
    let sock = UdpSocket::bind(("127.0.0.1", args.my_port))?;
    sock.connect(("127.0.0.1", args.peer_port))?;
    sock.set_nonblocking(true)?;
    let fd = sock.as_raw_fd();
    if args.role == "recv" {
        set_int_opt(fd, libc::SOL_SOCKET, libc::SO_RCVBUFFORCE, 32 << 20)?;
        set_int_opt(fd, libc::SOL_UDP, libc::UDP_GRO, 1)?;
    } else {
        set_int_opt(fd, libc::SOL_SOCKET, libc::SO_SNDBUFFORCE, 8 << 20)?;
        set_int_opt(fd, libc::SOL_UDP, libc::UDP_SEGMENT, args.seg() as i32)?;
    }
    Ok(sock)
}

/// Handshake and other control messages on the sender (it receives no data): as peer.rs.
fn drain_control(sock: &UdpSocket, peer: &mut Peer, buf: &mut [u8], seg: usize) -> Result<()> {
    loop {
        match sock.recv(buf) {
            Ok(n) => peer.on_super(&buf[..n], seg, Instant::now(), &mut |d| {
                let _ = sock.send(d);
            }),
            Err(e) if e.kind() == ErrorKind::WouldBlock => return Ok(()),
            Err(e) => return Err(e.into()),
        }
    }
}

fn run_send(args: &Args, mut peer: Peer, sock: UdpSocket, sh: &'static Shared) -> Result<()> {
    let (seg, gso_max, workers) = (args.seg(), args.gso_max(), sh.workers);
    let ep = Epoll::new(sock.as_raw_fd())?;
    let mut buf = vec![0u8; GRO_BUF];
    let ready = args.dir.join("recv.ready");
    let t = Instant::now();
    while !ready.exists() {
        std::thread::sleep(Duration::from_millis(1));
        if t.elapsed() > Duration::from_secs(10) {
            return Err("receiver never got ready".into());
        }
    }
    let t = Instant::now();
    let _ = sock.send(&peer.tunnel.initiate_handshake(t).ok_or("no initiation")?);
    while !peer.established {
        if ep.wait(10) {
            drain_control(&sock, &mut peer, &mut buf, seg)?;
        }
        peer.timers(Instant::now(), &mut |d| {
            let _ = sock.send(d);
        });
        if t.elapsed() > Duration::from_secs(10) {
            return Err("handshake timed out".into());
        }
    }
    let mut iov = iov_table(sh, seg, gso_max);
    let ready_b = |s: u32| sh.done_b[(s % workers) as usize].0.load(Ordering::SeqCst) > s;
    let total = args.total as u32;
    let (mut sa, mut ss, mut eagain) = (0u32, 0u32, 0u64);
    let start = Instant::now();
    while ss < total {
        drain_control(&sock, &mut peer, &mut buf, seg)?;
        let now = Instant::now();
        // A: stamp the number, reserve the counter, hand the pending encryption to its worker
        let mut n = 0;
        while sa < total && (sa - ss) < RING as u32 && n < 32 {
            let e = &sh.ring[sa as usize % RING];
            unsafe {
                (&mut *e.pt.get())[..4].copy_from_slice(&(sa as i32).to_le_bytes());
                *e.enc.get() = Some(peer.tunnel.begin_encapsulate(now)?);
            }
            sa += 1;
            n += 1;
        }
        if n > 0 {
            sh.cursor_a.0.store(sa, Ordering::SeqCst);
        }
        // send: one sendmsg over up to gso_max ready entries, in order
        let mut k = 0usize;
        while ss + (k as u32) < sa && k < gso_max && ready_b(ss + k as u32) {
            let e = &sh.ring[(ss as usize + k) % RING];
            unsafe {
                if *e.failed.get() {
                    return Err(format!("encrypt failed at {}", ss as usize + k).into());
                }
            }
            k += 1;
        }
        if k > 0 {
            let m = msghdr(unsafe { iov.as_mut_ptr().add(ss as usize % RING) }, k);
            if unsafe { libc::sendmsg(sock.as_raw_fd(), &m, 0) } < 0 {
                eagain += 1;
            } else {
                ss += k as u32;
            }
        }
        peer.timers(now, &mut |d| {
            let _ = sock.send(d);
        });
    }
    let ns = start.elapsed().as_nanos();
    let t = Instant::now();
    while t.elapsed() < Duration::from_millis(200) {
        if ep.wait(10) {
            drain_control(&sock, &mut peer, &mut buf, seg)?;
        }
        peer.timers(Instant::now(), &mut |d| {
            let _ = sock.send(d);
        });
    }
    write_send_result(args, ss as u64, eagain, ns)
}

fn run_recv(args: &Args, mut peer: Peer, sock: UdpSocket, sh: &'static Shared) -> Result<()> {
    let (seg, gso_max, workers) = (args.seg(), args.gso_max(), sh.workers);
    let ep = Epoll::new(sock.as_raw_fd())?;
    let mut iov = iov_table(sh, seg, gso_max);
    let ready_d = |s: u32| sh.done_d[(s % workers) as usize].0.load(Ordering::SeqCst) > s;
    let fd = sock.as_raw_fd();
    let (mut sc, mut se) = (0u32, 0u32);
    std::fs::write(args.dir.join("recv.ready"), "1\n")?;
    let start = Instant::now();
    loop {
        let inflight = sc > se;
        if !inflight {
            ep.wait(10);
        }
        // receive: scatter a GRO super-datagram into gso_max consecutive entries
        let mut published = false;
        while RING - (sc - se) as usize >= gso_max {
            let mut m = msghdr(unsafe { iov.as_mut_ptr().add(sc as usize % RING) }, gso_max);
            let n = unsafe { libc::recvmsg(fd, &mut m, libc::MSG_DONTWAIT) };
            if n < 0 {
                break;
            }
            let now = Instant::now();
            let mut off = 0usize;
            while off < n as usize {
                let len = seg.min(n as usize - off);
                let e = &sh.ring[sc as usize % RING];
                unsafe {
                    *e.skip.get() = true;
                    let wire = &(&*e.wire.get())[..len];
                    match peer.iface.receive(peer.src, wire, now) {
                        Ok(Received::Message(ReceivedMessage::TransportData(msg))) => {
                            match peer.tunnel.begin_decapsulate(msg, now) {
                                Ok(p) => {
                                    *e.wire_len.get() = len;
                                    *e.dec.get() = Some(p);
                                    *e.skip.get() = false;
                                }
                                Err(_) => peer.bad += 1,
                            }
                        }
                        Ok(Received::Message(ReceivedMessage::HandshakeInitiation(msg))) => {
                            match peer.tunnel.handle_handshake_initiation(msg, now) {
                                Ok(resp) => {
                                    let _ = sock.send(&resp);
                                }
                                Err(_) => peer.control_errors += 1,
                            }
                        }
                        Ok(Received::Message(ReceivedMessage::HandshakeResponse(msg))) => {
                            if let Ok(ka) = peer.tunnel.handle_handshake_response(msg, now) {
                                let _ = sock.send(&ka);
                            }
                        }
                        Ok(Received::Message(ReceivedMessage::CookieReply(msg))) => {
                            let _ = peer.tunnel.handle_cookie_reply(msg, now);
                        }
                        Ok(Received::SendCookieReply(reply)) => {
                            let _ = sock.send(&reply);
                        }
                        Err(_) => peer.control_errors += 1,
                    }
                }
                sc += 1;
                off += len;
            }
            published = true;
        }
        if published {
            sh.cursor_c.0.store(sc, Ordering::SeqCst);
        }
        // commit in order
        let now = Instant::now();
        while se < sc && ready_d(se) {
            let e = &sh.ring[se as usize % RING];
            unsafe {
                if !*e.skip.get() {
                    match (*e.done.get()).take() {
                        Some(d) => match peer.tunnel.commit_decapsulate(d, now) {
                            Ok(Committed::Data { len, .. }) => {
                                let p = &*e.plain.get();
                                let number = i32::from_le_bytes([p[0], p[1], p[2], p[3]]) as i64;
                                peer.delivered(number, len, now);
                            }
                            Ok(Committed::Keepalive) => {}
                            Err(_) => peer.bad += 1,
                        },
                        None => peer.bad += 1,
                    }
                }
            }
            se += 1;
        }
        peer.timers(now, &mut |d| {
            let _ = sock.send(d);
        });
        if peer.got >= args.total {
            break;
        }
        let idle = match peer.last {
            Some(last) => now.duration_since(last) > Duration::from_secs(1),
            None => now.duration_since(start) > Duration::from_secs(30),
        };
        if idle {
            break;
        }
    }
    peer.write_recv_result(args)
}

fn main() -> Result<()> {
    let args = Args::parse()?;
    if args.workers == 0 {
        return Err("peer_offload needs workers > 0 (peer / peer_tokio are the single-threaded peers)".into());
    }
    let peer = Peer::new(&args)?;
    let sock = socket(&args)?;
    let line = || Line(AtomicU32::new(0));
    let sh: &'static Shared = Box::leak(Box::new(Shared {
        cursor_a: line(),
        cursor_c: line(),
        stop: line(),
        ready: line(),
        done_b: (0..args.workers).map(|_| line()).collect(),
        done_d: (0..args.workers).map(|_| line()).collect(),
        ring: (0..RING).map(|_| Entry::new(args.size)).collect(),
        size: args.size,
        workers: args.workers as u32,
    }));
    let handles: Vec<_> = (0..args.workers).map(|k| std::thread::spawn(move || worker(sh, k))).collect();
    while (sh.ready.0.load(Ordering::SeqCst) as usize) < args.workers {}
    let r = match args.role.as_str() {
        "recv" => run_recv(&args, peer, sock, sh),
        "send" => run_send(&args, peer, sock, sh),
        r => Err(format!("role {r}").into()),
    };
    sh.stop.0.store(1, Ordering::SeqCst);
    for h in handles {
        let _ = h.join();
    }
    r
}
