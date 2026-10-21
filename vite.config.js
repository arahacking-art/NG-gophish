import { defineConfig } from 'vite'
import { resolve } from 'path'

// NG-gophish build.
//
// Vite compila las fuentes nuevas de UI (static/src/) a static/dist/, que el
// servidor Go sirve en /dist/*. Nombres de salida fijos (sin hash) para que las
// plantillas Go puedan referenciarlos de forma estable.
export default defineConfig({
  root: resolve(__dirname, 'static/src'),
  base: '/dist/',
  build: {
    outDir: resolve(__dirname, 'static/dist'),
    emptyOutDir: true,
    manifest: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'static/src/main.js'),
        dashboard: resolve(__dirname, 'static/src/pages/dashboard.js'),
        settings: resolve(__dirname, 'static/src/pages/settings.js'),
        users: resolve(__dirname, 'static/src/pages/users.js'),
        webhooks: resolve(__dirname, 'static/src/pages/webhooks.js'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return '[name][extname]'
          }
          return 'assets/[name][extname]'
        },
      },
    },
  },
})
