import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/private-github-docs-viewer/' : '/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
