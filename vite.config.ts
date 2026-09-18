import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 850,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            if (id.includes('@google/generative-ai')) return 'vendor-ai';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('tailwind-merge') || id.includes('clsx')) return 'vendor-ui';
            return 'vendor';
          }
          if (id.includes('src/utils/transitionEngine') || id.includes('src/utils/effectShaderEngine') || id.includes('src/utils/presetStyles')) {
            return 'engine-core';
          }
          if (id.includes('src/components/player/CaptionCanvasOverlay') || id.includes('src/utils/assExport')) {
            return 'caption-engine';
          }
          if (id.includes('src/components/timeline')) return 'timeline';
          if (id.includes('src/components/editor')) return 'editor-panels';
        },
      },
    },
  },
  plugins: [
    react(),
    electron([
      {
        // Main process entry file
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron', 'better-sqlite3', 'fsevents']
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron'
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
