// Hash routing (#/p/<id>) — GitHub Pages has no SPA rewrites, so history routes would 404.

export function parseHash(hash: string): string | null {
  const m = /^#\/p\/([a-z0-9-]+)\/?$/i.exec(hash.trim());
  return m ? m[1].toLowerCase() : null;
}

export function hashFor(id: string): string {
  return `#/p/${id}`;
}

export function onRoute(fn: (id: string | null) => void): () => void {
  const handler = () => fn(parseHash(location.hash));
  window.addEventListener('hashchange', handler);
  return () => window.removeEventListener('hashchange', handler);
}

export function navigate(id: string): void {
  const next = hashFor(id);
  if (location.hash !== next) location.hash = next;
}
