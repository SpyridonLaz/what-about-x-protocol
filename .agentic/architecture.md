# Architecture

## Target
```text
index.html → main.ts ── hash router (#/p/<id>[?msg=<n>]) ──▶ store (protocol, view, step, detail open, locale, theme)
                                                   │
        protocols/<family>.ts (structure + English) + i18n/messages/<locale>.json (lazy)
                                                   │
                       player (timeline) ──▶ NetworkView · SequenceView · StepsView · PacketTable · StageBar · OverviewPanel · Narration · ExampleView ◀── examples/
                                                   │                    └─ click a message ─▶ PacketDetail ◀── dissect/ (bytes + fields)
                                  ui/ components + styles/tokens.css
```

- One packet list per protocol drives every view; views never keep their own copy of the timeline.
- **Packet detail (dissector):** `src/dissect/` builds the bytes of one message from its packet entry, layer by layer (Ethernet or 802.11 → IPv4/IPv6 → TCP/UDP → app encoder), with real checksums. App encoders exist for DNS, HTTP/1.1, TLS, ICMP, ICMPv6, ARP, ESP; other protocols get a generic payload layer (text protocols as ASCII, others opaque). `dissect(protocol, i)` is pure and memoised. Field names/notes are `dis.*` i18n keys in `src/dissect/strings.ts`, written once per field and reused by every message. Example values (MACs, ISNs, IDs) are hashed from the protocol id, so they are stable and marked `E.G.`; bytes the lesson can't show are flagged opaque and drawn `··`.
- The detail view follows the player (`focusIndex`), so ‹ ›, ← → and Play move it; its message is kept in the URL as `?msg=<n>` (1-based) with `history.replaceState`, and Back closes it.
- When a scenario's `size` is smaller than the headers, the dissector reads it as the payload size, so the dissected frame can be bigger than the table's size (POP3/IMAP/WebSocket/FTP scenarios).
- **AI lessons:** an AI entry carries `text.notes` (one sentence per packet → `p.<id>.m<n>`), `text.ideas` (→ `p.<id>.k<n>`), optional `zones` (frames in the network view) and optional `local: true` (no dissector). `src/examples/ai.ts` holds one `Example` per AI entry: `wire` (full content of every message, same order as the packets) and `scene` (what appears on a mock screen, keyed by packet index). `sceneAt()` and `highlight()` are pure; `ExampleView` and `Narration` only follow the player. `validateAll` checks notes, zones and examples against the packets.
- Text is looked up by key through `i18n.t()`; a missing key falls back to English.
- Static site: no backend, no network calls except loading its own lazy chunks and web fonts.

## Stack
| Layer | Choice | Why |
|---|---|---|
| Build | Vite | Fast, simple static output |
| Language | TypeScript, no UI framework | User choice; small bundle |
| Rendering | DOM + inline SVG | Crisp diagrams, themable via CSS variables |
| Tests | Vitest | Same toolchain as Vite |
| Hosting | GitHub Pages via GitHub Actions | User choice |

## Today (2026-11-09)
| Piece | State |
|---|---|
| Everything | Being built (release 1) |
