//! The Rust twin of `lib/sanstun/peer.js ... 0 ... gso` (single thread): a connected non-blocking std UdpSocket on an
//! epoll loop (as lo's lib/loop.js), GSO send (`UDP_SEGMENT`) and GRO receive (`UDP_GRO`).
//! usage: peer <send|recv> 0 <packets> <size> <my_port> <peer_port> <dir> gso

#[path = "../peer_common.rs"]
mod peer_common;

use peer_common::{encrypt_batch, set_int_opt, write_send_result, Args, Peer, Result, GRO_BUF};
use std::io::ErrorKind;
use std::net::UdpSocket;
use std::os::fd::{AsRawFd, RawFd};
use std::time::{Duration, Instant};

/// A one-socket epoll set: wait() returns once the socket is readable or the timeout passes.
struct Epoll(RawFd);

impl Epoll {
    fn new(fd: RawFd) -> Result<Self> {
        let ep = unsafe { libc::epoll_create1(libc::EPOLL_CLOEXEC) };
        if ep < 0 {
            return Err(std::io::Error::last_os_error().into());
        }
        let mut ev = libc::epoll_event { events: libc::EPOLLIN as u32, u64: fd as u64 };
        if unsafe { libc::epoll_ctl(ep, libc::EPOLL_CTL_ADD, fd, &mut ev) } != 0 {
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

/// Read everything queued: each recv() is one GRO super-datagram.
fn drain(sock: &UdpSocket, peer: &mut Peer, buf: &mut [u8], seg: usize) -> Result<()> {
    loop {
        match sock.recv(buf) {
            Ok(n) => {
                let now = Instant::now();
                peer.on_super(&buf[..n], seg, now, &mut |d| {
                    let _ = sock.send(d);
                });
            }
            Err(e) if e.kind() == ErrorKind::WouldBlock => return Ok(()),
            Err(e) => return Err(e.into()),
        }
    }
}

fn run_recv(args: &Args, mut peer: Peer, sock: UdpSocket) -> Result<()> {
    let ep = Epoll::new(sock.as_raw_fd())?;
    let mut buf = vec![0u8; GRO_BUF];
    let seg = args.seg();
    std::fs::write(args.dir.join("recv.ready"), "1\n")?;
    let start = Instant::now();
    loop {
        if ep.wait(10) {
            drain(&sock, &mut peer, &mut buf, seg)?;
        }
        let now = Instant::now();
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

fn run_send(args: &Args, mut peer: Peer, sock: UdpSocket) -> Result<()> {
    let ep = Epoll::new(sock.as_raw_fd())?;
    let mut buf = vec![0u8; GRO_BUF];
    let (seg, gso_max) = (args.seg(), args.gso_max());
    let send = |d: &[u8]| {
        let _ = sock.send(d);
    };
    super_wait_ready(args)?;
    // handshake
    let t = Instant::now();
    send(&peer.tunnel.initiate_handshake(t).ok_or("no initiation")?);
    while !peer.established {
        if ep.wait(10) {
            drain(&sock, &mut peer, &mut buf, seg)?;
        }
        peer.timers(Instant::now(), &mut |d| send(d));
        if t.elapsed() > Duration::from_secs(10) {
            return Err("handshake timed out".into());
        }
    }
    let mut pt = vec![0x45u8; args.size];
    let mut gbuf = vec![0u8; gso_max * seg];
    let (mut sent, mut eagain) = (0u64, 0u64);
    let start = Instant::now();
    while sent < args.total {
        drain(&sock, &mut peer, &mut buf, seg)?; // the loop.poll(0) of peer.js
        let now = Instant::now();
        let k = gso_max.min((args.total - sent) as usize);
        encrypt_batch(&mut peer.tunnel, &mut pt, &mut gbuf, seg, sent, k, now)?;
        loop {
            match sock.send(&gbuf[..k * seg]) {
                Ok(_) => break,
                Err(e) if e.kind() == ErrorKind::WouldBlock => {
                    eagain += 1;
                    drain(&sock, &mut peer, &mut buf, seg)?;
                }
                Err(e) => return Err(e.into()),
            }
        }
        sent += k as u64;
        peer.timers(now, &mut |d| send(d));
    }
    let ns = start.elapsed().as_nanos();
    // answer anything late (keepalives) for 200 ms, as peer.js
    let t = Instant::now();
    while t.elapsed() < Duration::from_millis(200) {
        if ep.wait(10) {
            drain(&sock, &mut peer, &mut buf, seg)?;
        }
        peer.timers(Instant::now(), &mut |d| send(d));
    }
    write_send_result(args, sent, eagain, ns)
}

fn super_wait_ready(args: &Args) -> Result<()> {
    let ready = args.dir.join("recv.ready");
    let t = Instant::now();
    while !ready.exists() {
        std::thread::sleep(Duration::from_millis(1));
        if t.elapsed() > Duration::from_secs(10) {
            return Err("receiver never got ready".into());
        }
    }
    Ok(())
}

fn main() -> Result<()> {
    let args = Args::parse()?;
    if args.workers != 0 {
        return Err("this peer is single-threaded: workers must be 0 (see peer_offload)".into());
    }
    let peer = Peer::new(&args)?;
    let sock = socket(&args)?;
    match args.role.as_str() {
        "recv" => run_recv(&args, peer, sock),
        "send" => run_send(&args, peer, sock),
        r => Err(format!("role {r}").into()),
    }
}
