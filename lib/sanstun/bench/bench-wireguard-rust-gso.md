# sanstun peer with GSO + UDP GRO: lo vs Rust std vs Rust tokio

2026-11-03 03:32 UTC · Linux version 6.18.55 · 4 × Intel(R) Xeon(R) Processor @ 1.60GHz · lo 0.0.37-pre (V8 15.6.75.19) · 3 rounds × 1,000,000 packets of 1,400 B, medians

Two processes (sender and receiver), one sanstun WireGuard peer each, single-threaded, the same flow in each implementation: 45 packets encrypted at the 1,440-byte ciphertext stride per `UDP_SEGMENT` send, `UDP_GRO` receive split on that stride, every sequence number checked. The sanstun code is the same Rust library in all three: the difference is the IO, the event loop and the per-packet glue (JS + the C ABI binding vs native Rust). Measured at the receiver; CPU from /proc/stat.

| | scenario | ns/packet | Gbit/s | CPU ns/packet | loss | runs (ns/packet) |
|---|---|---:|---:|---:|---:|---|
| 🟦 | lo (peer.js), GSO + GRO, single thread | 1,360 | 8.24 | 2,840 | 1.3% | 1,358 / 1,528 / 1,360 |
| 🟧 | Rust std + epoll, GSO + GRO, single thread | 1,573 | 7.12 | 3,020 | 0.0% | 1,655 / 1,573 / 1,550 |
| 🟪 | Rust tokio (current thread), GSO + GRO | 1,529 | 7.33 | 2,870 | 0.0% | 1,560 / 1,529 / 1,472 |

**Throughput** (Gbit/s of inner packets, higher is better)

```
🟦 lo (peer.js), GSO + GRO, single thread     ████████████████████████████████████  8.24
🟧 Rust std + epoll, GSO + GRO, single thread ███████████████████████████████       7.12
🟪 Rust tokio (current thread), GSO + GRO     ████████████████████████████████      7.33
```

**CPU time per packet**, all CPUs (ns, lower is better)

```
🟦 lo (peer.js), GSO + GRO, single thread     █████████████████████████████████▊    2,840
🟧 Rust std + epoll, GSO + GRO, single thread ████████████████████████████████████  3,020
🟪 Rust tokio (current thread), GSO + GRO     ██████████████████████████████████▏   2,870
```

