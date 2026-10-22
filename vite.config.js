import { defineConfig } from 'vite'
import { resolve } from 'path'

const rootDir = import.meta.dirname

// NG-gophish build.
//
// Vite compila las fuentes nuevas de UI (static/src/) a static/dist/, que el
// servidor Go sirve en /dist/*. Nombres de salida fijos (sin hash) para que las
// plantillas Go puedan referenciarlos de forma estable.
export default defineConfig({
  root: resolve(rootDir, 'static/src'),
  base: '/dist/',
  css: {
    preprocessorOptions: {
      scss: {
        quietDeps: true,
        silenceDeprecations: ['import'],
      },
    },
  },
  build: {
    outDir: resolve(rootDir, 'static/dist'),
    emptyOutDir: true,
    manifest: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'static/src/main.js'),
        dashboard: resolve(rootDir, 'static/src/pages/dashboard.js'),
        settings: resolve(rootDir, 'static/src/pages/settings.js'),
        users: resolve(rootDir, 'static/src/pages/users.js'),
        webhooks: resolve(rootDir, 'static/src/pages/webhooks.js'),
        reset_password: resolve(rootDir, 'static/src/pages/reset_password.js'),
        sending_profiles: resolve(rootDir, 'static/src/pages/sending_profiles.js'),
        groups: resolve(rootDir, 'static/src/pages/groups.js'),
        templates: resolve(rootDir, 'static/src/pages/templates.js'),
        landing_pages: resolve(rootDir, 'static/src/pages/landing_pages.js'),
        campaigns: resolve(rootDir, 'static/src/pages/campaigns.js'),
        campaign_results: resolve(rootDir, 'static/src/pages/campaign_results.js'),
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
