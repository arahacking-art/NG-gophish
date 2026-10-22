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
        reset_password: resolve(__dirname, 'static/src/pages/reset_password.js'),
        sending_profiles: resolve(__dirname, 'static/src/pages/sending_profiles.js'),
        groups: resolve(__dirname, 'static/src/pages/groups.js'),
        templates: resolve(__dirname, 'static/src/pages/templates.js'),
        landing_pages: resolve(__dirname, 'static/src/pages/landing_pages.js'),
        campaigns: resolve(__dirname, 'static/src/pages/campaigns.js'),
        campaign_results: resolve(__dirname, 'static/src/pages/campaign_results.js'),
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
