import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      // String shorthand for simple proxying
      // '/foo': 'http://localhost:4567/foo',
      // Proxying /api to your backend server
      '/api': {
        target: 'http://localhost:3001', // Your backend server address
        changeOrigin: true,
        // secure: false, // Uncomment if your backend is not on HTTPS (for local dev)
        // rewrite: (path) => path.replace(/^\/api/, '') // Optional: if your backend doesn't have /api prefix
      },
      // You can add more proxies here if needed for other backend services
    },
  },
});
