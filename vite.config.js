import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // Permite desplegar en subrutas (GitHub Pages, Vercel, Netlify, etc.) sin romper CSS/JS/Assets
});
