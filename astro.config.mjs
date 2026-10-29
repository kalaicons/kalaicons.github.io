import { defineConfig } from 'astro/config';

// GitHub Pages project site: <username>.github.io/kalai-icons (D-29, D-30)
export default defineConfig({
  site: process.env.SITE_URL || 'https://example.github.io',
  base: '/kalai-icons',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
