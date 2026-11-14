/* C ABI of capi/ (sanstun, sans-IO WireGuard). capi/src/lib.rs has the details per function.
 * - Times are uint64_t ns of a monotonic clock; ST_NEVER = no deadline.
 * - Datagrams for the peer (handshake, cookie reply, keepalive) are copied into caller buffers of at least
 *   ST_DATAGRAM_MAX bytes; *out_len gets the length.
 * - Parsed messages and pending/decrypted values live in caller-owned slots: ST_SLOT_SIZE bytes, 8-byte aligned,
 *   zeroed = empty. A slot holding a value must be consumed or emptied with st_slot_drop before it's freed.
 * - Negative results are errors: -1..-15 sanstun::Error (-1 destination too small: *out_len = bytes needed),
 *   -20 wrong/empty slot, -21 bad argument, -22 misaligned slot.
 */
#ifndef LO_SANSTUN_H
#define LO_SANSTUN_H
#include <stdint.h>

#define ST_SLOT_SIZE 128
#define ST_DATAGRAM_MAX 148
#define ST_NEVER UINT64_MAX

typedef struct st_interface st_interface;
typedef struct st_tunnel st_tunnel;
typedef struct st_slot { uint64_t tag; uint8_t b[ST_SLOT_SIZE - 8]; } st_slot; /* opaque */

#ifdef __cplusplus
extern "C" {
#endif

uint32_t st_slot_size(void);

st_interface *st_interface_new(const uint8_t *seed, uint64_t now_ns, uint64_t unix_ns,
  const uint8_t *static_private, uint32_t hs_limit);
int32_t st_interface_free(st_interface *i);
int32_t st_interface_public(const st_interface *i, uint8_t *out);
/* 1 init (peer_pub), 2 response, 3 cookie reply, 4 data (*tunnel_id), 5 send the cookie reply in out */
int32_t st_interface_receive(st_interface *i, const uint8_t *ip, uint32_t port, uint32_t v6,
  const uint8_t *dgram, uint32_t len, uint64_t now_ns, st_slot *msg, uint32_t *tunnel_id, uint8_t *peer_pub,
  uint8_t *out, uint32_t *out_len);

st_tunnel *st_tunnel_new(st_interface *i, const uint8_t *peer_pub, const uint8_t *psk, uint32_t keepalive_s,
  uint64_t now_ns, int32_t *err);
int32_t st_tunnel_free(st_tunnel *t);
uint32_t st_tunnel_id(const st_tunnel *t);
int32_t st_tunnel_is_expired(const st_tunnel *t);
int32_t st_tunnel_initiate(st_tunnel *t, uint32_t restart, uint64_t now_ns, uint8_t *out, uint32_t *out_len);
int32_t st_tunnel_handle(st_tunnel *t, st_slot *msg, uint64_t now_ns, uint8_t *out, uint32_t *out_len);
int32_t st_tunnel_handle_timeout(st_tunnel *t, uint64_t now_ns);
uint64_t st_tunnel_poll_timeout(const st_tunnel *t);
/* 0 none, 1 send initiation, 2 send keepalive (out), 3 established (times[0..1]), 4 expired */
int32_t st_tunnel_poll_event(st_tunnel *t, uint8_t *out, uint32_t *out_len, uint64_t *times);

int32_t st_tunnel_encapsulate(st_tunnel *t, const uint8_t *pt, uint32_t len, uint8_t *dst, uint32_t cap,
  uint64_t now_ns, uint32_t *out_len);
/* 0 data, 1 keepalive */
int32_t st_tunnel_decapsulate(st_tunnel *t, st_slot *msg, const uint8_t *dgram, uint32_t len, uint8_t *dst,
  uint32_t cap, uint64_t now_ns, uint32_t *out_len);

int32_t st_tunnel_begin_encapsulate(st_tunnel *t, uint64_t now_ns, st_slot *pending);
int32_t st_pending_encrypt(st_slot *pending, const uint8_t *pt, uint32_t len, uint8_t *dst, uint32_t cap,
  uint32_t *out_len);
int32_t st_tunnel_begin_decapsulate(const st_tunnel *t, st_slot *msg, uint64_t now_ns, st_slot *pending);
int32_t st_pending_decrypt(st_slot *pending, const uint8_t *dgram, uint32_t len, uint8_t *dst, uint32_t cap,
  st_slot *decrypted);
int32_t st_tunnel_commit_decapsulate(st_tunnel *t, st_slot *decrypted, uint64_t now_ns, uint32_t *out_len);
int32_t st_slot_drop(st_slot *s);

#ifdef __cplusplus
}
#endif
#endif
