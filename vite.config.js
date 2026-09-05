import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  // La raíz del repo es el directorio que Hostinger publica, así que el HTML
  // *fuente* vive en app/ y el HTML *compilado* se escribe en la raíz.
  // Sin esta separación, cada build volvía a hashear los assets ya hasheados
  // del build anterior (index-abc.js -> index-abc-def.js -> ...).
  root: 'app',
  publicDir: '../public',
  base: './', // Permite desplegar en subrutas (GitHub Pages, Vercel, Netlify, etc.) sin romper CSS/JS/Assets
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 6001,
  },
});
