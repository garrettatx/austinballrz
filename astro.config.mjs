// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.austinballrz.com',
  trailingSlash: 'always',
  integrations: [sitemap({
    filter: (page) => !page.includes('/admin/') && !page.includes('/join/'),
  })],
  vite: {
    plugins: [tailwindcss()],
  },
});
