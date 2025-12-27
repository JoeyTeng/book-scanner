import { defineConfig } from 'vite';

export default defineConfig({
  base: '/book-scanner/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'html5-qrcode': ['html5-qrcode']
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
