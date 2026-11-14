# sanstun on a TUN vs wireguard-go vs kernel WireGuard

2026-11-04 03:00 UTC · Linux version 6.18.55 · 4 × Intel(R) Xeon(R) Processor @ 1.60GHz · lo 0.0.37-pre (V8 15.6.75.19) · 3 rounds × 1,000,000 packets of 1,400 B, medians

Two lo processes: a sender in its own network namespace behind `wgclient` and a receiver behind `wgserver`; the encrypted UDP goes over 127.0.0.1. Kernel WireGuard: wg devices. wireguard-go: two processes (TUN + UDP each), configured over UAPI. sanstun: two `lib/sanstun/tun-peer.js` processes (TUN + UDP each, one packet per syscall on both sides, or batched: outer GSO/GRO, and coalesced `IFF_VNET_HDR` TUN writes). The userspace peers' `wgclient` TUN is moved into the sender's namespace. Rows: one `send`/`recv` per packet, and a GSO sender (47 packets per `UDP_SEGMENT` send) with a `UDP_GRO` receiver. Measured at the receiver; CPU is all CPUs' busy time (includes the peer processes).

| | scenario | ns/packet | Gbit/s | CPU ns/packet | loss | packets per call (send / recv) | runs (ns/packet) |
|---|---|---:|---:|---:|---:|---:|---|
| 🟩 | kernel WireGuard, one syscall per packet | 5,728 | 1.96 | 18,605 | 25.7% | 1.0 / 0.9 | 6,065 / 5,728 / 5,651 |
| 🟩 | kernel WireGuard, GSO 47 + GRO | 3,037 | 3.69 | 11,163 | 27.4% | 47.0 / 9.8 | 3,391 / 3,021 / 3,037 |
| 🟨 | wireguard-go, one syscall per packet | 10,818 | 1.04 | 37,868 | 90.5% | 1.0 / 0.9 | 10,818 / 10,533 / 10,897 |
| 🟨 | wireguard-go, GSO 47 + GRO | 3,275 | 3.42 | 13,208 | 94.3% | 47.0 / 27.9 | 3,161 / 3,278 / 3,275 |
| 🟦 | sanstun on TUN, one syscall per packet | 7,062 | 1.59 | 21,410 | 85.5% | 1.0 / 0.7 | 7,062 / 7,656 / 6,476 |
| 🟦 | sanstun on TUN, GSO 47 + GRO | 7,304 | 1.53 | 20,816 | 88.8% | 47.0 / 0.7 | 7,740 / 7,304 / 6,969 |
| 🟦 | sanstun on TUN + outer GSO/GRO, one syscall per packet | 5,909 | 1.90 | 17,825 | 81.5% | 1.0 / 0.8 | 5,541 / 6,015 / 5,909 |
| 🟦 | sanstun on TUN + outer GSO/GRO, GSO 47 + GRO | 5,157 | 2.17 | 15,297 | 82.9% | 47.0 / 0.8 | 5,821 / 4,777 / 5,157 |
| 🟦 | sanstun on TUN + outer GSO/GRO + coalesced TUN writes, one syscall per packet | 3,251 | 3.45 | 10,471 | 68.5% | 1.0 / 1.0 | 2,907 / 3,251 / 3,688 |
| 🟦 | sanstun on TUN + outer GSO/GRO + coalesced TUN writes, GSO 47 + GRO | 2,674 | 4.19 | 8,453 | 73.2% | 47.0 / 23.7 | 2,698 / 2,577 / 2,674 |

**Throughput** (Gbit/s of inner packets, higher is better)

```
🟩 kernel WireGuard, one syscall per packet                                      ████████████████▊                     1.96
🟩 kernel WireGuard, GSO 47 + GRO                                                ███████████████████████████████▋      3.69
🟨 wireguard-go, one syscall per packet                                          ████████▉                             1.04
🟨 wireguard-go, GSO 47 + GRO                                                    █████████████████████████████▍        3.42
🟦 sanstun on TUN, one syscall per packet                                        █████████████▋                        1.59
🟦 sanstun on TUN, GSO 47 + GRO                                                  █████████████▏                        1.53
🟦 sanstun on TUN + outer GSO/GRO, one syscall per packet                        ████████████████▎                     1.90
🟦 sanstun on TUN + outer GSO/GRO, GSO 47 + GRO                                  ██████████████████▋                   2.17
🟦 sanstun on TUN + outer GSO/GRO + coalesced TUN writes, one syscall per packet █████████████████████████████▌        3.45
🟦 sanstun on TUN + outer GSO/GRO + coalesced TUN writes, GSO 47 + GRO           ████████████████████████████████████  4.19
```

**CPU time per packet**, all CPUs (ns, lower is better)

```
🟩 kernel WireGuard, one syscall per packet                                      █████████████████▋                    18,605
🟩 kernel WireGuard, GSO 47 + GRO                                                ██████████▌                           11,163
🟨 wireguard-go, one syscall per packet                                          ████████████████████████████████████  37,868
🟨 wireguard-go, GSO 47 + GRO                                                    ████████████▌                         13,208
🟦 sanstun on TUN, one syscall per packet                                        ████████████████████▎                 21,410
🟦 sanstun on TUN, GSO 47 + GRO                                                  ███████████████████▊                  20,816
🟦 sanstun on TUN + outer GSO/GRO, one syscall per packet                        ████████████████▉                     17,825
🟦 sanstun on TUN + outer GSO/GRO, GSO 47 + GRO                                  ██████████████▌                       15,297
🟦 sanstun on TUN + outer GSO/GRO + coalesced TUN writes, one syscall per packet █████████▉                            10,471
🟦 sanstun on TUN + outer GSO/GRO + coalesced TUN writes, GSO 47 + GRO           ████████                              8,453
```

- "packets per call" is what each `sendmmsg`/`recvmmsg` (or `send`/`recv`) actually moved, including the calls that returned nothing (`EAGAIN`): on the receiver, packets per `recv` of a GRO super-datagram.
