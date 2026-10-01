import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ command }) => ({
  base: command === 'build' && process.env.GITHUB_PAGES === 'true' ? '/moyimpyo/' : '/',
  plugins: [react()],
  server: { host: '127.0.0.1' },
}));
