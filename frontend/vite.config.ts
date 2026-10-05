import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
 const local = { ...loadEnv(mode, path.resolve(import.meta.dirname, '..'), ''), ...process.env };
 const proxy = { '/api': `http://${local.PLACEMENTIQ_HOST || '127.0.0.1'}:${local.PLACEMENTIQ_PORT || '8787'}` };
 return {
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    open: false,
    proxy,
  },
  preview: { port: 3000, strictPort: true, proxy },
}; });
