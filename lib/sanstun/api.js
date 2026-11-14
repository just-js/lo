// sanstun (github.com/firezone/sanstun): sans-IO WireGuard, through the C ABI crate in capi/ (contract: sanstun.h,
// details: capi/src/lib.rs). build.js builds it into sanstun_capi.o (Rust + cargo needed).
// Every buffer argument is an address (lo.ptr(u8).ptr). Times are ns of a monotonic clock (lo.hrtime()).
// Slots (parsed messages, pending values) are 128-byte, 8-byte aligned, zeroed caller buffers.
const P = 'pointer'
const api = {
  slot_size: { parameters: [], result: 'u32', name: 'st_slot_size' },
  // st_interface *st_interface_new(seed[32], now_ns, unix_ns, static_private[32] or 0, hs_limit (0 = default))
  interface_new: {
    parameters: [P, 'u64', 'u64', P, 'u32'],
    pointers: ['const uint8_t*', , , 'const uint8_t*'],
    result: P, rpointer: 'st_interface*',
    name: 'st_interface_new'
  },
  interface_free: { parameters: [P], pointers: ['st_interface*'], result: 'i32', name: 'st_interface_free' },
  interface_public: {
    parameters: [P, P], pointers: ['const st_interface*', 'uint8_t*'], result: 'i32', name: 'st_interface_public'
  },
  // (i, ip[16], port, v6, dgram, len, now_ns, msg slot, *tunnel_id, peer_pub[32], out[148], *out_len)
  // 1 init, 2 response, 3 cookie reply, 4 data, 5 send the cookie reply in out; < 0 error
  interface_receive: {
    parameters: [P, P, 'u32', 'u32', P, 'u32', 'u64', P, P, P, P, P],
    pointers: ['st_interface*', 'const uint8_t*', , , 'const uint8_t*', , , 'st_slot*', 'uint32_t*', 'uint8_t*',
      'uint8_t*', 'uint32_t*'],
    result: 'i32',
    name: 'st_interface_receive'
  },
  // (i, peer_pub[32], psk[32] or 0, keepalive_s, now_ns, *err) -> st_tunnel* or 0
  tunnel_new: {
    parameters: [P, P, P, 'u32', 'u64', P],
    pointers: ['st_interface*', 'const uint8_t*', 'const uint8_t*', , , 'int32_t*'],
    result: P, rpointer: 'st_tunnel*',
    name: 'st_tunnel_new'
  },
  tunnel_free: { parameters: [P], pointers: ['st_tunnel*'], result: 'i32', name: 'st_tunnel_free' },
  tunnel_id: { parameters: [P], pointers: ['const st_tunnel*'], result: 'u32', name: 'st_tunnel_id' },
  tunnel_is_expired: {
    parameters: [P], pointers: ['const st_tunnel*'], result: 'i32', name: 'st_tunnel_is_expired'
  },
  // (t, restart, now_ns, out[148], *out_len): 1 = initiation in out, 0 = none
  tunnel_initiate: {
    parameters: [P, 'u32', 'u64', P, P],
    pointers: ['st_tunnel*', , , 'uint8_t*', 'uint32_t*'],
    result: 'i32',
    name: 'st_tunnel_initiate'
  },
  // (t, msg slot, now_ns, out[148], *out_len): 1 = datagram to send back in out, 0 = nothing
  tunnel_handle: {
    parameters: [P, P, 'u64', P, P],
    pointers: ['st_tunnel*', 'st_slot*', , 'uint8_t*', 'uint32_t*'],
    result: 'i32',
    name: 'st_tunnel_handle'
  },
  tunnel_handle_timeout: {
    parameters: [P, 'u64'], pointers: ['st_tunnel*'], result: 'i32', name: 'st_tunnel_handle_timeout'
  },
  // next deadline in ns, ST_NEVER (2^64 - 1) = none
  tunnel_poll_timeout: {
    parameters: [P], pointers: ['const st_tunnel*'], result: 'u64', name: 'st_tunnel_poll_timeout'
  },
  // (t, out[148], *out_len, times u64[2]): 0 none, 1 send init, 2 send keepalive, 3 established, 4 expired
  tunnel_poll_event: {
    parameters: [P, P, P, P],
    pointers: ['st_tunnel*', 'uint8_t*', 'uint32_t*', 'uint64_t*'],
    result: 'i32',
    name: 'st_tunnel_poll_event'
  },
  // (t, plaintext, len, dst, cap, now_ns, *out_len)
  tunnel_encapsulate: {
    parameters: [P, P, 'u32', P, 'u32', 'u64', P],
    pointers: ['st_tunnel*', 'const uint8_t*', , 'uint8_t*', , , 'uint32_t*'],
    result: 'i32',
    name: 'st_tunnel_encapsulate'
  },
  // (t, msg slot, dgram, len, dst, cap, now_ns, *out_len): 0 data, 1 keepalive
  tunnel_decapsulate: {
    parameters: [P, P, P, 'u32', P, 'u32', 'u64', P],
    pointers: ['st_tunnel*', 'st_slot*', 'const uint8_t*', , 'uint8_t*', , , 'uint32_t*'],
    result: 'i32',
    name: 'st_tunnel_decapsulate'
  },
  // split data path: begin/commit on the tunnel's thread, encrypt/decrypt on any thread
  tunnel_begin_encapsulate: {
    parameters: [P, 'u64', P],
    pointers: ['st_tunnel*', , 'st_slot*'],
    result: 'i32',
    name: 'st_tunnel_begin_encapsulate'
  },
  pending_encrypt: {
    parameters: [P, P, 'u32', P, 'u32', P],
    pointers: ['st_slot*', 'const uint8_t*', , 'uint8_t*', , 'uint32_t*'],
    result: 'i32',
    name: 'st_pending_encrypt'
  },
  tunnel_begin_decapsulate: {
    parameters: [P, P, 'u64', P],
    pointers: ['const st_tunnel*', 'st_slot*', , 'st_slot*'],
    result: 'i32',
    name: 'st_tunnel_begin_decapsulate'
  },
  pending_decrypt: {
    parameters: [P, P, 'u32', P, 'u32', P],
    pointers: ['st_slot*', 'const uint8_t*', , 'uint8_t*', , 'st_slot*'],
    result: 'i32',
    name: 'st_pending_decrypt'
  },
  tunnel_commit_decapsulate: {
    parameters: [P, P, 'u64', P],
    pointers: ['st_tunnel*', 'st_slot*', , 'uint32_t*'],
    result: 'i32',
    name: 'st_tunnel_commit_decapsulate'
  },
  slot_drop: { parameters: [P], pointers: ['st_slot*'], result: 'i32', name: 'st_slot_drop' }
}

const name = 'sanstun'
const includes = ['sanstun.h']
const obj = ['sanstun_capi.o']
const libs = []

export { name, api, includes, obj, libs }
