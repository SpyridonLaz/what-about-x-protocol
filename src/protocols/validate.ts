// Structural checks for protocol scenarios. Used by scripts/check-content.ts and tests.
import { EXAMPLES, exampleFor, validateExample } from '../examples';
import { EN_UI } from '../i18n/en';
import { NODE_KINDS } from '../icons/nodes';
import { FAMILIES, type Protocol } from './types';

export function validateProtocol(p: Protocol): string[] {
  const errs: string[] = [];
  const at = (msg: string) => errs.push(`[${p.id}] ${msg}`);
  if (!/^[a-z0-9-]+$/.test(p.id)) at(`id must be lowercase letters, digits and dashes`);
  if (!FAMILIES.includes(p.family)) at(`unknown family "${p.family}"`);
  if (!p.text.name || !p.text.desc || !p.text.format) at('missing name, desc or format text');

  const ids = new Set<string>();
  for (const nd of p.nodes) {
    if (ids.has(nd.id)) at(`duplicate node id "${nd.id}"`);
    ids.add(nd.id);
    if (!NODE_KINDS.includes(nd.kind)) at(`node "${nd.id}" has unknown kind "${nd.kind}"`);
    if (!(`node.${nd.label}` in EN_UI)) at(`node "${nd.id}" label "${nd.label}" has no node.${nd.label} string`);
    if (nd.x < 0 || nd.x > 12 || nd.y < 0 || nd.y > 6) at(`node "${nd.id}" is outside the 13×7 grid`);
  }
  const pos = new Set<string>();
  for (const nd of p.nodes) {
    const k = `${nd.x},${nd.y}`;
    if (pos.has(k)) at(`two nodes share grid position ${k}`);
    pos.add(k);
  }
  for (const [a, b] of p.links) {
    if (!ids.has(a) || !ids.has(b)) at(`link ${a}–${b} references a missing node`);
    if (a === b) at(`link ${a}–${b} connects a node to itself`);
  }

  const stageCount = p.text.stages.length;
  if (stageCount < 1) at('needs at least one stage');
  if (p.packets.length === 0) at('needs at least one packet');
  const seen = new Set<number>();
  let lastT = -Infinity;
  let lastStage = 0;
  p.packets.forEach((pk, i) => {
    const where = `packet ${i + 1}`;
    if (!ids.has(pk.from)) at(`${where}: unknown source "${pk.from}"`);
    if (!ids.has(pk.to)) at(`${where}: unknown destination "${pk.to}"`);
    if (pk.from === pk.to) at(`${where}: source and destination are the same`);
    if (!(pk.t >= lastT)) at(`${where}: time ${pk.t} goes backwards`);
    lastT = pk.t;
    if (!Number.isInteger(pk.stage) || pk.stage < 0 || pk.stage >= stageCount) at(`${where}: stage ${pk.stage} out of range`);
    if (pk.stage < lastStage) at(`${where}: stage goes backwards`);
    lastStage = pk.stage;
    if (!(pk.size >= 0)) at(`${where}: size must be ≥ 0`);
    if (!pk.proto || !pk.info) at(`${where}: missing protocol label or info`);
    seen.add(pk.stage);
  });
  for (let s = 0; s < stageCount; s++) if (!seen.has(s)) at(`stage ${s + 1} has no packets`);

  // Narration: one note per packet, none empty.
  const notes = p.text.notes;
  if (notes) {
    if (notes.length !== p.packets.length) at(`${notes.length} notes for ${p.packets.length} packets`);
    notes.forEach((note, i) => {
      if (!note.trim()) at(`note ${i + 1} is empty`);
    });
  }
  (p.text.ideas ?? []).forEach((idea, i) => {
    if (!idea.trim()) at(`key idea ${i + 1} is empty`);
  });
  for (const z of p.zones ?? []) {
    if (!(`zone.${z.label}` in EN_UI)) at(`zone "${z.label}" has no zone.${z.label} string`);
    if (!z.nodes.length) at(`zone "${z.label}" has no nodes`);
    for (const id of z.nodes) if (!ids.has(id)) at(`zone "${z.label}" references a missing node "${id}"`);
  }

  // Every node that sends or receives must be reachable over links (so the diagram can draw the path).
  const used = new Set(p.packets.flatMap((pk) => [pk.from, pk.to]));
  const adj = new Map<string, string[]>();
  for (const [a, b] of p.links) {
    adj.set(a, [...(adj.get(a) ?? []), b]);
    adj.set(b, [...(adj.get(b) ?? []), a]);
  }
  const start = p.packets[0]?.from;
  if (start) {
    const reach = new Set([start]);
    const q = [start];
    while (q.length) for (const nb of adj.get(q.shift()!) ?? []) if (!reach.has(nb)) (reach.add(nb), q.push(nb));
    for (const u of used) if (!reach.has(u)) at(`node "${u}" is not connected to the rest of the diagram`);
  }
  return errs;
}

export function validateAll(list: Protocol[]): string[] {
  const errs = list.flatMap(validateProtocol);
  for (const p of list) {
    const ex = exampleFor(p);
    if (ex) errs.push(...validateExample(p, ex));
  }
  for (const id of Object.keys(EXAMPLES)) if (!list.some((p) => p.id === id)) errs.push(`[${id}] example for an unknown protocol`);
  const ids = new Set<string>();
  for (const p of list) {
    if (ids.has(p.id)) errs.push(`[${p.id}] duplicate protocol id`);
    ids.add(p.id);
  }
  return errs;
}
