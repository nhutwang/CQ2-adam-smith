import { defineConfig } from 'vite';

export default defineConfig({
  root: 'ban-tay-web',
  build: {
    target: 'es2020',
  },
  optimizeDeps: {
    include: ['animejs', 'lenis'],
  },
});