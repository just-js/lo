# GSO + UDP GRO with the crypto on worker threads: lo vs Rust

2026-11-03 22:42 UTC · Linux version 6.18.55 · 4 × Intel(R) Xeon(R) Processor @ 1.60GHz · lo 0.0.37-pre (V8 15.6.75.19) · 3 rounds × 1,000,000 packets of 1,400 B, medians

Two processes (sender and receiver), one sanstun WireGuard peer each, GSO (45 packets per `UDP_SEGMENT` send) and `UDP_GRO` receive. With workers, the main thread owns the tunnel and the workers encrypt/decrypt; lo uses cells (isolates on threads, `lib/sanstun/peer.js`), Rust uses std threads (`sanstun-peer-offload`), with the same ring, worker split and batching. lo's offload path is not optimized yet (it rebuilds its iovecs with BigInts per `recvmsg`); Rust builds its iovec table once. Measured at the receiver; CPU from /proc/stat.

| | scenario | ns/packet | Gbit/s | CPU ns/packet | loss | runs (ns/packet) |
|---|---|---:|---:|---:|---:|---|
| 🟦 | lo, single thread (reference) | 1,445 | 7.75 | 3,083 | 2.0% | 1,422 / 1,445 / 1,445 |
| 🟧 | Rust, single thread (reference) | 1,613 | 6.94 | 3,040 | 0.0% | 1,613 / 1,615 / 1,589 |
| 🟦 | lo, sender 1 / receiver 1 workers | 2,380 | 4.71 | 11,086 | 19.5% | 2,376 / 2,380 / 2,396 |
| 🟧 | Rust, sender 1 / receiver 1 workers | 3,264 | 3.43 | 11,037 | 11.0% | 3,211 / 3,316 / 3,264 |
| 🟦 | lo, sender 0 / receiver 2 workers | 2,022 | 5.54 | 7,960 | 0.0% | 1,998 / 2,100 / 2,022 |
| 🟧 | Rust, sender 0 / receiver 2 workers | 2,107 | 5.31 | 7,600 | 0.0% | 2,173 / 2,107 / 2,079 |

**Throughput** (Gbit/s of inner packets, higher is better)

```
🟦 lo, single thread (reference)       ████████████████████████████████████  7.75
🟧 Rust, single thread (reference)     ████████████████████████████████▏     6.94
🟦 lo, sender 1 / receiver 1 workers   █████████████████████▊                4.71
🟧 Rust, sender 1 / receiver 1 workers ███████████████▉                      3.43
🟦 lo, sender 0 / receiver 2 workers   █████████████████████████▋            5.54
🟧 Rust, sender 0 / receiver 2 workers ████████████████████████▋             5.31
```

**CPU time per packet**, all CPUs (ns, lower is better)

```
🟦 lo, single thread (reference)       ██████████                            3,083
🟧 Rust, single thread (reference)     █████████▊                            3,040
🟦 lo, sender 1 / receiver 1 workers   ████████████████████████████████████  11,086
🟧 Rust, sender 1 / receiver 1 workers ███████████████████████████████████▊  11,037
🟦 lo, sender 0 / receiver 2 workers   █████████████████████████▊            7,960
🟧 Rust, sender 0 / receiver 2 workers ████████████████████████▋             7,600
```

