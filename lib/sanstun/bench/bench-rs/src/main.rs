//! lib/sanstun/test.js in plain Rust, for comparison with the lo binding: two WireGuard peers in one process, one
//! thread, no sockets. The same handshake, checks and benchmark loop (timed with Instant, i.e. clock_gettime
//! MONOTONIC like lo.hrtime), printed in the same format.
//! usage: sanstun_bench [packets, default 100000] [packet size, default 1400]

use sanstun::{Committed, Error, Event, Interface, Received, ReceivedMessage, Tunnel, TunnelConfig};
use std::hint::black_box;
use std::io::Read;
use std::net::SocketAddr;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use zeroize::Zeroizing;

type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

fn seed() -> Zeroizing<[u8; 32]> {
    let mut s = Zeroizing::new([0u8; 32]);
    std::fs::File::open("/dev/urandom").unwrap().read_exact(&mut s[..]).unwrap();
    s
}

fn hex(b: &[u8]) -> String {
    b.iter().map(|v| format!("{v:02x}")).collect()
}

fn unix() -> Duration {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap()
}

fn events(t: &mut Tunnel) -> Vec<u8> {
    let mut seen = Vec::new();
    while let Some(ev) = t.poll_event() {
        seen.push(match ev {
            Event::SendHandshakeInitiation(_) => 1,
            Event::SendKeepalive(_) => 2,
            Event::Established { .. } => 3,
            Event::ConnectionExpired => 4,
        });
    }
    seen
}

fn data(iface: &mut Interface, from: SocketAddr, d: &[u8]) -> Result<sanstun::TransportData> {
    match iface.receive(from, d, Instant::now())? {
        Received::Message(ReceivedMessage::TransportData(m)) => Ok(m),
        r => Err(format!("expected data, got {r:?}").into()),
    }
}

/// receive + decapsulate + commit; the plaintext length, or None for a keepalive
fn decapsulate(
    iface: &mut Interface,
    t: &mut Tunnel,
    from: SocketAddr,
    d: &[u8],
    plain: &mut [u8],
) -> std::result::Result<Option<usize>, Error> {
    let now = Instant::now();
    let m = match iface.receive(from, d, now)? {
        Received::Message(ReceivedMessage::TransportData(m)) => m,
        _ => return Err(Error::UnexpectedPacket),
    };
    let decrypted = t.begin_decapsulate(m, now)?.decrypt(d, plain);
    match t.commit_decapsulate(decrypted, now)? {
        Committed::Data { len, .. } => Ok(Some(len)),
        Committed::Keepalive => Ok(None),
    }
}

