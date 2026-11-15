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

### Domain views (`src/views/`)
| View | Use |
|---|---|
| StepsView | Third diagram tab: numbered list of messages grouped by stage; current row follows the player |
| PacketDetail | Dissector that replaces the main area: header (number, title, time · route · proto · size, ‹ › ✕), context line, layer bar (width = byte share), field list per layer (name, value, `E.G.` badge, note), hex dump with offset/hex/ASCII; hovering a field highlights its bytes and vice versa. Layer colours: link `--fam-infra`, IP `--fam-network`, TCP/UDP `--fam-transport`, TLS `--fam-security`, app = packet family. Stacks to one column below 1100 px. |

| Narration | Bar under the diagram (AI entries): `n/total`, FROM → TO, one sentence about the current message. Left border in the packet's family colour. |
| ExampleView | Pane right of the diagram (46%), opened by the Real example switch: mock window (traffic-light bar, chat bubbles, tool-call / result chips, status lines; live text types itself out) above a code block with the current message (syntax colours `tk-*` from tokens; uncovered top-down while the packet flies). Below 900 px it stacks under the diagram; between 900 and 1320 px it takes the overview card's place. |

### Lessons layer (`src/styles/lessons.css`)
- **Switch** (`.switch`, `role="switch"`): pill in the AI colour; glows when on, pulses three times when off to invite a click.
- **Zones** in the network view: dashed frame in `--fam-ai` with a mono label above its top-left corner.
- **Motion:** comet trail behind the packet, dashes flowing along the active link in the packet's direction, a ring when a packet arrives, pulsing sparkle on a model/agent that has just received something. All of it is off under `prefers-reduced-motion`.
- **Presentation mode** (`html.is-present`): hides overview, packet table and search; larger narration and example text.
- **Key ideas:** numbered cards in the AI colour, between the description and the facts.

## Target devices
Phone (375 px) to desktop; no horizontal page scroll; diagrams scale to width.

## Avoid
Literal colours or font sizes in components; animation when `prefers-reduced-motion` is set; uppercase transforms that drop Greek accents.
