# Roadmap

1. **Release 1 (in progress, started 2026-11-09):** engine + all 37 entries + English/Greek/German + GitHub Pages deploy.
   - **Next session:** see `todo.md` → Next.
2. **Translation review:** native-speaker fixes to the drafted Greek and German text; more languages only on request.
3. **Dissector rollout:** full app-layer encoders (field-by-field, like DNS/HTTP/TLS today) in batches — (a) DHCP, NTP, QUIC/HTTP/3, WireGuard, IKEv2/ESP; (b) SMTP/IMAP/POP3/FTP line-by-line, SSH, SMB2, BGP, Modbus, SOCKS5, RADIUS; (c) 802.11 management bodies, EAPOL/SAE; (d) AI: MCP/A2A/LLM JSON-RPC bodies (shown as the decrypted view inside TLS). Optionally align scenario `size` values with real frame sizes.
4. **More scenarios:** variants per protocol (errors, retries, attacks) and more AI protocols as they appear.
5. **AI lessons (started 2026-11-12):** narration, key ideas, real examples and architecture entries for the AI family; presentation mode for teaching. Network protocols get the same treatment only when the user asks.
