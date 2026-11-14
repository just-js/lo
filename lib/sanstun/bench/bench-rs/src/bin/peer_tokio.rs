//! The tokio twin of `lib/sanstun/peer.js ... 0 ... gso` (single thread): a current-thread runtime and a connected
//! tokio UdpSocket, GSO send (`UDP_SEGMENT`) and GRO receive (`UDP_GRO`). Same flow as peer.rs: the receiver awaits
//! readability and then drains with try_recv; the sender drains with try_recv between batches.
//! usage: peer_tokio <send|recv> 0 <packets> <size> <my_port> <peer_port> <dir> gso

#[path = "../peer_common.rs"]
mod peer_common;

use peer_common::{encrypt_batch, set_int_opt, write_send_result, Args, Peer, Result, GRO_BUF};
use std::io::ErrorKind;
use std::os::fd::AsRawFd;
use std::time::{Duration, Instant};
use tokio::net::UdpSocket;
use tokio::time::timeout;

async fn socket(args: &Args) -> Result<UdpSocket> {
    let sock = UdpSocket::bind(("127.0.0.1", args.my_port)).await?;
    sock.connect(("127.0.0.1", args.peer_port)).await?;
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

/// Process everything already queued without awaiting (each try_recv is one GRO super-datagram).
fn drain(sock: &UdpSocket, peer: &mut Peer, buf: &mut [u8], seg: usize) -> Result<()> {
    loop {
        match sock.try_recv(buf) {
            Ok(n) => {
                let now = Instant::now();
                peer.on_super(&buf[..n], seg, now, &mut |d| {
                    let _ = sock.try_send(d);
                });
            }
            Err(e) if e.kind() == ErrorKind::WouldBlock => return Ok(()),
            Err(e) => return Err(e.into()),
        }
    }
}

/// Wait up to `ms` for the socket to become readable, then drain it.
async fn wait_and_drain(sock: &UdpSocket, peer: &mut Peer, buf: &mut [u8], seg: usize, ms: u64) -> Result<()> {
    if let Ok(ready) = timeout(Duration::from_millis(ms), sock.readable()).await {
        ready?;
        drain(sock, peer, buf, seg)?;
    }
    Ok(())
}

async fn run_recv(args: &Args, mut peer: Peer, sock: UdpSocket) -> Result<()> {
    let mut buf = vec![0u8; GRO_BUF];
    let seg = args.seg();
    std::fs::write(args.dir.join("recv.ready"), "1\n")?;
    let start = Instant::now();
    loop {
        wait_and_drain(&sock, &mut peer, &mut buf, seg, 10).await?;
        let now = Instant::now();
        peer.timers(now, &mut |d| {
            let _ = sock.try_send(d);
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

async fn run_send(args: &Args, mut peer: Peer, sock: UdpSocket) -> Result<()> {
    let mut buf = vec![0u8; GRO_BUF];
    let (seg, gso_max) = (args.seg(), args.gso_max());
    let ready = args.dir.join("recv.ready");
    let t = Instant::now();
    while !ready.exists() {
        tokio::time::sleep(Duration::from_millis(1)).await;
        if t.elapsed() > Duration::from_secs(10) {
            return Err("receiver never got ready".into());
        }
    }
    // handshake
    let t = Instant::now();
    sock.send(&peer.tunnel.initiate_handshake(t).ok_or("no initiation")?).await?;
    while !peer.established {
        wait_and_drain(&sock, &mut peer, &mut buf, seg, 10).await?;
        peer.timers(Instant::now(), &mut |d| {
            let _ = sock.try_send(d);
        });
        if t.elapsed() > Duration::from_secs(10) {
            return Err("handshake timed out".into());
        }
    }
    let mut pt = vec![0x45u8; args.size];
    let mut gbuf = vec![0u8; gso_max * seg];
    let (mut sent, eagain) = (0u64, 0u64);
    let start = Instant::now();
    while sent < args.total {
        drain(&sock, &mut peer, &mut buf, seg)?; // the loop.poll(0) of peer.js
        let now = Instant::now();
        let k = gso_max.min((args.total - sent) as usize);
        encrypt_batch(&mut peer.tunnel, &mut pt, &mut gbuf, seg, sent, k, now)?;
        sock.send(&gbuf[..k * seg]).await?; // waits for writability instead of spinning on EAGAIN
        sent += k as u64;
        peer.timers(now, &mut |d| {
            let _ = sock.try_send(d);
        });
    }
    let ns = start.elapsed().as_nanos();
    let t = Instant::now();
    while t.elapsed() < Duration::from_millis(200) {
        wait_and_drain(&sock, &mut peer, &mut buf, seg, 10).await?;
        peer.timers(Instant::now(), &mut |d| {
            let _ = sock.try_send(d);
        });
    }
    write_send_result(args, sent, eagain, ns)
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<()> {
    let args = Args::parse()?;
    if args.workers != 0 {
        return Err("this peer is single-threaded: workers must be 0 (see peer_offload)".into());
    }
    let peer = Peer::new(&args)?;
    let sock = socket(&args).await?;
    match args.role.as_str() {
        "recv" => run_recv(&args, peer, sock).await,
        "send" => run_send(&args, peer, sock).await,
        r => Err(format!("role {r}").into()),
    }
}
