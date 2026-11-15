# User flows

1. **Watch a protocol (visitor):** open site → the LLM API lesson loads by default → press Play → packets animate, table rows highlight, stage bar advances.
2. **Pick another protocol (visitor):** drawer or search (`/` or Ctrl+K) → choose → URL becomes `#/p/<id>` → scenario resets.
3. **Step through (visitor):** Step / ‹ › → one packet at a time; click a stage to jump there.
4. **Switch view (visitor):** Network ↔ Sequence ↔ Steps; player position is kept.
5. **Inspect a message (visitor):** click a sequence arrow (or Enter on it), a table row or a Steps row → the packet detail replaces the main area: every layer and field explained, hex dump linked on hover → ‹ › or ← → move to other messages, Play keeps it following → ✕, Esc or browser Back returns. URL `#/p/<id>?msg=<n>` opens it directly.
6. **Change language (visitor):** auto-detected on first visit → language menu → choice remembered.
7. **Change theme (visitor):** sun / moon buttons → choice remembered.
8. **See a real example (visitor, AI entries):** turn on the Real example switch in the diagram panel (or press E) → the pane shows the mock screen and the full message for the current step → Play or ← → keeps both in step with the diagram → switch off to get the wide diagram back. The choice is remembered.
9. **Present to a class (teacher):** open an AI entry → P (or the header button) for presentation mode → E for the real example → step with → and read the narration aloud → Esc or P to leave.
