# Fair traffic: kernel WireGuard vs wireguard-go vs lo + sanstun on TUN

2026-11-05 00:04 UTC · Linux version 6.18.55 · 4 × Intel(R) Xeon(R) Processor @ 1.60GHz · lo 0.0.37-pre (V8 15.6.75.19) · guest_halt_poll_ns 200000 · 3 rounds, medians

A lo sender in its own network namespace behind `wgclient`, a lo receiver behind `wgserver`, the encrypted UDP over 127.0.0.1; every tunnel device at MTU 1420. "plain" is the same sender and receiver over loopback without a tunnel or namespace.

## Round-trip time (ping-pong, 64 B UDP payload, 20,000 round trips)

| implementation | p50 µs | p90 µs | p99 µs | p99.9 µs | mean µs | lost |
|---|---:|---:|---:|---:|---:|---:|
| plain loopback, no tunnel (reference) | 7.8 | 24.1 | 42.2 | 84.9 | 11.0 | 0 |
| kernel WireGuard | 32.8 | 51.4 | 90.7 | 580.1 | 37.9 | 0 |
| wireguard-go | 97.3 | 126.0 | 166.7 | 243.2 | 102.5 | 0 |
| lo + sanstun on TUN (gso,vnet,tcpco) | 29.9 | 42.6 | 91.7 | 354.4 | 34.0 | 0 |
| lo + sanstun on TUN (gso,vnet,offload,tcpco) | 29.8 | 45.0 | 105.3 | 364.5 | 34.5 | 0 |

## Paced UDP (1,400 B packets, one `send` each; highest achieved rate with loss <= 0.1%)

| implementation | loss-free Gbit/s (median) | runs | loss per step (median, achieved Gbit/s: loss) |
|---|---:|---|---|
| plain loopback, no tunnel (reference) | 6.00 | 6.00 / 6.00 / 6.00 | 0.50: 0.00% · 1.00: 0.00% · 1.50: 0.00% · 2.00: 0.00% · 2.50: 0.00% · 3.00: 0.00% · 3.50: 0.00% · 4.00: 0.00% · 5.00: 0.00% · 6.00: 0.00% |
| kernel WireGuard | 1.50 | 1.50 / 1.50 / 1.50 | 0.50: 0.00% · 1.00: 0.00% · 1.50: 0.00% · 2.00: 0.91% · 2.50: 2.55% · 2.93: 14.51% · 3.18: 23.36% · 3.09: 23.39% · 3.08: 24.52% · 3.17: 22.89% |
| wireguard-go | 1.00 | 1.00 / 1.00 / 1.00 | 0.50: 0.00% · 1.00: 0.00% · 1.50: 9.99% · 2.00: 35.50% · 2.50: 50.16% · 3.00: 58.58% · 3.50: 65.63% · 4.00: 73.33% · 5.00: 74.76% · 6.00: 79.82% |
| lo + sanstun on TUN (gso,vnet,tcpco) | 3.50 | 4.00 / 3.50 / 1.50 | 0.50: 0.00% · 1.00: 0.00% · 1.50: 0.00% · 2.00: 0.00% · 2.50: 0.21% · 3.00: 0.00% · 3.50: 0.50% · 4.00: 1.40% · 5.00: 18.39% · 6.00: 33.22% |
| lo + sanstun on TUN (gso,vnet,offload,tcpco) | 3.50 | 3.50 / 2.00 / 3.50 | 0.50: 0.00% · 1.00: 0.00% · 1.50: 0.00% · 2.00: 0.00% · 2.50: 0.00% · 3.00: 0.00% · 3.50: 0.01% · 4.00: 11.34% · 5.00: 29.42% · 6.00: 38.27% |

## TCP (one connection, 1,024 MB in 64 KB writes)

| implementation | Gbit/s (median) | runs | CPU µs per MB, all CPUs |
|---|---:|---|---:|
| plain loopback, no tunnel (reference) | 47.75 | 62.55 / 47.75 / 38.83 | 313 |
| kernel WireGuard | 4.51 | 4.51 / 3.32 / 4.78 | 6,816 |
| wireguard-go | 3.81 | 4.02 / 3.54 / 3.81 | 6,846 |
| lo + sanstun on TUN (gso,vnet,tcpco) | 2.98 | 2.98 / 2.58 / 3.33 | 4,922 |
| lo + sanstun on TUN (gso,vnet,offload,tcpco) | 4.06 | 4.08 / 3.55 / 4.06 | 4,531 |
