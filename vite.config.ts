import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.VOLC_API_KEY': JSON.stringify(env.VOLC_API_KEY),
      'process.env.VOLC_TEXT_MODEL': JSON.stringify(env.VOLC_TEXT_MODEL),
      'process.env.VOLC_IMAGE_MODEL': JSON.stringify(env.VOLC_IMAGE_MODEL),
      'process.env.VITE_KB_URL': JSON.stringify(env.VITE_KB_URL),
      'process.env.VITE_GITHUB_TOKEN': JSON.stringify(env.VITE_GITHUB_TOKEN)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    base: './',
  };
});
