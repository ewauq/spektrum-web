import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')
);

export default defineConfig({
  plugins: [sveltekit()],
  clearScreen: false,
  worker: {
    format: 'es' as const
  },
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version)
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
