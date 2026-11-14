//! A C ABI over sanstun (sans-IO WireGuard), for lo's lib/sanstun binding. sanstun.h is the contract.
//!
//! - Time is u64 nanoseconds of a monotonic clock. Each interface keeps the Instant it was created at and that
//!   nanosecond value; its tunnels share them. Deadlines come back in the same units, ST_NEVER (u64::MAX) = none.
//! - Nothing is allocated across the boundary: handshake, cookie and keepalive datagrams (at most ST_DATAGRAM_MAX
//!   bytes) are copied into caller buffers, and parsed messages, pending encryptions/decryptions and decryption
//!   results live in ST_SLOT_SIZE-byte slots in caller memory (8-byte aligned, zeroed = empty).
//! - Errors are negative: -1..-15 are sanstun::Error, -20 and below the shim's own.
//! - Panics abort (profile panic = "abort").

use sanstun::{
    Committed, Decrypted, Error, Event, Interface, PendingDecapsulate, PendingEncapsulate, PresharedKey, PublicKey,
    Received, ReceivedMessage, StaticSecret, Tunnel, TunnelConfig,
};
use std::mem::{align_of, size_of};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use std::ptr;
use std::time::{Duration, Instant};
use zeroize::Zeroizing;

pub const ST_SLOT_SIZE: usize = 128;
pub const ST_DATAGRAM_MAX: usize = 148;
pub const ST_NEVER: u64 = u64::MAX;

// shim errors
const E_SLOT: i32 = -20; // slot empty or holding the wrong kind of value
const E_ARG: i32 = -21; // null pointer or bad argument
const E_ALIGN: i32 = -22; // slot not 8-byte aligned

// st_interface_receive results
const MSG_INIT: i32 = 1;
const MSG_RESP: i32 = 2;
const MSG_COOKIE: i32 = 3;
const MSG_DATA: i32 = 4;
const SEND_COOKIE_REPLY: i32 = 5;

// st_tunnel_poll_event results
const EV_NONE: i32 = 0;
const EV_SEND_INIT: i32 = 1;
const EV_SEND_KEEPALIVE: i32 = 2;
const EV_ESTABLISHED: i32 = 3;
const EV_EXPIRED: i32 = 4;

#[allow(unreachable_patterns)]
fn code(e: &Error) -> i32 {
    match e {
        Error::DestinationBufferTooSmall { .. } => -1,
        Error::UnexpectedPacket => -2,
        Error::WrongIndex => -3,
        Error::WrongKey => -4,
        Error::ReplayedHandshakeInitiation => -5,
        Error::InvalidMac => -6,
        Error::InvalidAeadTag => -7,
        Error::InvalidCounter => -8,
        Error::DuplicateCounter => -9,
        Error::InvalidPacket => -10,
        Error::NoCurrentSession => -11,
        Error::ConnectionExpired => -12,
        Error::EmptyPlaintext => -13,
        Error::LowOrderPoint => -14,
        Error::RateLimited => -15,
        _ => -19,
    }
}

/// Reports the size a DestinationBufferTooSmall error asks for in *out_len.
fn fail(e: Error, out_len: *mut u32) -> i32 {
    if let Error::DestinationBufferTooSmall { required, .. } = e {
        if !out_len.is_null() {
            unsafe { *out_len = required as u32 };
        }
    }
    code(&e)
}

#[derive(Clone, Copy)]
struct Clock {
    base: Instant,
    base_ns: u64,
}

impl Clock {
    fn at(&self, ns: u64) -> Instant {
        self.base + Duration::from_nanos(ns.saturating_sub(self.base_ns))
    }

    fn ns(&self, t: Instant) -> u64 {
        let d = t.saturating_duration_since(self.base).as_nanos();
        self.base_ns.saturating_add(u64::try_from(d).unwrap_or(u64::MAX))
    }
}

pub struct StInterface {
    inner: Interface,
    clock: Clock,
}

