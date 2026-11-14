# sanstun on a TUN vs wireguard-go vs kernel WireGuard

2026-11-04 02:58 UTC · Linux version 6.18.55 · 4 × Intel(R) Xeon(R) Processor @ 1.60GHz · lo 0.0.37-pre (V8 15.6.75.19) · 3 rounds × 1,000,000 packets of 1,400 B, medians

Two lo processes: a sender in its own network namespace behind `wgclient` and a receiver behind `wgserver`; the encrypted UDP goes over 127.0.0.1. Kernel WireGuard: wg devices. wireguard-go: two processes (TUN + UDP each), configured over UAPI. sanstun: two `lib/sanstun/tun-peer.js` processes (TUN + UDP each, one packet per syscall on both sides, or batched: outer GSO/GRO, and coalesced `IFF_VNET_HDR` TUN writes). The userspace peers' `wgclient` TUN is moved into the sender's namespace. Rows: one `send`/`recv` per packet, and a GSO sender (47 packets per `UDP_SEGMENT` send) with a `UDP_GRO` receiver. Measured at the receiver; CPU is all CPUs' busy time (includes the peer processes).

| | scenario | ns/packet | Gbit/s | CPU ns/packet | loss | packets per call (send / recv) | runs (ns/packet) |
|---|---|---:|---:|---:|---:|---:|---|
| 🟩 | kernel WireGuard, one syscall per packet | 4,401 | 2.54 | 15,849 | 21.0% | 1.0 / 0.9 | 4,519 / 4,401 / 4,380 |
| 🟩 | kernel WireGuard, GSO 47 + GRO | 2,686 | 4.17 | 10,373 | 23.8% | 47.0 / 10.5 | 2,736 / 2,584 / 2,686 |
| 🟨 | wireguard-go, one syscall per packet | 11,608 | 0.96 | 44,959 | 90.2% | 1.0 / 0.8 | 11,608 / 10,218 / 13,746 |
| 🟨 | wireguard-go, GSO 47 + GRO | 3,427 | 3.27 | 14,392 | 94.3% | 47.0 / 29.2 | 3,562 / 3,270 / 3,427 |
| 🟦 | sanstun on TUN, one syscall per packet | 5,836 | 1.92 | 19,848 | 81.6% | 1.0 / 0.6 | 5,219 / 6,268 / 5,836 |
| 🟦 | sanstun on TUN, GSO 47 + GRO | 5,734 | 1.95 | 17,527 | 86.4% | 47.0 / 0.6 | 5,734 / 5,309 / 6,236 |
| 🟦 | sanstun on TUN + outer GSO/GRO, one syscall per packet | 3,806 | 2.94 | 13,104 | 71.9% | 1.0 / 0.6 | 3,587 / 3,806 / 4,353 |
| 🟦 | sanstun on TUN + outer GSO/GRO, GSO 47 + GRO | 3,632 | 3.08 | 12,289 | 78.4% | 47.0 / 0.6 | 3,603 / 3,632 / 5,207 |
| 🟦 | sanstun on TUN + outer GSO/GRO + coalesced TUN writes, one syscall per packet | 2,950 | 3.80 | 9,874 | 66.4% | 1.0 / 1.0 | 2,880 / 2,950 / 3,193 |
| 🟦 | sanstun on TUN + outer GSO/GRO + coalesced TUN writes, GSO 47 + GRO | 2,665 | 4.20 | 8,448 | 73.6% | 47.0 / 23.1 | 2,534 / 2,865 / 2,665 |

**Throughput** (Gbit/s of inner packets, higher is better)

```
🟩 kernel WireGuard, one syscall per packet                                      █████████████████████▊                2.54
🟩 kernel WireGuard, GSO 47 + GRO                                                ███████████████████████████████████▋  4.17
🟨 wireguard-go, one syscall per packet                                          ████████▎                             0.96
🟨 wireguard-go, GSO 47 + GRO                                                    ███████████████████████████▉          3.27
🟦 sanstun on TUN, one syscall per packet                                        ████████████████▍                     1.92
🟦 sanstun on TUN, GSO 47 + GRO                                                  ████████████████▋                     1.95
🟦 sanstun on TUN + outer GSO/GRO, one syscall per packet                        █████████████████████████▏            2.94
🟦 sanstun on TUN + outer GSO/GRO, GSO 47 + GRO                                  ██████████████████████████▍           3.08
🟦 sanstun on TUN + outer GSO/GRO + coalesced TUN writes, one syscall per packet ████████████████████████████████▌     3.80
🟦 sanstun on TUN + outer GSO/GRO + coalesced TUN writes, GSO 47 + GRO           ████████████████████████████████████  4.20
```

**CPU time per packet**, all CPUs (ns, lower is better)

```
🟩 kernel WireGuard, one syscall per packet                                      ████████████▋                         15,849
🟩 kernel WireGuard, GSO 47 + GRO                                                ████████▎                             10,373
🟨 wireguard-go, one syscall per packet                                          ████████████████████████████████████  44,959
🟨 wireguard-go, GSO 47 + GRO                                                    ███████████▌                          14,392
🟦 sanstun on TUN, one syscall per packet                                        ███████████████▉                      19,848
🟦 sanstun on TUN, GSO 47 + GRO                                                  ██████████████                        17,527
🟦 sanstun on TUN + outer GSO/GRO, one syscall per packet                        ██████████▍                           13,104
🟦 sanstun on TUN + outer GSO/GRO, GSO 47 + GRO                                  █████████▊                            12,289
🟦 sanstun on TUN + outer GSO/GRO + coalesced TUN writes, one syscall per packet ███████▉                              9,874
🟦 sanstun on TUN + outer GSO/GRO + coalesced TUN writes, GSO 47 + GRO           ██████▊                               8,448
```

- "packets per call" is what each `sendmmsg`/`recvmmsg` (or `send`/`recv`) actually moved, including the calls that returned nothing (`EAGAIN`): on the receiver, packets per `recv` of a GRO super-datagram.
