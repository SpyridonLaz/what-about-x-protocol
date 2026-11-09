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
