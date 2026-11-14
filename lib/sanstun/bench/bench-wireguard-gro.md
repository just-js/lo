# GSO + UDP GRO for plain UDP and kernel WireGuard

2026-11-03 03:05 UTC · Linux version 6.18.55 · 4 × Intel(R) Xeon(R) Processor @ 1.60GHz · lo 0.0.37-pre (V8 15.6.75.19) · 3 rounds × 1,000,000 packets of 1,400 B, medians

Two lo processes on loopback, a sender and a receiver, connected non-blocking sockets on lo's epoll loop. The sender sends up to 47 packets per `send` with `UDP_SEGMENT` (GSO); the receiver sets `UDP_GRO` and reads coalesced super-datagrams of up to 64 KB with one `recv`. Compare with bench-wireguard-batch.md (the same sender with a `recvmmsg` receiver). Kernel WireGuard: the sender sits in its own network namespace behind `wgclient`, the receiver behind `wgserver`. Measured at the receiver; CPU is all CPUs' busy time over the run.

| | scenario | ns/packet | Gbit/s | CPU ns/packet | loss | packets per call (send / recv) | runs (ns/packet) |
|---|---|---:|---:|---:|---:|---:|---|
| ⬜ | plain UDP, GSO 47 per send + GRO | 309 | 36.23 | 490 | 0.0% | 47.0 / 25.3 | 330 / 309 / 307 |
| 🟩 | kernel WireGuard, GSO 47 per send + GRO | 2,987 | 3.75 | 11,155 | 26.7% | 47.0 / 9.4 | 2,983 / 3,645 / 2,987 |

**Throughput** (Gbit/s of inner packets, higher is better)

```
⬜ plain UDP, GSO 47 per send + GRO        ████████████████████████████████████  36.23
🟩 kernel WireGuard, GSO 47 per send + GRO ███▋                                  3.75
```

**CPU time per packet**, all CPUs (ns, lower is better)

```
⬜ plain UDP, GSO 47 per send + GRO        █▌                                    490
🟩 kernel WireGuard, GSO 47 per send + GRO ████████████████████████████████████  11,155
```

- "packets per call" is what each `sendmmsg`/`recvmmsg` (or `send`/`recv`) actually moved, including the calls that returned nothing (`EAGAIN`): on the receiver, packets per `recv` of a GRO super-datagram.
