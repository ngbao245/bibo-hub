import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Cấu hình Vite cho React + TS + Tailwind.
// Dùng alias `@` để import từ src/ cho gọn: import X from '@/components/X'
export default defineConfig(() => ({
  base: '/',  // Root base - Vercel proxy từ vudecor.vn sẽ handle routing
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
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      '@tanstack/react-query',
      '@tanstack/react-query-devtools',
      'zustand',
      // Tiptap: pre-bundle để tránh "504 Outdated Optimize Dep" khi
      // Notes.tsx lazy-load RichEditor lần đầu (Vite re-discover deps
      // giữa request → invalidate chunk đang fetch).
      '@tiptap/react',
      '@tiptap/starter-kit',
      '@tiptap/extension-underline',
      '@tiptap/extension-highlight',
      '@tiptap/extension-placeholder',
      '@tiptap/extension-code-block-lowlight',
      // @tiptap/pm: chỉ có subpath exports (state/view/model...),
      // pre-bundle các subpath mà StarterKit + extensions thực sự dùng.
      '@tiptap/pm/state',
      '@tiptap/pm/view',
      '@tiptap/pm/model',
      '@tiptap/pm/transform',
      '@tiptap/pm/commands',
      '@tiptap/pm/keymap',
      '@tiptap/pm/schema-list',
      'lowlight',
      // PDF.js: pre-bundle để tránh worker load issues
      'pdfjs-dist',
    ],
    // Exclude worker files khỏi optimization
    exclude: ['pdfjs-dist/build/pdf.worker.min.mjs'],
  },
  worker: {
    format: 'es' as const,
  },
  server: {
    port: 3000,
    strictPort: false,
    open: true,
  },
}));


