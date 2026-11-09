# Protocol Explorer

Interactive website that teaches how internet and AI protocols work, step by step.

## Goal
A free, fast, multilingual site where anyone can pick a protocol and watch it run: who talks to whom, which packets flow, in what order and why.
**Success looks like:** all 37 entries live on GitHub Pages in English, Greek and German, working on phone and desktop, with the AI section (MCP, A2A, LLM API, RAG) as the part the original didn't have.

## Who it's for
Students, developers, IT/security learners and curious people. The UI language follows the visitor's system language.

## Scope
| Item | What it does / contains | Priority |
|---|---|---|
| Network view | Animated diagram of the nodes in a scenario, packets travelling along links | must |
| Sequence view | The same packets as a sequence diagram | must |
| Packet table | Wireshark-style list (no., time, source, destination, protocol, info, size) synced with the player | must |
| Player | Play / pause / step / reset, speed 0.5×–2× | must |
| Stage bar | Numbered stages of the scenario; click to jump | must |
| Protocol overview | Description and facts (layer, port, transport, format, methods, spec) | must |
| Search | Find a protocol by name, id or family | must |
| Languages | English, Greek, German; auto-detected, English fallback | must |
| Theme | Dark blueprint (default) + light | must |
| 33 network protocols | HTTP … WebRTC (list in `knowledge-model.md`) | must |
| AI flows | MCP, A2A, LLM API + tool calling, RAG (pattern) | must |

**Out of scope:** capturing real traffic, accounts/logins, a backend, user-generated scenarios.

## Status
Rewrite / port — started 2026-11-09.
