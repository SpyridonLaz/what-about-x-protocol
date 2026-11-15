import type { Family, Protocol } from './types';

/** Family whose colour a packet label uses. Unknown labels use the scenario's own family. */
const PROTO_FAMILY: Record<string, Family> = {
  HTTP: 'web', 'HTTP/2': 'web', 'HTTP/3': 'web', HTTPS: 'web', SSE: 'web',
  TCP: 'transport', UDP: 'transport', QUIC: 'transport',
  IP: 'network', IPv4: 'network', IPv6: 'network', ICMP: 'network', ICMPv6: 'network', ARP: 'network', NDP: 'network',
  DNS: 'naming', DHCP: 'naming', DoH: 'naming', DNSSEC: 'naming',
  SMTP: 'mail', POP3: 'mail', IMAP: 'mail',
  FTP: 'file', 'FTP-DATA': 'file', SMB: 'file', SMB2: 'file',
  SSH: 'remote',
  TLS: 'security', 'TLS 1.3': 'security', EAP: 'security', EAPOL: 'security', RADIUS: 'security', SAE: 'security', OAuth: 'security',
  '802.11': 'wireless', 'Wi-Fi': 'wireless',
  SOCKS5: 'proxy',
  WireGuard: 'vpn', IKEv2: 'vpn', ESP: 'vpn',
  WebSocket: 'realtime', STUN: 'realtime', ICE: 'realtime', DTLS: 'realtime', SRTP: 'realtime', SDP: 'realtime',
  NTP: 'infra', BGP: 'infra', Modbus: 'infra',
  MCP: 'ai', 'JSON-RPC': 'ai', A2A: 'ai', LLM: 'ai', Embed: 'ai', Vector: 'ai', Tool: 'ai', Index: 'ai',
  Task: 'ai', Result: 'ai', Text: 'ai', Tokens: 'ai', Vectors: 'ai', Logits: 'ai', Token: 'ai',
};

export function packetFamily(proto: string, p: Protocol): Family {
  return PROTO_FAMILY[proto] ?? p.family;
}

export function famVar(f: Family): string {
  return `var(--fam-${f})`;
}
