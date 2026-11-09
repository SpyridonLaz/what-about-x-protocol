# Knowledge model — domain

## Protocol entry
- Has an id, a family, a kind (`protocol` or `pattern`), facts (layer, default port, transport, data format, methods, defining spec) and one scenario.
- 37 entries. Network: http, https, tcp, udp, ip, ipv6, icmp, dns, dhcp, doh, dnssec, smtp, pop3, imap, ftp, smb, ssh, tls, websocket, webrtc, wifi, wpa3, portal, proxy, socks, reverse, wireguard, ipsec, quic, ntp, radius, bgp, modbus. AI: mcp, a2a, llm-api, rag (pattern).

## Scenario
- Nodes placed on a grid; links between them; 3–6 stages; an ordered packet list.
- Every packet's source and destination is a node of the scenario; times never decrease; every stage has at least one packet.

## Packet
- Time, from, to, protocol label, info line (wire-level text, not translated), size, stage.
