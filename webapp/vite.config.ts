import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Vite runs from webapp/ but .env.local lives one level up at the
  // project root (alongside server.js). Tell Vite to read env files from
  // there so VITE_GOOGLE_MAPS_KEY and friends are picked up.
  envDir: '..',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
