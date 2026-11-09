import { definePackets, n, type Protocol } from './types';

// Shared home-network layout: client → home router → internet → servers.
const client = n('c', 'laptop', 'client', '192.168.1.10', 1, 3);
const router = n('r', 'router', 'homeRouter', '192.168.1.1', 3, 3);
const internet = n('i', 'cloud', 'internet', undefined, 6, 3);
const resolver = n('d', 'dns', 'dnsResolver', '192.0.2.53', 6, 0);
const web = n('w', 'server', 'webServer', '203.0.113.10', 10, 3);

export const WEB: Protocol[] = [
  {
    id: 'http',
    short: 'HTTP',
    family: 'web',
    kind: 'protocol',
    facts: { layer: 'l7', port: '80', transport: 'TCP', methods: 'GET, POST, PUT, DELETE, HEAD', spec: 'RFC 9110, RFC 9112' },
    nodes: [client, router, internet, resolver, web],
    links: [['c', 'r'], ['r', 'i'], ['i', 'd'], ['i', 'w']],
    packets: definePackets([
      [0.0, 'c', 'd', 'DNS', 'Standard query 0x1a2b A www.example.com', 74, 0],
      [0.018, 'd', 'c', 'DNS', 'Standard query response 0x1a2b A 203.0.113.10', 90, 0],
      [0.02, 'c', 'w', 'TCP', '51544 → 80 [SYN] Seq=0 Win=64240 MSS=1460', 66, 1],
      [0.041, 'w', 'c', 'TCP', '80 → 51544 [SYN, ACK] Seq=0 Ack=1 Win=65535', 66, 1],
      [0.041, 'c', 'w', 'TCP', '51544 → 80 [ACK] Seq=1 Ack=1', 54, 1],
      [0.042, 'c', 'w', 'HTTP', 'GET /index.html HTTP/1.1  Host: www.example.com', 412, 2],
      [0.063, 'w', 'c', 'TCP', '80 → 51544 [ACK] Seq=1 Ack=359', 54, 2],
      [0.071, 'w', 'c', 'HTTP', 'HTTP/1.1 200 OK  (text/html, 9 segments)', 12890, 3],
      [0.072, 'c', 'w', 'TCP', '51544 → 80 [ACK] Seq=359 Ack=12837', 54, 3],
      [5.1, 'c', 'w', 'TCP', '51544 → 80 [FIN, ACK] Seq=359 Ack=12837', 54, 4],
      [5.121, 'w', 'c', 'TCP', '80 → 51544 [FIN, ACK] Seq=12837 Ack=360', 54, 4],
      [5.121, 'c', 'w', 'TCP', '51544 → 80 [ACK] Seq=360 Ack=12838', 54, 4],
    ]),
    text: {
      name: 'Hypertext Transfer Protocol',
      desc: 'HTTP is the language of the web. A client asks for a resource such as a page, image or API result, and the server answers with a status code, headers and usually a body. Each exchange is one request and one response; in HTTP/1.1 they are plain, readable text.',
      format: 'Text (headers + optional body)',
      stages: [
        ['Find the server', 'DNS turns the name into an IP address'],
        ['Open a connection', 'TCP three-way handshake'],
        ['Send the request', 'Method, path and headers'],
        ['Receive the response', 'Status code, headers and the page'],
        ['Close the connection', 'Both sides finish with FIN'],
      ],
    },
    tags: ['web', 'browser', 'request', 'response', 'rest'],
  },
  {
    id: 'https',
    short: 'HTTPS',
    family: 'web',
    kind: 'protocol',
    facts: { layer: 'l7', port: '443', transport: 'TCP + TLS', methods: 'GET, POST, PUT, DELETE, HEAD', spec: 'RFC 9110, RFC 9113, RFC 8446' },
    nodes: [client, router, internet, resolver, web],
    links: [['c', 'r'], ['r', 'i'], ['i', 'd'], ['i', 'w']],
    packets: definePackets([
      [0.0, 'c', 'd', 'DNS', 'Standard query 0x5c01 A www.example.com', 74, 0],
      [0.017, 'd', 'c', 'DNS', 'Standard query response 0x5c01 A 203.0.113.10', 90, 0],
      [0.019, 'c', 'w', 'TCP', '51602 → 443 [SYN] Seq=0 MSS=1460', 66, 1],
      [0.04, 'w', 'c', 'TCP', '443 → 51602 [SYN, ACK] Seq=0 Ack=1', 66, 1],
      [0.04, 'c', 'w', 'TCP', '51602 → 443 [ACK] Seq=1 Ack=1', 54, 1],
      [0.041, 'c', 'w', 'TLS', 'Client Hello (SNI=www.example.com, ALPN=h2, key_share x25519)', 571, 2],
      [0.062, 'w', 'c', 'TLS', 'Server Hello, Change Cipher Spec, Encrypted Extensions, Certificate, Certificate Verify, Finished', 4182, 2],
      [0.064, 'c', 'w', 'TLS', 'Change Cipher Spec, Finished', 134, 2],
      [0.065, 'c', 'w', 'HTTP/2', 'HEADERS[1]: GET /  (encrypted in TLS Application Data)', 210, 3],
      [0.088, 'w', 'c', 'HTTP/2', 'HEADERS[1]: 200 OK, DATA[1] text/html  (encrypted)', 13120, 3],
      [0.089, 'c', 'w', 'TCP', '51602 → 443 [ACK]', 54, 3],
      [3.2, 'c', 'w', 'TLS', 'Alert (close_notify)', 78, 4],
      [3.201, 'c', 'w', 'TCP', '51602 → 443 [FIN, ACK]', 54, 4],
      [3.222, 'w', 'c', 'TCP', '443 → 51602 [FIN, ACK]', 54, 4],
    ]),
    text: {
      name: 'HTTP Secure (HTTP over TLS)',
      desc: 'HTTPS is HTTP wrapped in TLS. Before any request is sent, client and server agree on keys and the server proves its identity with a certificate. Everything after the handshake — URLs, headers, cookies and bodies — is encrypted, so the network only sees the server address and the size of the traffic.',
      format: 'Binary frames (HTTP/2) inside encrypted TLS records',
      stages: [
        ['Find the server', 'DNS lookup of the host name'],
        ['Open a connection', 'TCP three-way handshake'],
        ['Secure the channel', 'TLS 1.3 handshake and certificate check'],
        ['Encrypted request and response', 'HTTP/2 frames inside TLS'],
        ['Close securely', 'close_notify, then TCP FIN'],
      ],
    },
    tags: ['ssl', 'secure', 'web', 'padlock', 'certificate', 'http2'],
  },
];
