# Changelog

Newest first. One line per change.

## 2026-11-12
- The site now opens on the LLM API lesson instead of HTTP (`DEFAULT_ID`).
- AI lessons (AI entries only; the 33 network protocols are untouched): **Real example** switch in the diagram panel (key E) opens a pane next to the diagram with a mock screen ("what the user sees") and the full content of every message ("what is really sent"), in step with the player (`src/examples/`, `src/views/ExampleView.ts`). Payloads checked against the MCP 2026-07-28 and A2A v1.0 specifications.
- Narration under the diagram: one plain-language sentence per message (`notes` in `src/protocols/ai.ts`, `src/views/Narration.ts`); **Key ideas** (3 per AI entry) in the overview.
- Three new AI architecture entries: `agent-loop` (AI agent loop), `multi-agent` (orchestrator and subagents), `llm-inside` (how a transformer generates text, token by token). Catalogue: 40 entries, 7 AI.
- Network view: zones (who runs what), comet trail, flowing links, arrival pulse, "thinking" models. **Presentation mode** (key P or the header button): only stages + diagram, larger text. AI family listed first in the drawer.
- Skeptic: BLOCK, then PASS WITH NOTES after fixes (R-25 A2A streams begin with the Task object, R-26..R-31, R-33). Open: R-32 (the end-of-playback caret test passes without the fix; tester), S-8 (last narration step not announced after autoplay).
- 187 new strings in EN/EL/DE. New stylesheet `src/styles/lessons.css`.

## 2026-11-09
- Packet detail (dissector) like the reference site: clicking a sequence arrow, table row or step opens every layer and field with plain-language notes and a linked hex dump (`src/dissect/`, `src/views/PacketDetail.ts`); third diagram tab **Steps** (`src/views/StepsView.ts`); `?msg=<n>` deep links; ~250 new strings in EN/EL/DE.
- Git repo initialised on `main`; first commit.
- Skeptic PASS WITH NOTES: fixed V-1 (font self-hosted via @fontsource, no Google request), R-1 (reduced motion keeps timing), R-4 (search combobox ARIA), R-6 (menus closed on re-render), R-7 (A2A follow-up streams), R-8 (MCP _meta on tools/call), R-11 (sequence time format), S-3 (deploys never cancelled), S-4 (Greek “Διάστημα”, paused packet stays mid-flight). Open: R-2, R-3, R-9 (test gaps), R-5, R-10, R-13, S-1, S-2.
- Desktop layout fits one screen (no page scroll; stages + packet table always visible; overview card scrolls); isometric 3D grid behind the network view; all mentions of the original author removed.
- Release 1 built: Vite + TS app with network diagram, sequence view, packet table, stage bar, overview, search palette, protocol drawer, player (play/pause/step/speed), dark + light theme, hash routing.
- 37 scenarios: 33 network protocols + MCP (spec 2026-07-28), A2A (v1.0), LLM API with tool calling, RAG (pattern).
- Languages: English, Greek, German (auto-detected; Greek caps without tonos). The 31-language plan was dropped by the user.
- `npm run check` (content integrity + tests) and GitHub Pages workflow (`.github/workflows/pages.yml`).
- Project kicked off with `/project-kickoff`: `CLAUDE.md` + `.agentic/` (AGENT, readme, memory, decisions, todo, changelog, glossary, roadmap, architecture, design-system, user-flows, knowledge-model, deployment, risks).
