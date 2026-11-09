# Architecture

## Target
```text
index.html → main.ts ── hash router (#/p/<id>) ──▶ store (protocol, view, step, locale, theme)
                                                   │
        protocols/<family>.ts (structure + English) + i18n/messages/<locale>.json (lazy)
                                                   │
                       player (timeline) ──▶ NetworkView · SequenceView · PacketTable · StageBar · OverviewPanel
                                                   │
                                  ui/ components + styles/tokens.css
```

- One packet list per protocol drives every view; views never keep their own copy of the timeline.
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
