import { defineConfig } from 'astro/config';
import remarkBreaks from 'remark-breaks';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://pruthvishetty.com',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/write'),
    }),
  ],
  markdown: {
    remarkPlugins: [remarkBreaks],
  },
  // Old hand-rolled URLs → their new homes (meta-refresh pages in static builds)
  redirects: {
    '/tools.html': '/tools/',
    '/jsonviz.html': '/tools/json/',
    '/textanalyzer.html': '/tools/text/',
    '/qrcode.html': '/tools/qr/',
    '/poems.html': '/writing/',
    '/blog.html': '/writing/',
    '/publish.html': '/write/',
  },
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
  devToolbar: { enabled: false },
});
