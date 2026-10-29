import { defineConfig } from 'astro/config';

// GitHub Pages organization site at the root of kalaicons.github.io (D-29, D-54)
export default defineConfig({
  site: 'https://kalaicons.github.io',
  base: '/',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
