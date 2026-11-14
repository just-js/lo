//! lib/sanstun/offload.js in Rust, for comparison: the same a -> b pipeline, ring, batching and checks, with the
//! crypto on pinned worker threads instead of lo cells.
//! usage: offload [workers=2] [packets=1000000] [size=1400] [seqcst|acqrel] [ring=256] [batch=32]
//!
//! The main thread owns both interfaces and tunnels and runs stages A (stamp the packet number, begin_encapsulate),
//! C (receive + begin_decapsulate) and E (commit in order, check the number came back); worker s % workers does B
//! (encrypt) and D (decrypt) for packet s, in order, publishing one counter per stage. Cursors are published once per
//! batch. `seqcst` = SeqCst loads/stores (what lo's Atomics.load/store are), `acqrel` = Acquire/Release (the minimal
//! correct ordering; plain accesses like offload.js's `raw` mode would be undefined behaviour in Rust).
//! workers=0 runs B and D inline. Main pinned to cpu 0, worker k to cpu 1 + k % 3; everything busy-spins.

use sanstun::{
    Committed, Decrypted, Interface, PendingDecapsulate, PendingEncapsulate, Received, ReceivedMessage, TunnelConfig,
};
use std::cell::UnsafeCell;
use std::io::Read;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use zeroize::Zeroizing;

type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

const CAP: usize = 1536;

extern "C" {
    fn sched_setaffinity(pid: i32, size: usize, mask: *const u8) -> i32;
}

fn pin(cpu: usize) {
    let mut mask = [0u8; 128];
    mask[cpu >> 3] |= 1 << (cpu & 7);
    assert_eq!(unsafe { sched_setaffinity(0, mask.len(), mask.as_ptr()) }, 0, "sched_setaffinity");
}

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

/// One ring entry. Access is handed between the main thread and the entry's worker by the stage counters.
#[repr(C, align(64))]
struct Entry {
    enc: UnsafeCell<Option<PendingEncapsulate>>,
    dec: UnsafeCell<Option<PendingDecapsulate>>,
    done: UnsafeCell<Option<Decrypted<RawBuf>>>,
    wire_len: UnsafeCell<usize>,
    enc_rc: UnsafeCell<i32>,
    dec_rc: UnsafeCell<i32>,
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
            enc_rc: UnsafeCell::new(0),
            dec_rc: UnsafeCell::new(0),
            pt: UnsafeCell::new(pt),
            wire: UnsafeCell::new([0; CAP]),
            plain: UnsafeCell::new([0; CAP]),
        }
    }
}

#[repr(align(64))]
struct Line(AtomicU32);
#[repr(align(64))]
struct Line64(AtomicU64);

struct Shared {
    cursor_a: Line,
    cursor_c: Line,
    stop: Line,
    ready: Line,
    done_b: Vec<Line>,
    done_d: Vec<Line>,
    enc_ns: Vec<Line64>,
    dec_ns: Vec<Line64>,
    ring: Vec<Entry>,
    size: usize,
    workers: u32,
    ld: Ordering,
    st: Ordering,
}
unsafe impl Sync for Shared {}

fn worker(sh: &'static Shared, k: usize) {
    pin(1 + k % 3);
    sh.ready.0.fetch_add(1, Ordering::SeqCst);
    let ring = sh.ring.len();
    let (ld, st, kk) = (sh.ld, sh.st, sh.workers);
    let (mut s, mut t) = (k as u32, k as u32);
    let (mut enc_ns, mut dec_ns) = (0u64, 0u64);
    loop {
        let a = sh.cursor_a.0.load(ld);
        if s < a {
            let t0 = Instant::now();
            while s < a {
                let e = &sh.ring[s as usize % ring];
                unsafe {
                    let p = (*e.enc.get()).take().expect("enc slot");
                    match p.encrypt(&(&*e.pt.get())[..sh.size], &mut *e.wire.get()) {
                        Ok(m) => {
                            *e.wire_len.get() = m.len();
                            *e.enc_rc.get() = 0;
                        }
                        Err(_) => *e.enc_rc.get() = 1,
                    }
                }
                s += kk;
            }
            enc_ns += t0.elapsed().as_nanos() as u64;
            sh.done_b[k].0.store(s, st);
        }
        let c = sh.cursor_c.0.load(ld);
        if t < c {
            let t0 = Instant::now();
            while t < c {
                let e = &sh.ring[t as usize % ring];
                unsafe {
                    let p = (*e.dec.get()).take().expect("dec slot");
                    let wire = &(&*e.wire.get())[..*e.wire_len.get()];
                    let plain = RawBuf { ptr: e.plain.get().cast::<u8>(), cap: CAP };
                    *e.done.get() = Some(p.decrypt(wire, plain));
                    *e.dec_rc.get() = 0;
                }
                t += kk;
            }
            dec_ns += t0.elapsed().as_nanos() as u64;
            sh.done_d[k].0.store(t, st);
        }
        if s >= a && t >= c && sh.stop.0.load(ld) != 0 {
            break;
        }
    }
    sh.enc_ns[k].0.store(enc_ns, Ordering::SeqCst);
    sh.dec_ns[k].0.store(dec_ns, Ordering::SeqCst);
}

