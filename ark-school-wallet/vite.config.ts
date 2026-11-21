/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { assertSignetOnlyEnv } from './scripts/signet-guard.ts';

// Content Security Policy for the built app. The wallet only talks to the
// configured Signet Ark server and Esplora. 'wasm-unsafe-eval' is required to
// instantiate the Bark WebAssembly module; no inline or third-party scripts.
function csp(connect: string[]): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${connect.join(' ')}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    // frame-ancestors only works as an HTTP header; set it on the host (see README).
  ].join('; ');
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  // T18: refuse to build or serve with anything but Signet endpoints.
  const { arkServer, esplora } = assertSignetOnlyEnv(env);
  const policy = csp([arkServer, esplora]);

  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'ark-school-csp',
        transformIndexHtml: {
          order: 'post',
          handler: (html, ctx) =>
            // Only the production build gets the meta CSP; Vite's dev server
            // injects inline scripts for HMR.
            ctx.server
              ? html
              : html.replace(
                  '<!-- CSP -->',
                  `<meta http-equiv="Content-Security-Policy" content="${policy}" />`,
                ),
        },
      },
    ],
    // The SDK locates its .wasm via import.meta.url; pre-bundling breaks that.
    optimizeDeps: { exclude: ['@secondts/bark'] },
    build: { target: 'es2022', chunkSizeWarningLimit: 900 },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
    },
  };
});
