import { defineConfig } from 'vite';

// base './' keeps every asset path relative, so the build works on GitHub Pages
// under /<repo>/ and on any other static host without changes.
export default defineConfig({
  base: './',
  // No static-asset folder: `public/` is the Laravel Herd build output (npm run build:herd).
  publicDir: false,
  build: { target: 'es2022', chunkSizeWarningLimit: 800 },
  test: { environment: 'jsdom' },
} as Parameters<typeof defineConfig>[0]);