fn seed() -> Zeroizing<[u8; 32]> {
    let mut s = Zeroizing::new([0u8; 32]);
    std::fs::File::open("/dev/urandom").unwrap().read_exact(&mut s[..]).unwrap();
    s
}

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let arg = |i: usize, d: &str| args.get(i).cloned().unwrap_or_else(|| d.to_string());
    let workers: usize = arg(1, "2").parse()?;
    let total: u32 = arg(2, "1000000").parse()?;
    let size: usize = arg(3, "1400").parse()?;
    let mode = arg(4, "seqcst");
    let ring: usize = arg(5, "256").parse()?;
    let batch: u32 = arg(6, "32").parse()?;
    let (ld, st) = match mode.as_str() {
        "seqcst" => (Ordering::SeqCst, Ordering::SeqCst),
        "acqrel" => (Ordering::Acquire, Ordering::Release),
        m => return Err(format!("mode {m}").into()),
    };
    assert!(workers <= 8 && (4..=1472).contains(&size));

    // two peers and a completed handshake
    let a_addr: SocketAddr = "192.0.2.1:51820".parse()?;
    let b_addr: SocketAddr = "192.0.2.2:51820".parse()?;
    let unix = SystemTime::now().duration_since(UNIX_EPOCH)?;
    let mut a = Interface::new(seed(), Instant::now(), unix);
    let mut b = Interface::new(seed(), Instant::now(), unix);
    let mut ta = a.new_tunnel(b.static_public(), TunnelConfig::default(), Instant::now())?;
    let mut tb = b.new_tunnel(a.static_public(), TunnelConfig::default(), Instant::now())?;
    let init = ta.initiate_handshake(Instant::now()).ok_or("no initiation")?;
    let resp = match b.receive(a_addr, &init, Instant::now())? {
        Received::Message(ReceivedMessage::HandshakeInitiation(i)) => tb.handle_handshake_initiation(i, Instant::now())?,
        r => return Err(format!("{r:?}").into()),
    };
    let keepalive = match a.receive(b_addr, &resp, Instant::now())? {
        Received::Message(ReceivedMessage::HandshakeResponse(r)) => ta.handle_handshake_response(r, Instant::now())?,
        r => return Err(format!("{r:?}").into()),
    };
    let mut tmp = [0u8; 2048];
    match b.receive(a_addr, &keepalive, Instant::now())? {
        Received::Message(ReceivedMessage::TransportData(m)) => {
            let d = tb.begin_decapsulate(m, Instant::now())?.decrypt(&keepalive, &mut tmp[..]);
            assert!(matches!(tb.commit_decapsulate(d, Instant::now())?, Committed::Keepalive));
        }
        r => return Err(format!("{r:?}").into()),
    }

    let line = || Line(AtomicU32::new(0));
    let sh: &'static Shared = Box::leak(Box::new(Shared {
        cursor_a: line(),
        cursor_c: line(),
        stop: line(),
        ready: line(),
        done_b: (0..workers).map(|_| line()).collect(),
        done_d: (0..workers).map(|_| line()).collect(),
        enc_ns: (0..workers).map(|_| Line64(AtomicU64::new(0))).collect(),
        dec_ns: (0..workers).map(|_| Line64(AtomicU64::new(0))).collect(),
        ring: (0..ring).map(|_| Entry::new(size)).collect(),
        size,
        workers: workers as u32,
        ld,
        st,
    }));
    let handles: Vec<_> = (0..workers).map(|k| std::thread::spawn(move || worker(sh, k))).collect();
    while (sh.ready.0.load(Ordering::SeqCst) as usize) < workers {}
    pin(0);

    let entry = |s: u32| &sh.ring[s as usize % ring];
    let ready_b = |s: u32| workers == 0 || sh.done_b[s as usize % workers].0.load(ld) > s;
    let ready_d = |s: u32| workers == 0 || sh.done_d[s as usize % workers].0.load(ld) > s;
    let expect_len = size.div_ceil(16) * 16;
    let (mut sa, mut sc, mut se) = (0u32, 0u32, 0u32);
    let mut busy = 0u128;
    let mut idle_spins = 0u64;
    let start = Instant::now();
    while se < total {
        let t = Instant::now();
        let before = sa + sc + se;
        // A
        let mut n = 0;
        while sa < total && sa - se < ring as u32 && n < batch {
            let e = entry(sa);
            unsafe {
                (&mut *e.pt.get())[..4].copy_from_slice(&sa.to_le_bytes());
                let p = ta.begin_encapsulate(t)?;
                if workers == 0 {
                    let len = p.encrypt(&(&*e.pt.get())[..size], &mut *e.wire.get())?.len();
                    *e.wire_len.get() = len;
                    *e.enc_rc.get() = 0;
                } else {
                    *e.enc.get() = Some(p);
                }
            }
            sa += 1;
            n += 1;
        }
        if n > 0 {
            sh.cursor_a.0.store(sa, st);
        }
        // C
        n = 0;
        while sc < sa && n < batch && ready_b(sc) {
            let e = entry(sc);
            unsafe {
                if *e.enc_rc.get() != 0 {
                    return Err(format!("encrypt failed at {sc}").into());
                }
                let wire = &(&*e.wire.get())[..*e.wire_len.get()];
                let m = match b.receive(a_addr, wire, t)? {
                    Received::Message(ReceivedMessage::TransportData(m)) => m,
                    r => return Err(format!("receive {r:?} at {sc}").into()),
                };
                let p = tb.begin_decapsulate(m, t)?;
                if workers == 0 {
                    let plain = RawBuf { ptr: e.plain.get().cast::<u8>(), cap: CAP };
                    *e.done.get() = Some(p.decrypt(wire, plain));
                } else {
                    *e.dec.get() = Some(p);
                }
            }
            sc += 1;
            n += 1;
        }
        if n > 0 {
            sh.cursor_c.0.store(sc, st);
        }
        // E
        n = 0;
        while se < sc && n < batch && ready_d(se) {
            let e = entry(se);
            unsafe {
                let d = (*e.done.get()).take().ok_or("done slot")?;
                match tb.commit_decapsulate(d, t)? {
                    Committed::Data { len, .. } => {
                        let plain = &*e.plain.get();
                        let number = u32::from_le_bytes([plain[0], plain[1], plain[2], plain[3]]);
                        if len != expect_len || number != se {
                            return Err(format!("packet {se}: len {len} number {number}").into());
                        }
                    }
                    Committed::Keepalive => return Err(format!("keepalive at {se}").into()),
                }
            }
            se += 1;
            n += 1;
        }
        if sa + sc + se != before {
            busy += t.elapsed().as_nanos();
        } else {
            idle_spins += 1;
        }
    }
    let elapsed = start.elapsed().as_nanos() as f64;
    sh.stop.0.store(1, Ordering::SeqCst);
    for h in handles {
        h.join().map_err(|_| "worker panicked")?;
    }
    let ns = elapsed / total as f64;
    let per = total as f64 / workers.max(1) as f64;
    for k in 0..workers {
        let e = sh.enc_ns[k].0.load(Ordering::SeqCst) as f64 / per;
        let d = sh.dec_ns[k].0.load(Ordering::SeqCst) as f64 / per;
        println!(
            "worker {k}: encrypt {e:.0} ns/packet, decrypt {d:.0} ns/packet (busy {:.0}%)",
            100.0 * (e + d) * per / elapsed
        );
    }
    println!(
        "{workers} workers {mode} ring {ring} batch {batch}: {total} x {size} B a->b in {:.0} ms, {ns:.0} ns/packet, \
         {:.2} Gbit/s, {:.3} M packets/s, main busy {:.0} ns/packet ({:.0}%), idle spins {idle_spins}, all {total} checked",
        elapsed / 1e6,
        (size * 8) as f64 / ns,
        1e3 / ns,
        busy as f64 / total as f64,
        100.0 * busy as f64 / elapsed
    );
    Ok(())
}
