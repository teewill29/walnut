/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };
import { APP_DESCRIPTION, APP_NAME } from './src/config.ts';

const BG = '#1A1613';

// Fills %APP_NAME% / %APP_DESCRIPTION% in index.html from src/config.ts.
function appNameInHtml(): Plugin {
  return {
    name: 'walnut-app-name',
    transformIndexHtml: (html) =>
      html.replaceAll('%APP_NAME%', APP_NAME).replaceAll('%APP_DESCRIPTION%', APP_DESCRIPTION),
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(Date.now()),
  },
  plugins: [
    react(),
    appNameInHtml(),
    VitePWA({
      registerType: 'prompt', // wait for "Update ready · Reload" instead of reloading mid-game
      injectRegister: false, // UpdateToast registers it
      manifest: {
        id: '/',
        name: APP_NAME,
        short_name: APP_NAME,
        description: APP_DESCRIPTION,
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: BG,
        background_color: BG,
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell, fonts, icons. Later phases add openings.json and the Stockfish js + wasm.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,wasm}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024, // room for the Stockfish wasm
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['tests/engine/**', 'node_modules/**'], // real-Stockfish tests: npm run test:engine
    environment: 'node',
  },
});
