# wireguard-go vs kernel WireGuard

2026-11-03 23:21 UTC · Linux version 6.18.55 · 4 × Intel(R) Xeon(R) Processor @ 1.60GHz · lo 0.0.37-pre (V8 15.6.75.19) · 3 rounds × 1,000,000 packets of 1,400 B, medians

Two lo processes: a sender in its own network namespace behind `wgclient` and a receiver behind `wgserver`; the encrypted UDP goes over 127.0.0.1. Kernel WireGuard: wg devices. wireguard-go: two processes (TUN + UDP each), configured over UAPI, its `wgclient` TUN moved into the sender's namespace. Rows: one `send`/`recv` per packet, and a GSO sender (47 packets per `UDP_SEGMENT` send) with a `UDP_GRO` receiver. Measured at the receiver; CPU is all CPUs' busy time (includes the wireguard-go processes).

| | scenario | ns/packet | Gbit/s | CPU ns/packet | loss | packets per call (send / recv) | runs (ns/packet) |
|---|---|---:|---:|---:|---:|---:|---|
| 🟩 | kernel WireGuard, one syscall per packet | 6,691 | 1.67 | 21,647 | 16.2% | 1.0 / 0.9 | 6,473 / 7,027 / 6,691 |
| 🟩 | kernel WireGuard, GSO 47 + GRO | 3,658 | 3.06 | 13,034 | 25.2% | 47.0 / 8.2 | 3,752 / 3,658 / 3,584 |
| 🟨 | wireguard-go, one syscall per packet | 13,554 | 0.83 | 47,141 | 91.1% | 1.0 / 0.8 | 16,935 / 12,802 / 13,554 |
| 🟨 | wireguard-go, GSO 47 + GRO | 3,864 | 2.90 | 16,420 | 94.8% | 47.0 / 30.8 | 3,427 / 4,156 / 3,864 |

**Throughput** (Gbit/s of inner packets, higher is better)

```
🟩 kernel WireGuard, one syscall per packet ███████████████████▋                  1.67
🟩 kernel WireGuard, GSO 47 + GRO           ████████████████████████████████████  3.06
🟨 wireguard-go, one syscall per packet     █████████▋                            0.83
🟨 wireguard-go, GSO 47 + GRO               ██████████████████████████████████    2.90
```

**CPU time per packet**, all CPUs (ns, lower is better)

```
🟩 kernel WireGuard, one syscall per packet ████████████████▌                     21,647
🟩 kernel WireGuard, GSO 47 + GRO           █████████▉                            13,034
🟨 wireguard-go, one syscall per packet     ████████████████████████████████████  47,141
🟨 wireguard-go, GSO 47 + GRO               ████████████▌                         16,420
```

- "packets per call" is what each `sendmmsg`/`recvmmsg` (or `send`/`recv`) actually moved, including the calls that returned nothing (`EAGAIN`): on the receiver, packets per `recv` of a GRO super-datagram.
