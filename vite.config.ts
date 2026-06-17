import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'copy-db-json',
        closeBundle() {
          try {
            if (fs.existsSync('db.json')) {
              fs.mkdirSync('dist', { recursive: true });
              fs.copyFileSync('db.json', 'dist/db.json');
              console.log('Successfully copied db.json to dist/db.json for static pages deployment!');
            }
          } catch (e) {
            console.error('Failed to copy db.json to dist/ for static deployment:', e);
          }
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
