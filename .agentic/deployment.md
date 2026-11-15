# Deployment

## Website → GitHub Pages (not deployed yet)
Plan:
1. Create a GitHub repo (e.g. `protocol-explorer`) and push this folder.
2. Repo → Settings → Pages → Source: **GitHub Actions**.
3. Every push to `main` runs `.github/workflows/pages.yml`: `npm ci` → `npm run check` → `npm run build` → deploy `dist/`.
4. Site appears at `https://<user>.github.io/protocol-explorer/`.

Works locally but **not** in production:
- Absolute asset paths break under `/<repo>/` → Vite `base: './'` and hash routing (`#/p/<id>`) are required.
- Pages has no SPA rewrites → never use history-API routes.

Destructive or production-facing commands are confirmed with the user every time.

## Local preview with Laravel Herd
Herd serves this folder as `http://protocol-explorer.test`, but it can't run TypeScript (it sends `.ts` as `video/mp2t`, so the page stays blank). Herd's static driver serves `public/` when it exists, so run `npm run build:herd` (builds into `public/`, git-ignored) and reload. Rebuild after every change; for live reload use `npm run dev` (http://localhost:5173) instead.
