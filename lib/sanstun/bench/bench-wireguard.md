# WireGuard benchmark: sanstun (lo, Rust) and kernel WireGuard

2026-11-03 02:24 UTC · Linux version 6.18.55 · 4 × Intel(R) Xeon(R) Processor @ 1.60GHz · lo 0.0.37-pre (V8 15.6.75.19) · 3 rounds × 1,000,000 packets of 1,400 B, medians

> **Two kinds of measurement, not comparable with each other.** Section 1 is the WireGuard protocol work alone: one process holds both peers and passes packets through memory, with **no networking at all** (no sockets, no syscalls). Section 2 is **real traffic**: two processes, packets over UDP through the kernel's network stack, one syscall per packet on each side. Compare rows within a section.

## 1. Protocol only: in memory, no networking

🟦 lo and 🟧 Rust run the same sanstun pipeline (encapsulate → receive → decapsulate → commit, every packet checked) in one process holding both peers: `lib/sanstun/offload.js` and `lib/sanstun/sanstun-offload`. With workers, the main thread keeps the tunnel state and the workers encrypt and decrypt.

| | scenario | ns/packet | Gbit/s | M packets/s | CPU ns/packet | vs lo, single thread | runs (ns/packet) |
|---|---|---:|---:|---:|---:|---:|---|
| 🟦 | lo, single thread | 2,448 | 4.58 | 0.408 | 2,540 | 1.00× | 2,448 / 2,399 / 2,620 |
| 🟧 | Rust, single thread | 2,475 | 4.53 | 0.404 | 2,530 | 0.99× | 2,475 / 2,276 / 2,633 |
| 🟦 | lo, 1 crypto worker | 2,386 | 4.69 | 0.419 | 4,900 | 1.03× | 2,386 / 2,306 / 3,310 |
| 🟧 | Rust, 1 crypto worker | 2,404 | 4.66 | 0.416 | 4,870 | 1.02× | 3,770 / 2,264 / 2,404 |
| 🟦 | lo, 2 crypto workers | 1,563 | 7.17 | 0.640 | 4,820 | 1.57× | 1,725 / 1,540 / 1,563 |
| 🟧 | Rust, 2 crypto workers | 1,480 | 7.57 | 0.676 | 4,460 | 1.65× | 1,587 / 1,480 / 1,367 |
| 🟦 | lo, 3 crypto workers | 1,242 | 9.02 | 0.805 | 5,040 | 1.97× | 1,298 / 1,217 / 1,242 |
| 🟧 | Rust, 3 crypto workers | 1,214 | 9.23 | 0.824 | 4,860 | 2.02× | 1,214 / 1,112 / 1,228 |

**Throughput** (Gbit/s of inner packets, higher is better)

```
🟦 lo, single thread      █████████████████▊                    4.58
🟧 Rust, single thread    █████████████████▋                    4.53
🟦 lo, 1 crypto worker    ██████████████████▎                   4.69
🟧 Rust, 1 crypto worker  ██████████████████▏                   4.66
🟦 lo, 2 crypto workers   ███████████████████████████▉          7.17
🟧 Rust, 2 crypto workers █████████████████████████████▌        7.57
🟦 lo, 3 crypto workers   ███████████████████████████████████▏  9.02
🟧 Rust, 3 crypto workers ████████████████████████████████████  9.23
```

**CPU time per packet**, all CPUs (ns, lower is better)

```
🟦 lo, single thread      ██████████████████▏                   2,540
🟧 Rust, single thread    ██████████████████                    2,530
🟦 lo, 1 crypto worker    ███████████████████████████████████   4,900
🟧 Rust, 1 crypto worker  ██████████████████████████████████▊   4,870
🟦 lo, 2 crypto workers   ██████████████████████████████████▍   4,820
🟧 Rust, 2 crypto workers ███████████████████████████████▊      4,460
🟦 lo, 3 crypto workers   ████████████████████████████████████  5,040
🟧 Rust, 3 crypto workers ██████████████████████████████████▋   4,860
```

## 2. Real networking: two processes over UDP

A sender process and a receiver process on loopback, one `send`/`recv` per packet, measured at the receiver (first to last packet; loss = packets sent but not delivered).

- ⬜ **plain UDP, no crypto**: the IO baseline, the cost of the sockets and the network stack alone.
- 🟦 **lo sanstun peers** (`lib/sanstun/peer.js`): a userspace WireGuard peer per process, epoll-driven, ciphertext over UDP; with workers, each side moves its crypto to cells.
- 🟩 **lo + kernel WireGuard**: a lo sender in its own network namespace sends through `wgclient` to a lo receiver behind `wgserver`; the kernel encrypts and decrypts on all CPUs and each packet crosses the network stack twice (inner and outer).

| | scenario | ns/packet | Gbit/s | M packets/s | CPU ns/packet | vs plain UDP, no crypto | runs (ns/packet) |
|---|---|---:|---:|---:|---:|---:|---|
| ⬜ | plain UDP, no crypto | 4,940 | 2.27 | 0.202 | 6,350 | 1.00× | 4,760 / 5,115 / 4,940 |
| 🟦 | lo sanstun peers, single thread | 4,873 | 2.30 | 0.205 | 7,450 | 1.01× | 6,508 / 4,306 / 4,873 |
| 🟦 | lo sanstun peers, 1 crypto worker each | 3,459 | 3.24 | 0.289 | 13,250 | 1.43× | 3,768 / 3,459 / 3,247 |
| 🟩 | lo + kernel WireGuard (loss 17.8%) | 6,577 | 1.70 | 0.152 | 21,150 | 0.75× | 6,577 / 7,930 / 5,957 |

**Throughput** (Gbit/s of inner packets, higher is better)

```
⬜ plain UDP, no crypto                   █████████████████████████▏            2.27
🟦 lo sanstun peers, single thread        █████████████████████████▌            2.30
🟦 lo sanstun peers, 1 crypto worker each ████████████████████████████████████  3.24
🟩 lo + kernel WireGuard                  ██████████████████▉                   1.70
```

**CPU time per packet**, all CPUs (ns, lower is better)

```
⬜ plain UDP, no crypto                   ██████████▊                           6,350
🟦 lo sanstun peers, single thread        ████████████▋                         7,450
🟦 lo sanstun peers, 1 crypto worker each ██████████████████████▌               13,250
🟩 lo + kernel WireGuard                  ████████████████████████████████████  21,150
```

## Notes

- **CPU ns/packet** is the busy time of all CPUs (from `/proc/stat`) over the run divided by packets: the fair comparison between single-threaded, offloaded and kernel runs. It includes process start-up (~1-3%), and the offload rows include threads busy-spinning while they wait for each other.
- No batching anywhere yet (`sendmmsg`/`recvmmsg`, GSO/GRO): one syscall per packet is what section 2 measures, and it dominates.
