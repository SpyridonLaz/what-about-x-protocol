// Hash routing (#/p/<id>, #/p/<id>?msg=<n>) — GitHub Pages has no SPA rewrites, so history routes would 404.

const ROUTE = /^#\/p\/([a-z0-9-]+)\/?(?:\?msg=(\d{1,4}))?$/i;

export function parseHash(hash: string): string | null {
  const m = ROUTE.exec(hash.trim());
  return m ? m[1].toLowerCase() : null;
}

/** 0-based message index opened in the packet detail view, or null. The URL counts from 1. */
export function parseMsg(hash: string): number | null {
  const m = ROUTE.exec(hash.trim());
  if (!m?.[2]) return null;
  const n = Number(m[2]);
  return n >= 1 ? n - 1 : null;
}

export function hashFor(id: string, msg?: number | null): string {
  return msg === undefined || msg === null ? `#/p/${id}` : `#/p/${id}?msg=${msg + 1}`;
}

export function onRoute(fn: (id: string | null) => void): () => void {
  const handler = () => fn(parseHash(location.hash));
  window.addEventListener('hashchange', handler);
  return () => window.removeEventListener('hashchange', handler);
}

export function navigate(id: string, msg?: number | null): void {
  const next = hashFor(id, msg);
  if (location.hash !== next) location.hash = next;
}

/** Change the URL without a history entry or a hashchange event (e.g. stepping inside the detail view). */
export function replaceHash(id: string, msg?: number | null): void {
  const next = hashFor(id, msg);
  if (location.hash !== next) history.replaceState(history.state, '', next);
}
