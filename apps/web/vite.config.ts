import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/recharts') || id.includes('/node_modules/d3-'))
            return 'charts';
        },
      },
    },
  },
  test: { environment: 'jsdom', setupFiles: './src/test-setup.ts' },
});
