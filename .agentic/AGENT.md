# AGENT.md — Protocol Explorer agent entry point

Protocol Explorer is an interactive teaching website for students, developers and curious people who want to see how internet and AI protocols work, step by step. It is an original build (feature reference: https://protocol-explorer-alpha.vercel.app/), extended with AI protocols (MCP, A2A, LLM API + tool calling) and the RAG pattern.

## Reading order
1. `readme.md` — what it is, its scope
2. `architecture.md` — how the pieces connect
3. `knowledge-model.md` + `glossary.md` — protocols, scenarios, packets
4. `design-system.md` — visual rules (mandatory for UI work)
5. `memory.md`, `decisions.md` — standing rules and past choices (never re-propose rejected ideas)
6. `roadmap.md`, `todo.md` — what's open
7. `risks.md` — open risks (written by the `skeptic` subagent; read before touching the code it names)
8. `user-flows.md`, `deployment.md`, `changelog.md` — as needed

## Hard rules
- **One fact, one place.** Link, don't copy.
- **New code only.** The original site's source is not available; never paste or de-minify its bundle. Use it as a feature reference.
- **Protocol structure and English text live together** in `src/protocols/<family>.ts`; UI English in `src/i18n/en.ts`; Greek and German in `src/i18n/messages/<locale>.json`. Missing keys fall back to English; `npm run check` fails if a locale misses or adds a key.
- **Facts must be correct.** Ports, RFCs, message names and spec versions are checked against the spec before writing. Addresses use documentation ranges only (RFC 5737 / RFC 3849 / private ranges).
- **No literal colours in components**; only tokens from `src/styles/tokens.css`.
- **Static only:** no server, no secrets, no tracking. Must build with `base: './'` and hash routing so it runs under any sub-path (GitHub Pages).
- Mark invented/sample values as placeholders and ask the user for real ones.
- After each change, keep `todo.md`, `changelog.md` and `decisions.md` current.

## How to run
- Install: `npm install`
- Dev server: `npm run dev`
- Checks (content integrity + unit tests): `npm run check`
- Build / preview: `npm run build` · `npm run preview`

## Analysis rules
- Source of truth for data: `src/protocols/*.ts` (structure + English text), `src/i18n/messages/*.json` (translations)
- Ignore when analyzing: `node_modules/`, `dist/`
- Changelog prefix: none (single folder)
