import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: "/",
  build: {
    outDir: "dist",
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks: {
          "html5-qrcode": ["html5-qrcode"],
        },
      },
      input: {
        main: 'index.html',
        sw: 'public/sw.js',
      },
    },
  },
  publicDir: 'public',
  server: {
    port: 3000,
    open: true,
  },
}));
