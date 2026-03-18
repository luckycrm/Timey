import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      // Proxy all /api/* requests to the Elysia API server during development.
      // This avoids CORS issues and means the browser never calls localhost:3001 directly.
      '/api': {
        target: `http://localhost:${process.env.SERVER_PORT ?? 3001}`,
        changeOrigin: true,
      },
    },
  },
  ssr: {
    noExternal: ['@dytesdk/react-ui-kit', '@dytesdk/ui-kit'],
  },
  plugins: [
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart(),
    react(),
  ],
});
