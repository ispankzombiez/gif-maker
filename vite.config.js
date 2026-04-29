import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/gif-maker/',
  plugins: [react()],
  optimizeDeps: {
    include: ['omggif'],
  },
});
