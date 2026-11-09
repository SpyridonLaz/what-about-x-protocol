# Changelog

Newest first. One line per change.

## 2026-11-09
- Git repo initialised on `main`; first commit.
- Skeptic PASS WITH NOTES: fixed V-1 (font self-hosted via @fontsource, no Google request), R-1 (reduced motion keeps timing), R-4 (search combobox ARIA), R-6 (menus closed on re-render), R-7 (A2A follow-up streams), R-8 (MCP _meta on tools/call), R-11 (sequence time format), S-3 (deploys never cancelled), S-4 (Greek “Διάστημα”, paused packet stays mid-flight). Open: R-2, R-3, R-9 (test gaps), R-5, R-10, R-13, S-1, S-2.
- Desktop layout fits one screen (no page scroll; stages + packet table always visible; overview card scrolls); isometric 3D grid behind the network view; all mentions of the original author removed.
- Release 1 built: Vite + TS app with network diagram, sequence view, packet table, stage bar, overview, search palette, protocol drawer, player (play/pause/step/speed), dark + light theme, hash routing.
- 37 scenarios: 33 network protocols + MCP (spec 2026-07-28), A2A (v1.0), LLM API with tool calling, RAG (pattern).
- Languages: English, Greek, German (auto-detected; Greek caps without tonos). The 31-language plan was dropped by the user.
- `npm run check` (content integrity + tests) and GitHub Pages workflow (`.github/workflows/pages.yml`).
- Project kicked off with `/project-kickoff`: `CLAUDE.md` + `.agentic/` (AGENT, readme, memory, decisions, todo, changelog, glossary, roadmap, architecture, design-system, user-flows, knowledge-model, deployment, risks).