/// encrypt `text` at `from`, receive + decapsulate it at `to`, check it; the datagram
fn send(
    from: &mut Tunnel,
    to_iface: &mut Interface,
    to: &mut Tunnel,
    src: SocketAddr,
    text: &str,
    wire: &mut [u8],
    plain: &mut [u8],
) -> Result<Vec<u8>> {
    let len = from.begin_encapsulate(Instant::now())?.encrypt(text.as_bytes(), wire)?.len();
    let d = wire[..len].to_vec();
    let n = decapsulate(to_iface, to, src, &d, plain)?.ok_or("keepalive")?;
    let got = std::str::from_utf8(&plain[..n])?.trim_end_matches('\0');
    assert_eq!(got, text);
    Ok(d)
}

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let count: usize = args.get(1).map_or(Ok(100_000), |s| s.parse())?;
    let size: usize = args.get(2).map_or(Ok(1400), |s| s.parse())?;
    let a_addr: SocketAddr = "192.0.2.1:51820".parse()?;
    let b_addr: SocketAddr = "192.0.2.2:51820".parse()?;

    let mut a = Interface::new(seed(), Instant::now(), unix());
    let mut b = Interface::new(seed(), Instant::now(), unix());
    println!("a {}", hex(a.static_public().as_bytes()));
    println!("b {}", hex(b.static_public().as_bytes()));
    let mut ta = a.new_tunnel(b.static_public(), TunnelConfig::default(), Instant::now())?;
    let mut tb = b.new_tunnel(a.static_public(), TunnelConfig::default(), Instant::now())?;
    println!("tunnel ids a {} b {}", ta.id(), tb.id());

    // handshake: a -> init -> b -> response -> a -> keepalive -> b
    let t0 = Instant::now();
    let init = ta.initiate_handshake(Instant::now()).ok_or("no initiation")?;
    assert_eq!(init.len(), 148);
    let resp = match b.receive(a_addr, &init, Instant::now())? {
        Received::Message(ReceivedMessage::HandshakeInitiation(i)) => {
            assert_eq!(i.peer_static_public(), a.static_public(), "initiation names a");
            tb.handle_handshake_initiation(i, Instant::now())?
        }
        r => return Err(format!("expected an initiation, got {r:?}").into()),
    };
    assert_eq!(resp.len(), 92);
    let keepalive = match a.receive(b_addr, &resp, Instant::now())? {
        Received::Message(ReceivedMessage::HandshakeResponse(r)) => {
            assert_eq!(r.tunnel_id(), ta.id(), "response routed to a");
            ta.handle_handshake_response(r, Instant::now())?
        }
        r => return Err(format!("expected a response, got {r:?}").into()),
    };
    assert_eq!(keepalive.len(), 32);
    assert_eq!(events(&mut ta), [3], "a established");
    let mut plain = [0u8; 2048];
    assert_eq!(decapsulate(&mut b, &mut tb, a_addr, &keepalive, &mut plain)?, None, "expected a keepalive");
    assert_eq!(events(&mut tb), [3], "b established");
    println!("handshake ok in {} us (3 messages, 2 interfaces)", t0.elapsed().as_micros());

    // data both ways
    let mut wire = [0u8; 2048];
    let d1 = send(&mut ta, &mut b, &mut tb, a_addr, "hello from a", &mut wire, &mut plain)?;
    send(&mut tb, &mut a, &mut ta, b_addr, "hello from b", &mut wire, &mut plain)?;
    println!("data a->b and b->a ok (fused path)");

    // replay, tampering, garbage
    let replay = decapsulate(&mut b, &mut tb, a_addr, &d1, &mut plain);
    assert!(matches!(replay, Err(Error::DuplicateCounter)), "replay gave {replay:?}");
    send(&mut ta, &mut b, &mut tb, a_addr, "another one", &mut wire, &mut plain)?;
    let len = ta.begin_encapsulate(Instant::now())?.encrypt(b"tamper me", &mut wire)?.len();
    let mut bad = wire[..len].to_vec();
    bad[20] ^= 1;
    let tampered = decapsulate(&mut b, &mut tb, a_addr, &bad, &mut plain);
    assert!(matches!(tampered, Err(Error::InvalidAeadTag)), "tampered gave {tampered:?}");
    let junk = b.receive(a_addr, &[7u8; 64], Instant::now());
    assert!(matches!(junk, Err(Error::InvalidPacket)), "junk gave {junk:?}");
    println!("replay DuplicateCounter, tamper InvalidAeadTag, junk InvalidPacket: rejected");

    // split path: in Rust the pending values are plain values, so this is the fused path's calls one by one
    {
        let pending = ta.begin_encapsulate(Instant::now())?;
        let len = pending.encrypt(b"split path", &mut wire)?.len();
        let d = wire[..len].to_vec();
        let m = data(&mut b, a_addr, &d)?;
        let pending = tb.begin_decapsulate(m, Instant::now())?;
        let decrypted = pending.decrypt(&d, &mut plain[..]);
        match tb.commit_decapsulate(decrypted, Instant::now())? {
            Committed::Data { buffer, len } => {
                assert_eq!(std::str::from_utf8(&buffer[..len])?.trim_end_matches('\0'), "split path")
            }
            Committed::Keepalive => return Err("keepalive".into()),
        }
    }
    println!("split path ok");

    // timers
    let deadline = ta.poll_timeout().ok_or("no deadline")?;
    ta.handle_timeout(Instant::now());
    println!(
        "next deadline for a in {:.1} s, events after timeout: {:?}",
        deadline.saturating_duration_since(Instant::now()).as_secs_f64(),
        events(&mut ta)
    );

    // benchmark: encapsulate at a, receive + decapsulate at b
    let pkt = vec![0x45u8; size];
    let mut enc_ns: u128 = 0;
    let mut dec_ns: u128 = 0;
    for i in 0..count {
        let t = Instant::now();
        let len = ta.begin_encapsulate(t)?.encrypt(&pkt, &mut wire)?.len();
        let t1 = Instant::now();
        let m = match b.receive(a_addr, &wire[..len], t1)? {
            Received::Message(ReceivedMessage::TransportData(m)) => m,
            r => return Err(format!("receive {r:?} at {i}").into()),
        };
        let decrypted = tb.begin_decapsulate(m, t1)?.decrypt(&wire[..len], &mut plain[..]);
        match tb.commit_decapsulate(decrypted, t1)? {
            Committed::Data { len, .. } => {
                black_box(len);
            }
            Committed::Keepalive => return Err(format!("keepalive at {i}").into()),
        }
        let t2 = Instant::now();
        enc_ns += (t1 - t).as_nanos();
        dec_ns += (t2 - t1).as_nanos();
    }
    let per = |ns: u128| ns as f64 / count as f64;
    let gbit = |ns: f64| (size * 8) as f64 / ns;
    println!(
        "{count} x {size} B: encapsulate {:.0} ns ({:.2} Gbit/s), receive+decapsulate {:.0} ns ({:.2} Gbit/s), one core",
        per(enc_ns),
        gbit(per(enc_ns)),
        per(dec_ns),
        gbit(per(dec_ns))
    );
    println!("ok");
    Ok(())
}