pub struct StTunnel {
    inner: Tunnel,
    clock: Clock,
    id: u32,
}

/// The destination buffer of a decryption, owned by the caller: it must stay valid until the result is committed.
struct RawBuf {
    ptr: *mut u8,
    cap: usize,
}

impl AsMut<[u8]> for RawBuf {
    fn as_mut(&mut self) -> &mut [u8] {
        unsafe { std::slice::from_raw_parts_mut(self.ptr, self.cap) }
    }
}

enum Value {
    Msg(ReceivedMessage),
    Enc(PendingEncapsulate),
    Dec(PendingDecapsulate),
    Decrypted(Decrypted<RawBuf>),
}

#[repr(C, align(8))]
struct Slot {
    tag: u64, // 0 empty, 1 holds a Value
    data: [u8; ST_SLOT_SIZE - 8],
}

const _: () = assert!(size_of::<Slot>() == ST_SLOT_SIZE);
const _: () = assert!(size_of::<Value>() <= ST_SLOT_SIZE - 8);
const _: () = assert!(align_of::<Value>() <= 8);

unsafe fn slot_ok(s: *mut Slot) -> Result<(), i32> {
    if s.is_null() {
        return Err(E_ARG);
    }
    if (s as usize) % 8 != 0 {
        return Err(E_ALIGN);
    }
    Ok(())
}

unsafe fn put(s: *mut Slot, v: Value) {
    if (*s).tag == 1 {
        ptr::drop_in_place((*s).data.as_mut_ptr() as *mut Value);
    }
    ptr::write((*s).data.as_mut_ptr() as *mut Value, v);
    (*s).tag = 1;
}

unsafe fn take(s: *mut Slot) -> Result<Value, i32> {
    slot_ok(s)?;
    if (*s).tag != 1 {
        return Err(E_SLOT);
    }
    (*s).tag = 0;
    Ok(ptr::read((*s).data.as_mut_ptr() as *mut Value))
}

unsafe fn key(p: *const u8) -> [u8; 32] {
    let mut k = [0u8; 32];
    ptr::copy_nonoverlapping(p, k.as_mut_ptr(), 32);
    k
}

unsafe fn put_dgram(d: &[u8], out: *mut u8, out_len: *mut u32) -> i32 {
    if out.is_null() || out_len.is_null() {
        return E_ARG;
    }
    ptr::copy_nonoverlapping(d.as_ptr(), out, d.len());
    *out_len = d.len() as u32;
    1
}

unsafe fn bytes<'a>(p: *const u8, len: u32) -> &'a [u8] {
    if len == 0 {
        return &[];
    }
    std::slice::from_raw_parts(p, len as usize)
}

/// The tunnel a parsed message is for, from its receiver index on the wire (the top 24 bits identify the tunnel).
/// sanstun's TunnelId has no numeric accessor, and these are the bytes it is derived from.
fn wire_tunnel_id(kind: i32, d: &[u8]) -> u32 {
    let at = if kind == MSG_RESP { 8 } else { 4 };
    u32::from_le_bytes([d[at], d[at + 1], d[at + 2], d[at + 3]]) >> 8
}

#[no_mangle]
pub extern "C" fn st_slot_size() -> u32 {
    ST_SLOT_SIZE as u32
}

/// static_private may be null (the key is then derived from the seed). hs_limit 0 keeps the default (100/s).
#[no_mangle]
pub unsafe extern "C" fn st_interface_new(
    seed: *const u8,
    now_ns: u64,
    unix_ns: u64,
    static_private: *const u8,
    hs_limit: u32,
) -> *mut StInterface {
    if seed.is_null() {
        return ptr::null_mut();
    }
    let clock = Clock { base: Instant::now(), base_ns: now_ns };
    let mut inner = Interface::new(Zeroizing::new(key(seed)), clock.base, Duration::from_nanos(unix_ns));
    if !static_private.is_null() {
        inner = inner.with_static_private(StaticSecret::from(Zeroizing::new(key(static_private))));
    }
    if hs_limit != 0 {
        inner = inner.with_handshake_limit(u64::from(hs_limit));
    }
    Box::into_raw(Box::new(StInterface { inner, clock }))
}

