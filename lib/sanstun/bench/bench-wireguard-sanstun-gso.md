# sanstun peers over UDP with GSO + UDP GRO

2026-11-03 03:08 UTC · Linux version 6.18.55 · 4 × Intel(R) Xeon(R) Processor @ 1.60GHz · lo 0.0.37-pre (V8 15.6.75.19) · 3 rounds × 1,000,000 packets of 1,400 B, medians

Two lo processes, one sanstun WireGuard peer each (`lib/sanstun/peer.js ... gso`). The sender encrypts up to 45 packets back to back and sends them with one call and `UDP_SEGMENT`; the receiver reads `UDP_GRO` super-datagrams and decrypts each segment. Compare with section 2 of bench-wireguard.md (the same peers, one syscall per packet) and with bench-wireguard-gro.md (plain UDP and kernel WireGuard with GSO + GRO).

| | scenario | ns/packet | Gbit/s | CPU ns/packet | loss | runs (ns/packet) |
|---|---|---:|---:|---:|---:|---|
| 🟦 | lo sanstun peers, GSO + GRO, single thread | 1,475 | 7.60 | 3,119 | 0.0% | 1,394 / 1,475 / 1,821 |
| 🟦 | lo sanstun peers, GSO + GRO, 1 crypto worker each | 3,187 | 3.51 | 14,187 | 20.2% | 2,753 / 3,187 / 3,311 |

**Throughput** (Gbit/s of inner packets, higher is better)

```
🟦 lo sanstun peers, GSO + GRO, single thread        ████████████████████████████████████  7.60
🟦 lo sanstun peers, GSO + GRO, 1 crypto worker each ████████████████▋                     3.51
```

**CPU time per packet**, all CPUs (ns, lower is better)

```
🟦 lo sanstun peers, GSO + GRO, single thread        ███████▉                              3,119
🟦 lo sanstun peers, GSO + GRO, 1 crypto worker each ████████████████████████████████████  14,187
```

