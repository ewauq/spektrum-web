import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: '200.html',
      precompress: false,
      strict: true
    }),
    prerender: {
      entries: ['*']
    },
    // SvelteKit emet un <meta http-equiv="Content-Security-Policy"> dans
    // chaque page prérendue, en hashant les <script> inline qu'il injecte
    // lui-même (bootstrap d'hydratation). Mode 'hash' marche pour le
    // build statique (pas de nonce serveur disponible).
    csp: {
      mode: 'hash',
      directives: {
        'default-src': ['self'],
        // regl JIT-compiles GLSL bindings via the Function constructor,
        // which falls under unsafe-eval (wasm-unsafe-eval covers only
        // WebAssembly.compile et al.). Keep both: WASM is hot for the
        // FLAC/MP3 decoders, eval for the WebGL rendering hot loop.
        'script-src': ['self', 'wasm-unsafe-eval', 'unsafe-eval'],
        'style-src': ['self', 'unsafe-inline'],
        'img-src': ['self', 'data:', 'blob:'],
        'worker-src': ['self', 'blob:'],
        'connect-src': ['self'],
        'font-src': ['self', 'data:']
      }
    }
  }
};

export default config;