#[no_mangle]
pub unsafe extern "C" fn st_interface_free(i: *mut StInterface) -> i32 {
    if !i.is_null() {
        drop(Box::from_raw(i));
    }
    0
}

#[no_mangle]
pub unsafe extern "C" fn st_interface_public(i: *const StInterface, out: *mut u8) -> i32 {
    if i.is_null() || out.is_null() {
        return E_ARG;
    }
    ptr::copy_nonoverlapping((*i).inner.static_public().as_bytes().as_ptr(), out, 32);
    0
}

/// Parses a datagram from ip:port (ip: 16 bytes, an IPv4 address in its first 4 when v6 is 0).
/// Returns MSG_INIT (peer_pub filled), MSG_RESP / MSG_COOKIE / MSG_DATA (*tunnel_id filled), the message in msg,
/// or SEND_COOKIE_REPLY (the reply in out, *out_len): send it back and drop the datagram.
#[no_mangle]
pub unsafe extern "C" fn st_interface_receive(
    i: *mut StInterface,
    ip: *const u8,
    port: u32,
    v6: u32,
    dgram: *const u8,
    len: u32,
    now_ns: u64,
    msg: *mut Slot,
    tunnel_id: *mut u32,
    peer_pub: *mut u8,
    out: *mut u8,
    out_len: *mut u32,
) -> i32 {
    if i.is_null() || ip.is_null() || dgram.is_null() {
        return E_ARG;
    }
    if let Err(e) = slot_ok(msg) {
        return e;
    }
    let addr = if v6 != 0 {
        let mut b = [0u8; 16];
        ptr::copy_nonoverlapping(ip, b.as_mut_ptr(), 16);
        IpAddr::V6(Ipv6Addr::from(b))
    } else {
        IpAddr::V4(Ipv4Addr::new(*ip, *ip.add(1), *ip.add(2), *ip.add(3)))
    };
    let src = SocketAddr::new(addr, port as u16);
    let d = bytes(dgram, len);
    let i = &mut *i;
    match i.inner.receive(src, d, i.clock.at(now_ns)) {
        Err(e) => fail(e, out_len),
        Ok(Received::SendCookieReply(reply)) => {
            put_dgram(&reply, out, out_len);
            SEND_COOKIE_REPLY
        }
        Ok(Received::Message(m)) => {
            let kind = match &m {
                ReceivedMessage::HandshakeInitiation(init) => {
                    if !peer_pub.is_null() {
                        ptr::copy_nonoverlapping(init.peer_static_public().as_bytes().as_ptr(), peer_pub, 32);
                    }
                    MSG_INIT
                }
                ReceivedMessage::HandshakeResponse(_) => MSG_RESP,
                ReceivedMessage::CookieReply(_) => MSG_COOKIE,
                ReceivedMessage::TransportData(_) => MSG_DATA,
            };
            if kind != MSG_INIT && !tunnel_id.is_null() {
                *tunnel_id = wire_tunnel_id(kind, d);
            }
            put(msg, Value::Msg(m));
            kind
        }
    }
}

