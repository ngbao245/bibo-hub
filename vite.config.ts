import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Cấu hình Vite cho React + TS + Tailwind.
// Dùng alias `@` để import từ src/ cho gọn: import X from '@/components/X'
export default defineConfig(() => ({
  base: '/',  // Root base, Vercel rewrite sẽ handle routing
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Ép Vite resolve react/react-dom về CÙNG 1 bản duy nhất.
    // Thiếu cái này, các deps có React làm peer (react-router, react-query)
    // có thể được pre-bundle với 1 bản React riêng → "Invalid hook call" runtime error.
    dedupe: ['react', 'react-dom'],
  },
  // Pre-bundle các thư viện React-related với cùng 1 React instance,
  // tránh trường hợp Vite pre-bundle nhiều bản React khác nhau.
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      '@tanstack/react-query',
      '@tanstack/react-query-devtools',
      'zustand',
    ],
  },
  server: {
    port: 3000,
    strictPort: false, // nếu 3000 bị chiếm → tự thử 3001, 3002...
    open: true,
  },
}));

