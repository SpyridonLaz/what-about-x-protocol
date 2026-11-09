# Design system

## Direction
Dark blueprint: deep navy background with a faint grid, cyan line art, monospace uppercase labels, framed panels with corner ticks. Close to the original Protocol Explorer, with a refined, accessible colour system and a light theme.

## Type
- Display / labels: JetBrains Mono (uppercase, letter-spaced)
- Body: system sans stack. Greek all-caps drop the tonos via `caps()` in `src/i18n/i18n.ts` (see `../../.agentic/knowledge/greek-i18n.md`); never rely on CSS `text-transform` for translated labels.

## Tokens
Names: `--bg`, `--bg-grid`, `--surface`, `--surface-2`, `--line`, `--line-strong`, `--text`, `--muted`, `--accent`, `--accent-text`, `--focus`, `--fam-<family>`, `--space-*`, `--radius-*`, `--dur-*`. Exact values live in `src/styles/tokens.css`. Never hardcode colours in components.

## Components (`src/ui/`)
| Component | Use |
|---|---|
| Button / IconButton | All clickable actions; variants `primary`, `ghost` |
| SegmentedControl | Network/Sequence switch, speed |
| Panel | Framed section with a mono title and corner ticks |
| Menu | Dropdown lists (language picker, protocol drawer) |
| Dialog | Search palette |
| Badge | ACTIVE, PATTERN, family tags |
| KeyValueGrid | Protocol facts |
| DataTable | Packet table |
| Tooltip / Toast | Hints and short notices |

## Target devices
Phone (375 px) to desktop; no horizontal page scroll; diagrams scale to width.

## Avoid
Literal colours or font sizes in components; animation when `prefers-reduced-motion` is set; uppercase transforms that drop Greek accents.