/// psk may be null. keepalive_s 0 = no persistent keepalive. *err gets the error when null is returned.
#[no_mangle]
pub unsafe extern "C" fn st_tunnel_new(
    i: *mut StInterface,
    peer_pub: *const u8,
    psk: *const u8,
    keepalive_s: u32,
    now_ns: u64,
    err: *mut i32,
) -> *mut StTunnel {
    let set = |e: i32| {
        if !err.is_null() {
            *err = e;
        }
    };
    if i.is_null() || peer_pub.is_null() {
        set(E_ARG);
        return ptr::null_mut();
    }
    let i = &mut *i;
    let mut config = TunnelConfig::default().with_persistent_keepalive(Duration::from_secs(u64::from(keepalive_s)));
    if !psk.is_null() {
        config = config.with_preshared_key(PresharedKey::from(Zeroizing::new(key(psk))));
    }
    match i.inner.new_tunnel(PublicKey::from(key(peer_pub)), config, i.clock.at(now_ns)) {
        Err(e) => {
            set(code(&e));
            ptr::null_mut()
        }
        Ok(t) => {
            let id = t.id().to_string().parse::<u32>().unwrap_or(u32::MAX);
            set(0);
            Box::into_raw(Box::new(StTunnel { inner: t, clock: i.clock, id }))
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn st_tunnel_free(t: *mut StTunnel) -> i32 {
    if !t.is_null() {
        drop(Box::from_raw(t));
    }
    0
}

#[no_mangle]
pub unsafe extern "C" fn st_tunnel_id(t: *const StTunnel) -> u32 {
    if t.is_null() {
        return u32::MAX;
    }
    (*t).id
}

#[no_mangle]
pub unsafe extern "C" fn st_tunnel_is_expired(t: *const StTunnel) -> i32 {
    if t.is_null() {
        return E_ARG;
    }
    i32::from((*t).inner.is_expired())
}

/// Starts a handshake (restart != 0 replaces one in progress). 1 = the initiation is in out, 0 = none.
#[no_mangle]
pub unsafe extern "C" fn st_tunnel_initiate(
    t: *mut StTunnel,
    restart: u32,
    now_ns: u64,
    out: *mut u8,
    out_len: *mut u32,
) -> i32 {
    if t.is_null() {
        return E_ARG;
    }
    let t = &mut *t;
    let now = t.clock.at(now_ns);
    let d = if restart != 0 { t.inner.restart_handshake(now) } else { t.inner.initiate_handshake(now) };
    match d {
        Some(d) => put_dgram(&d, out, out_len),
        None => 0,
    }
}

/// Handles a parsed handshake initiation, handshake response or cookie reply. 1 = a datagram to send back is in
/// out (the response to an initiation, the keepalive confirming a response), 0 = nothing to send (cookie reply).
#[no_mangle]
pub unsafe extern "C" fn st_tunnel_handle(
    t: *mut StTunnel,
    msg: *mut Slot,
    now_ns: u64,
    out: *mut u8,
    out_len: *mut u32,
) -> i32 {
    if t.is_null() {
        return E_ARG;
    }
    let t = &mut *t;
    let now = t.clock.at(now_ns);
    let r = match take(msg) {
        Err(e) => return e,
        Ok(Value::Msg(ReceivedMessage::HandshakeInitiation(m))) => t.inner.handle_handshake_initiation(m, now).map(Some),
        Ok(Value::Msg(ReceivedMessage::HandshakeResponse(m))) => t.inner.handle_handshake_response(m, now).map(Some),
        Ok(Value::Msg(ReceivedMessage::CookieReply(m))) => t.inner.handle_cookie_reply(m, now).map(|_| None),
        Ok(v) => {
            put(msg, v);
            return E_SLOT;
        }
    };
    match r {
        Err(e) => fail(e, out_len),
        Ok(Some(d)) => put_dgram(&d, out, out_len),
        Ok(None) => 0,
    }
}

#[no_mangle]
pub unsafe extern "C" fn st_tunnel_handle_timeout(t: *mut StTunnel, now_ns: u64) -> i32 {
    if t.is_null() {
        return E_ARG;
    }
    let t = &mut *t;
    t.inner.handle_timeout(t.clock.at(now_ns));
    0
}

#[no_mangle]
pub unsafe extern "C" fn st_tunnel_poll_timeout(t: *const StTunnel) -> u64 {
    if t.is_null() {
        return ST_NEVER;
    }
    let t = &*t;
    t.inner.poll_timeout().map_or(ST_NEVER, |d| t.clock.ns(d))
}

/// EV_NONE, EV_SEND_INIT / EV_SEND_KEEPALIVE (the datagram in out), EV_ESTABLISHED (times[0] started,
/// times[1] confirmed, ns), EV_EXPIRED.
#[no_mangle]
pub unsafe extern "C" fn st_tunnel_poll_event(
    t: *mut StTunnel,
    out: *mut u8,
    out_len: *mut u32,
    times: *mut u64,
) -> i32 {
    if t.is_null() {
        return E_ARG;
    }
    let t = &mut *t;
    match t.inner.poll_event() {
        None => EV_NONE,
        Some(Event::SendHandshakeInitiation(d)) => {
            put_dgram(&d, out, out_len);
            EV_SEND_INIT
        }
        Some(Event::SendKeepalive(d)) => {
            put_dgram(&d, out, out_len);
            EV_SEND_KEEPALIVE
        }
        Some(Event::Established { started_at, confirmed_at }) => {
            if !times.is_null() {
                *times = t.clock.ns(started_at);
                *times.add(1) = t.clock.ns(confirmed_at);
            }
            EV_ESTABLISHED
        }
        Some(Event::ConnectionExpired) => EV_EXPIRED,
    }
}

unsafe fn encrypt(p: PendingEncapsulate, pt: *const u8, len: u32, dst: *mut u8, cap: u32, out_len: *mut u32) -> i32 {
    if pt.is_null() || dst.is_null() || out_len.is_null() {
        return E_ARG;
    }
    let dst = std::slice::from_raw_parts_mut(dst, cap as usize);
    match p.encrypt(bytes(pt, len), dst) {
        Err(e) => fail(e, out_len),
        Ok(m) => {
            *out_len = m.len() as u32;
            0
        }
    }
}

/// Encrypts one packet into a data message in dst (cap >= round_up(len, 16) + 32), *out_len its length.
#[no_mangle]
pub unsafe extern "C" fn st_tunnel_encapsulate(
    t: *mut StTunnel,
    pt: *const u8,
    len: u32,
    dst: *mut u8,
    cap: u32,
    now_ns: u64,
    out_len: *mut u32,
) -> i32 {
    if t.is_null() {
        return E_ARG;
    }
    let t = &mut *t;
    match t.inner.begin_encapsulate(t.clock.at(now_ns)) {
        Err(e) => fail(e, out_len),
        Ok(p) => encrypt(p, pt, len, dst, cap, out_len),
    }
}

unsafe fn commit(t: &mut StTunnel, d: Decrypted<RawBuf>, now: Instant, out_len: *mut u32) -> i32 {
    match t.inner.commit_decapsulate(d, now) {
        Err(e) => fail(e, out_len),
        Ok(Committed::Keepalive) => {
            if !out_len.is_null() {
                *out_len = 0;
            }
            1
        }
        Ok(Committed::Data { len, .. }) => {
            if !out_len.is_null() {
                *out_len = len as u32;
            }
            0
        }
    }
}

unsafe fn begin_dec(t: &StTunnel, msg: *mut Slot, now: Instant) -> Result<PendingDecapsulate, i32> {
    match take(msg)? {
        Value::Msg(ReceivedMessage::TransportData(m)) => t.inner.begin_decapsulate(m, now).map_err(|e| code(&e)),
        v => {
            put(msg, v);
            Err(E_SLOT)
        }
    }
}

/// Decrypts and commits a parsed data message (dgram: the same datagram) into dst (cap >= len - 16).
/// 0 = data (*out_len bytes, zero-padded to 16), 1 = keepalive.
#[no_mangle]
pub unsafe extern "C" fn st_tunnel_decapsulate(
    t: *mut StTunnel,
    msg: *mut Slot,
    dgram: *const u8,
    len: u32,
    dst: *mut u8,
    cap: u32,
    now_ns: u64,
    out_len: *mut u32,
) -> i32 {
    if t.is_null() || dgram.is_null() || dst.is_null() {
        return E_ARG;
    }
    let t = &mut *t;
    let now = t.clock.at(now_ns);
    let p = match begin_dec(t, msg, now) {
        Err(e) => return e,
        Ok(p) => p,
    };
    let d = p.decrypt(bytes(dgram, len), RawBuf { ptr: dst, cap: cap as usize });
    commit(t, d, now, out_len)
}

/// Reserves the next counter; the pending encryption goes into slot `pending` (any thread may encrypt it).
#[no_mangle]
pub unsafe extern "C" fn st_tunnel_begin_encapsulate(t: *mut StTunnel, now_ns: u64, pending: *mut Slot) -> i32 {
    if t.is_null() {
        return E_ARG;
    }
    if let Err(e) = slot_ok(pending) {
        return e;
    }
    let t = &mut *t;
    match t.inner.begin_encapsulate(t.clock.at(now_ns)) {
        Err(e) => code(&e),
        Ok(p) => {
            put(pending, Value::Enc(p));
            0
        }
    }
}

/// Thread-safe: touches only the slot and the buffers.
#[no_mangle]
pub unsafe extern "C" fn st_pending_encrypt(
    pending: *mut Slot,
    pt: *const u8,
    len: u32,
    dst: *mut u8,
    cap: u32,
    out_len: *mut u32,
) -> i32 {
    match take(pending) {
        Err(e) => e,
        Ok(Value::Enc(p)) => encrypt(p, pt, len, dst, cap, out_len),
        Ok(v) => {
            put(pending, v);
            E_SLOT
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn st_tunnel_begin_decapsulate(
    t: *const StTunnel,
    msg: *mut Slot,
    now_ns: u64,
    pending: *mut Slot,
) -> i32 {
    if t.is_null() {
        return E_ARG;
    }
    if let Err(e) = slot_ok(pending) {
        return e;
    }
    let t = &*t;
    match begin_dec(t, msg, t.clock.at(now_ns)) {
        Err(e) => e,
        Ok(p) => {
            put(pending, Value::Dec(p));
            0
        }
    }
}

/// Thread-safe. The result (even a failed decryption) goes into slot `decrypted`, to be committed on the tunnel's
/// thread. dst must stay valid until then.
#[no_mangle]
pub unsafe extern "C" fn st_pending_decrypt(
    pending: *mut Slot,
    dgram: *const u8,
    len: u32,
    dst: *mut u8,
    cap: u32,
    decrypted: *mut Slot,
) -> i32 {
    if dgram.is_null() || dst.is_null() {
        return E_ARG;
    }
    if let Err(e) = slot_ok(decrypted) {
        return e;
    }
    match take(pending) {
        Err(e) => e,
        Ok(Value::Dec(p)) => {
            let d = p.decrypt(bytes(dgram, len), RawBuf { ptr: dst, cap: cap as usize });
            put(decrypted, Value::Decrypted(d));
            0
        }
        Ok(v) => {
            put(pending, v);
            E_SLOT
        }
    }
}

/// 0 = data (*out_len bytes in the dst given to st_pending_decrypt), 1 = keepalive.
#[no_mangle]
pub unsafe extern "C" fn st_tunnel_commit_decapsulate(
    t: *mut StTunnel,
    decrypted: *mut Slot,
    now_ns: u64,
    out_len: *mut u32,
) -> i32 {
    if t.is_null() {
        return E_ARG;
    }
    let t = &mut *t;
    let now = t.clock.at(now_ns);
    match take(decrypted) {
        Err(e) => e,
        Ok(Value::Decrypted(d)) => commit(t, d, now, out_len),
        Ok(v) => {
            put(decrypted, v);
            E_SLOT
        }
    }
}

/// Drops whatever a slot holds (an unhandled message, an unused pending value) and empties it.
#[no_mangle]
pub unsafe extern "C" fn st_slot_drop(s: *mut Slot) -> i32 {
    match take(s) {
        Ok(v) => {
            drop(v);
            0
        }
        Err(E_SLOT) => 0,
        Err(e) => e,
    }
}
