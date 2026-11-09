# Risks, vulnerabilities and suggestions

Maintained by the `skeptic` subagent (the only file it writes). Others fix the issues; the skeptic marks rows `fixed <date>` when a later review proves the fix. Rows are never deleted.
Severity: CRITICAL · HIGH · MEDIUM · LOW. Status: `open` · `fixed <YYYY-MM-DD>` · `accepted` (user chose to live with it — say why).

## Vulnerabilities
Security issues: injection, missing authorization, unvalidated input, secrets in logs, data exposure.

| Id | Date | Severity | Target | Finding | Evidence | Owner | Status |
|---|---|---|---|---|---|---|---|
| V-1 | 2026-11-09 | MEDIUM | index.html:10-12, src/i18n/i18n.ts loadFont() | Every visit loads JetBrains Mono from fonts.googleapis.com/gstatic.com. That breaks the "no tracking" hard rule and sends visitor IPs to Google; a German court (LG München I, 3 O 17493/20) ruled this a GDPR violation, and German is a target locale. | index.html:12 `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono...">`; self-host the font instead | user / main agent | open |

## Risks
Bugs, contract breaks, state/concurrency/data issues, false-passing or flaky tests, coverage gaps.

| Id | Date | Severity | Target | Finding | Evidence | Owner | Status |
|---|---|---|---|---|---|---|---|
| R-1 | 2026-11-09 | MEDIUM | src/app.ts:44 (`reducedMotion() ? 1 : 900`) | With prefers-reduced-motion, Play runs the whole scenario in the first frame (packetMs=1, about 16 packets per 16 ms frame). Reduced-motion users get no step-by-step playback and land straight on "Done". | Probe: `new Player(12, 1, fakeClock)`, play(), advance 16 ms → index 11, playing false | main agent | open |
| R-2 | 2026-11-09 | MEDIUM | tests/i18n.test.ts "stale result is ignored" | The test passes even without the guard it is meant to cover. | Mutation: deleting `if (seq !== requestSeq) return;` in i18n.ts → this test still passes (the only failure was the unrelated key-count test). The loads never resolve out of order; the test needs a controllable or deferred loader | tester | open |
| R-3 | 2026-11-09 | MEDIUM | src/app.ts, src/ui/components.ts, src/views/*.ts | Zero tests cover the shell, the components or the DOM views: render() cleanup on re-render, keyboard shortcuts, Menu/Dialog/SegmentedControl, row click to seek, StageBar state. The 137 tests only cover pure helpers. | No test file imports app.ts, components.ts or any view module | tester | open |
| R-4 | 2026-11-09 | MEDIUM | src/app.ts search palette | The search palette is not accessible to screen readers. The input has no role=combobox, aria-controls or aria-activedescendant, and the options are not focusable, so moving the selection with ArrowUp/Down is never announced. | Probe: palette input attributes = type, class, placeholder, aria-label, autocomplete, spellcheck only | main agent | open |
| R-5 | 2026-11-09 | LOW | src/app.ts render() | Changing the language (or the protocol) rebuilds the DOM and drops focus to `<body>`. Keyboard and screen-reader users lose their place. | Probe (jsdom): open language menu, click 'de' item → document.activeElement = BODY | main agent | open |
| R-6 | 2026-11-09 | LOW | src/ui/components.ts Menu open()/close() | If render() runs while a menu is open (e.g. Back button → hashchange with the speed menu open), the capture `pointerdown` listener stays on `document` for the removed menu until the next pointerdown. | Probe: open speed menu, change hash → document listeners added {keydown:7, pointerdown:1}, removed {keydown:6} | main agent | open |
| R-7 | 2026-11-09 | MEDIUM | src/protocols/ai.ts a2a scenario (SUSPECTED) | Probably the wrong A2A streaming flow. The SSE stream should end when the task reaches INPUT_REQUIRED, and the follow-up is a non-streaming SendMessage, yet later artifactUpdate/statusUpdate still arrive as SSE events with no stream open. | Spec reading only; check against the A2A v1.0 text. A fix would be to make the follow-up SendStreamingMessage or add SubscribeToTask | main agent | open |
| R-8 | 2026-11-09 | LOW | src/protocols/ai.ts mcp scenario (SUSPECTED) | The MCP 2026-07-28 details (stateless, server/discover, no initialize) cannot be checked against a recorded source. The scenario also contradicts itself: tools/list carries the `_meta` protocolVersion but tools/call does not. | No spec URL recorded; compare the packet payloads in ai.ts | main agent / user | open |
| R-9 | 2026-11-09 | LOW | tests/protocols.test.ts validateProtocol | The validator's stage-going-backwards rule is not tested. | Mutation: `if (pk.stage < lastStage)` → `if (false)` in validate.ts → all 24 protocol tests still pass | tester | open |
| R-10 | 2026-11-09 | LOW | src/styles/app.css:354,359 (SUSPECTED) | The desktop no-scroll layout sets `html, body { overflow: hidden }` at ≥900x600 and clamps .stage-sub to 1 line. Anything that doesn't fit (large default font size, long German strings) gets clipped with no page-scroll fallback, which risks WCAG 1.4.4/1.4.10. | Reasoning from the CSS: panels scroll internally, but the header, stage bar and player bar do not | main agent | open |
| R-11 | 2026-11-09 | LOW | src/views/SequenceView.ts time label | Sequence view times use `toFixed(3)` while PacketTable uses Intl, so in German the two views disagree ("1.235" vs "1,235"). | Code comparison: SequenceView `pk.t.toFixed(3)` vs PacketTable Intl.NumberFormat | main agent | open |
| R-12 | 2026-11-09 | LOW | tests/i18n.test.ts key-count test | The hard-coded English key count (553, now 552) breaks on every key added or removed and proves nothing about parity. | Count changed during this review when app.credit was removed | tester | open |
| R-13 | 2026-11-09 | LOW | src/app.ts:24, 261 | The draft-translation note asks users to report mistakes, but REPO_URL is '' so no link is rendered and there is nowhere to report. | `const REPO_URL = '';` | user | open |

## Suggestions
Concrete improvements that aren't defects.

| Id | Date | Target | Suggestion | Why | Owner | Status |
|---|---|---|---|---|---|---|
| S-1 | 2026-11-09 | src/app.ts:285-287, src/ui/components.ts:88-89, src/styles/app.css:314-316 | Remove the RTL branches, since only LTR locales (en/el/de) remain, or comment that they are kept on purpose. | Dead, untested code | main agent | open |
| S-2 | 2026-11-09 | src/views/NetworkView.ts:74-82 | Replace the literal `#fff` stops with a token or class (rule: no literal colours), and give the iso-grid/iso-fade/iso-mask ids a per-instance suffix. | The fixed ids are safe today only because one NetworkView is mounted at a time | main agent | open |
| S-3 | 2026-11-09 | .github/workflows/pages.yml:15 | Set `cancel-in-progress: false`, as GitHub's Pages starter workflow does, so a new push cannot abort a running deploy. | Avoids a half-finished deployment | main agent | open |
| S-4 | 2026-11-09 | src/i18n/locales el `ui.keyboard` | Translate "Space" (Διάστημα); it is left in English. Also keep the packet position when pausing mid-flight in NetworkView, so the packet does not snap back. | Sampled translation and visual check | main agent | open |

## Review log
| Date | Reviewed | Vulnerabilities / Risks / Suggestions added | Verdict |
|---|---|---|---|
| 2026-11-09 | Full review: core, i18n, protocols, views, ui, app.ts (incl. credit removal, no-scroll layout, isoFloor), tests, Pages workflow | 1 / 13 / 4 | PASS WITH NOTES |
