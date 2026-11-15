# Decisions

Never re-propose a rejected or superseded idea without new information.

## Open (ask the user; recommendation in brackets)
| Question | Options |
|---|---|
| Who reviews the machine-drafted translations? | **[ship as drafts, invite native-speaker fixes via GitHub issues]** · review before launch |
| Real examples for the 33 network protocols? | **[later, on request]** · never |

## Standing
| Date | Decision | Why |
|---|---|---|
| 2026-11-09 | Build on the reference site's idea; user states they have permission | User statement; not verified by us |
| 2026-11-09 | No attribution or author mention anywhere in the app or docs | User choice |
| 2026-11-09 | Rebuild from scratch with new code | Original source not available (only a minified bundle) |
| 2026-11-09 | Vite + TypeScript, no framework | User choice; small and fast like the original |
| 2026-11-09 | Host on GitHub Pages | User choice |
| 2026-11-09 | One git repo `protocol-explorer`, default branch `main` | User choice |
| 2026-11-09 | Languages: English, Greek, German — auto-detected from the system language, English fallback | User choice (replaced the 31-language plan) |
| 2026-11-09 | Add AI section: MCP, A2A, LLM API + tool calling, RAG (labelled a pattern, not a protocol) | User choice |
| 2026-11-09 | Everything (37 entries, 3 languages) in release 1 | User choice |
| 2026-11-09 | Look close to the original blueprint style, refined colours, reusable components | User choice |
| 2026-11-09 | Greek and German text is drafted by the agent | No translators available; marked as drafts in the footer |
| 2026-11-09 | Packet info lines (wire text like `GET / HTTP/1.1`) are never translated | They show real protocol bytes, as in Wireshark |
| 2026-11-12 | The site is presented to students; the AI protocols and architectures are the focus. New work goes into the AI entries only until the user says otherwise | User instruction ("don't develop the non-AI technologies yet") |
| 2026-11-12 | "Real example" is a switch in the diagram panel, available only where an example has been written (the 7 AI entries) | User asked for a toggle that shows a real example inside the presentation window |
| 2026-11-12 | Real-example content (mock screen text and wire payloads) is never translated; its labels and the narration are | Same rule as packet info lines: it is example data, and it must match the wire text |
| 2026-11-12 | The site opens on `llm-api` (`DEFAULT_ID` in `src/app.ts`); the brand link goes there too | User choice: AI is the focus of the lessons |
| 2026-11-12 | `llm-inside` has `local: true`: its messages cannot be opened in the packet dissector | The steps happen inside one program; an Ethernet/IP dissection would teach something false |

## Superseded
| Was | Replaced by |
|---|---|
| Project type "Research / analysis" (first kickoff answer) | Software: web app (user clarified after sharing the reference site) |
| 30 most-spoken languages + Greek (31 locales) | English, Greek, German only (2026-11-09, user: ~670k characters of translation was too much) |
