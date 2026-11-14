//! Shared by the Rust peers (`peer.rs`: std + epoll, `peer_tokio.rs`: tokio), the Rust twins of lib/sanstun/peer.js
//! with `gso`: same arguments, key exchange through files, handshake over the socket, GSO send at the ciphertext
//! stride, GRO receive split on that stride, sequence numbers checked, results written to `<dir>/<role>.txt`.

use sanstun::{Committed, Event, Interface, Received, ReceivedMessage, Tunnel, TunnelConfig};
use std::io::Read;
use std::net::SocketAddr;
use std::os::fd::RawFd;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use zeroize::Zeroizing;

pub type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

pub const GRO_BUF: usize = 65536;

pub struct Args {
    pub role: String,
    pub workers: usize,
    pub total: u64,
    pub size: usize,
    pub my_port: u16,
    pub peer_port: u16,
    pub dir: PathBuf,
}

impl Args {
    /// `<send|recv> <workers> <packets> <size> <my_port> <peer_port> <dir> gso`, as peer.js
    pub fn parse() -> Result<Self> {
        let a: Vec<String> = std::env::args().collect();
        if a.len() < 8 {
            return Err("usage: <send|recv> <workers> <packets> <size> <my_port> <peer_port> <dir> gso".into());
        }
        if a.get(8).map(String::as_str) != Some("gso") {
            return Err("only the gso variant is implemented".into());
        }
        Ok(Args {
            role: a[1].clone(),
            workers: a[2].parse()?,
            total: a[3].parse()?,
            size: a[4].parse()?,
            my_port: a[5].parse()?,
            peer_port: a[6].parse()?,
            dir: PathBuf::from(&a[7]),
        })
    }

    /// a data message: 16-byte header + payload padded to 16 + 16-byte tag
    pub fn seg(&self) -> usize {
        32 + self.size.div_ceil(16) * 16
    }

    pub fn gso_max(&self) -> usize {
        65507 / self.seg()
    }
}

fn wait_for(path: &Path) -> Result<()> {
    let t = Instant::now();
    while !path.exists() {
        std::thread::sleep(Duration::from_millis(1));
        if t.elapsed() > Duration::from_secs(10) {
            return Err(format!("timeout waiting for {}", path.display()).into());
        }
    }
    Ok(())
}

fn hex(b: &[u8]) -> String {
    b.iter().map(|v| format!("{v:02x}")).collect()
}

fn unhex(s: &str) -> Result<[u8; 32]> {
    let mut k = [0u8; 32];
    for (i, b) in k.iter_mut().enumerate() {
        *b = u8::from_str_radix(s.get(i * 2..i * 2 + 2).ok_or("short key")?, 16)?;
    }
    Ok(k)
}

pub fn set_int_opt(fd: RawFd, level: i32, opt: i32, v: i32) -> Result<()> {
    let rc = unsafe {
        libc::setsockopt(fd, level, opt, &v as *const i32 as *const libc::c_void, std::mem::size_of::<i32>() as u32)
    };
    if rc != 0 {
        return Err(format!("setsockopt {level}/{opt}: {}", std::io::Error::last_os_error()).into());
    }
    Ok(())
}

/// One WireGuard peer: sanstun state plus the receive bookkeeping peer.js keeps.
pub struct Peer {
    pub iface: Interface,
    pub tunnel: Tunnel,
    pub src: SocketAddr,
    pub established: bool,
    pub got: u64,
    pub bad: u64,
    pub control_errors: u64,
    pub first: Option<Instant>,
    pub last: Option<Instant>,
    prev: i64,
    expect_len: usize,
    next_deadline: Instant,
    plain: Vec<u8>,
}

impl Peer {
    /// Interface from a fresh seed, public keys swapped through `<dir>/<role>.pub`, tunnel to the other side.
    pub fn new(args: &Args) -> Result<Self> {
        let mut seed = Zeroizing::new([0u8; 32]);
        std::fs::File::open("/dev/urandom")?.read_exact(&mut seed[..])?;
        let now = Instant::now();
        let mut iface = Interface::new(seed, now, SystemTime::now().duration_since(UNIX_EPOCH)?);
        // write then rename: the other side polls for the file and must never read a half-written key
        let tmp = args.dir.join(format!("{}.pub.tmp", args.role));
        std::fs::write(&tmp, hex(iface.static_public().as_bytes()))?;
        std::fs::rename(&tmp, args.dir.join(format!("{}.pub", args.role)))?;
        let other = args.dir.join(if args.role == "send" { "recv.pub" } else { "send.pub" });
        wait_for(&other)?;
        let peer_pub = unhex(std::fs::read_to_string(&other)?.trim())?;
        let tunnel = iface.new_tunnel(peer_pub.into(), TunnelConfig::default(), now)?;
        Ok(Peer {
            iface,
            tunnel,
            src: SocketAddr::from(([127, 0, 0, 1], args.peer_port)),
            established: false,
            got: 0,
            bad: 0,
            control_errors: 0,
            first: None,
            last: None,
            prev: -1,
            expect_len: args.size.div_ceil(16) * 16,
            next_deadline: now,
            plain: vec![0u8; 2048],
        })
    }

