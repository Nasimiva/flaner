import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { LANGS, DEFAULT_LANG } from './src/i18n/seo.ts';
import { outputPathForLang, renderHtmlForLang } from './src/i18n/renderHtml.ts';

// Besides the Russian index.html, writes one static HTML file per other language (dist/uz/index.html) with its own
// title, description, canonical and social tags, so crawlers see the right metadata without running JavaScript.
// Express serves it for /uz/ as a regular static file.
function languageVersionsPlugin(): Plugin {
  let outDir = '';
  return {
    name: 'flaner-language-versions',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const source = fs.readFileSync(path.join(outDir, 'index.html'), 'utf-8');
      for (const lang of LANGS) {
        if (lang === DEFAULT_LANG) continue;
        const target = path.join(outDir, outputPathForLang(lang));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, renderHtmlForLang(source, lang));
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), languageVersionsPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 5173,
      // Proxy API calls to Express server during development
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
