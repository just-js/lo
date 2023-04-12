sudo ./spin wg-demo.js up
ping -I wgclient 10.0.0.1
sudo module/wireguard/deps/wireguard-tools-master/src/wg show
to sniff
sudo ./spin util/example/sniff.js wgclient
sudo ./spin util/example/sniff.js wgserver
sudo ./spin wg-demo.js down