    /// One datagram from the peer; anything sanstun wants sent back goes to `send`.
    pub fn on_datagram(&mut self, d: &[u8], now: Instant, send: &mut impl FnMut(&[u8])) {
        match self.iface.receive(self.src, d, now) {
            Ok(Received::Message(ReceivedMessage::TransportData(m))) => {
                let decrypted = match self.tunnel.begin_decapsulate(m, now) {
                    Ok(p) => p.decrypt(d, &mut self.plain[..]),
                    Err(_) => {
                        self.bad += 1;
                        return;
                    }
                };
                match self.tunnel.commit_decapsulate(decrypted, now) {
                    Ok(Committed::Data { buffer, len }) => {
                        let number = i32::from_le_bytes([buffer[0], buffer[1], buffer[2], buffer[3]]) as i64;
                        self.delivered(number, len, now);
                    }
                    Ok(Committed::Keepalive) => {}
                    Err(_) => self.bad += 1,
                }
            }
            Ok(Received::Message(ReceivedMessage::HandshakeInitiation(m))) => {
                match self.tunnel.handle_handshake_initiation(m, now) {
                    Ok(resp) => send(&resp),
                    Err(_) => self.control_errors += 1,
                }
            }
            Ok(Received::Message(ReceivedMessage::HandshakeResponse(m))) => {
                match self.tunnel.handle_handshake_response(m, now) {
                    Ok(keepalive) => send(&keepalive),
                    Err(_) => self.control_errors += 1,
                }
            }
            Ok(Received::Message(ReceivedMessage::CookieReply(m))) => {
                if self.tunnel.handle_cookie_reply(m, now).is_err() {
                    self.control_errors += 1;
                }
            }
            Ok(Received::SendCookieReply(reply)) => send(&reply),
            Err(_) => self.control_errors += 1,
        }
        self.drain_events(send);
    }

    /// Count a committed data message; numbers only increase: a gap is loss, a step back is reorder/replay.
    pub fn delivered(&mut self, number: i64, len: usize, now: Instant) {
        self.got += 1;
        if len != self.expect_len || number <= self.prev {
            self.bad += 1;
        }
        self.prev = number;
        self.first.get_or_insert(now);
        self.last = Some(now);
    }

    /// A GRO super-datagram: data messages back to back at the `seg` stride (a shorter last piece is handled).
    pub fn on_super(&mut self, buf: &[u8], seg: usize, now: Instant, send: &mut impl FnMut(&[u8])) {
        for chunk in buf.chunks(seg) {
            self.on_datagram(chunk, now, send);
        }
    }

    pub fn drain_events(&mut self, send: &mut impl FnMut(&[u8])) {
        while let Some(ev) = self.tunnel.poll_event() {
            match ev {
                Event::SendHandshakeInitiation(d) | Event::SendKeepalive(d) => send(&d),
                Event::Established { .. } => self.established = true,
                Event::ConnectionExpired => {}
            }
        }
    }

    pub fn timers(&mut self, now: Instant, send: &mut impl FnMut(&[u8])) {
        if now < self.next_deadline {
            return;
        }
        self.tunnel.handle_timeout(now);
        self.drain_events(send);
        let cap = now + Duration::from_secs(1);
        self.next_deadline = self.tunnel.poll_timeout().map_or(cap, |d| d.min(cap));
    }

    pub fn write_recv_result(&self, args: &Args) -> Result<()> {
        let ns = match (self.first, self.last) {
            (Some(f), Some(l)) => l.duration_since(f).as_nanos(),
            _ => 0,
        };
        std::fs::write(args.dir.join("recv.txt"), format!("{} {} {} {}\n", self.got, ns, self.bad, self.control_errors))?;
        Ok(())
    }
}

/// Encrypt `k` packets numbered from `first` back to back into `gbuf` at the `seg` stride.
pub fn encrypt_batch(
    tunnel: &mut Tunnel,
    pt: &mut [u8],
    gbuf: &mut [u8],
    seg: usize,
    first: u64,
    k: usize,
    now: Instant,
) -> Result<()> {
    for i in 0..k {
        pt[..4].copy_from_slice(&((first + i as u64) as i32).to_le_bytes());
        let len = tunnel.begin_encapsulate(now)?.encrypt(pt, &mut gbuf[i * seg..])?.len();
        if len != seg {
            return Err(format!("data message is {len} bytes, expected {seg}").into());
        }
    }
    Ok(())
}

pub fn write_send_result(args: &Args, sent: u64, eagain: u64, ns: u128) -> Result<()> {
    std::fs::write(args.dir.join("send.txt"), format!("{sent} {eagain} {ns}\n"))?;
    Ok(())
}
