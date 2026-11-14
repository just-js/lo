# Batched IO (sendmmsg/recvmmsg, GSO) for plain UDP and kernel WireGuard

2026-11-03 02:57 UTC · Linux version 6.18.55 · 4 × Intel(R) Xeon(R) Processor @ 1.60GHz · lo 0.0.37-pre (V8 15.6.75.19) · 3 rounds × 1,000,000 packets of 1,400 B, medians

Two lo processes on loopback, a sender and a receiver, connected non-blocking sockets on lo's epoll loop. Unbatched: one `send`/`recv` per packet. Batched: `sendmmsg`/`recvmmsg` with up to 32 packets per call. GSO: one `send` of up to 47 packets with `UDP_SEGMENT`, split by the kernel (the receiver stays on `recvmmsg`, no UDP GRO). Kernel WireGuard: the sender sits in its own network namespace behind `wgclient`, the receiver behind `wgserver`. Measured at the receiver; CPU is all CPUs' busy time over the run.

| | scenario | ns/packet | Gbit/s | CPU ns/packet | loss | packets per call (send / recv) | batched vs unbatched | runs (ns/packet) |
|---|---|---:|---:|---:|---:|---:|---:|---|
| ⬜ | plain UDP, one syscall per packet | 4,613 | 2.43 | 6,570 | 0.0% | 1.0 / 0.7 |  | 4,980 / 4,613 / 4,164 |
| ⬜ | plain UDP, batches of 32 | 3,062 | 3.66 | 5,130 | 0.0% | 32.0 / 0.9 | 1.51× faster, 1.28× less CPU | 3,385 / 2,913 / 3,062 |
| ⬜ | plain UDP, GSO 47 per send | 717 | 15.63 | 1,559 | 10.9% | 47.0 / 31.5 | 6.44× faster, 4.21× less CPU | 862 / 717 / 710 |
| 🟩 | kernel WireGuard, one syscall per packet | 6,457 | 1.73 | 21,458 | 19.6% | 1.0 / 0.9 |  | 5,989 / 7,024 / 6,457 |
| 🟩 | kernel WireGuard, batches of 32 | 6,959 | 1.61 | 22,252 | 13.4% | 32.0 / 3.9 | 0.93× faster, 0.96× less CPU | 7,105 / 6,223 / 6,959 |
| 🟩 | kernel WireGuard, GSO 47 per send | 2,929 | 3.82 | 11,402 | 25.9% | 47.0 / 19.9 | 2.20× faster, 1.88× less CPU | 2,915 / 3,598 / 2,929 |

**Throughput** (Gbit/s of inner packets, higher is better)

```
⬜ plain UDP, one syscall per packet        █████▌                                2.43
⬜ plain UDP, batches of 32                 ████████▍                             3.66
⬜ plain UDP, GSO 47 per send               ████████████████████████████████████  15.63
🟩 kernel WireGuard, one syscall per packet ███▉                                  1.73
🟩 kernel WireGuard, batches of 32          ███▋                                  1.61
🟩 kernel WireGuard, GSO 47 per send        ████████▊                             3.82
```

**CPU time per packet**, all CPUs (ns, lower is better)

```
⬜ plain UDP, one syscall per packet        ██████████▋                           6,570
⬜ plain UDP, batches of 32                 ████████▎                             5,130
⬜ plain UDP, GSO 47 per send               ██▌                                   1,559
🟩 kernel WireGuard, one syscall per packet ██████████████████████████████████▋   21,458
🟩 kernel WireGuard, batches of 32          ████████████████████████████████████  22,252
🟩 kernel WireGuard, GSO 47 per send        ██████████████████▍                   11,402
```

- "packets per call" is what each `sendmmsg`/`recvmmsg` (or `send`/`recv`) actually moved, including the calls that returned nothing (`EAGAIN`). The receiver only batches when packets are queued by the time it reads.
