import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { pdfjs } from 'react-pdf';

import App from './App';
import { Toaster } from './components/ui/sonner';
import './styles/index.css';

// Setup PDF.js worker BEFORE any lazy loading to prevent overwrite
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();
console.log('🔧 PDF.js worker initialized in main.tsx:', pdfjs.GlobalWorkerOptions.workerSrc);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Auto-detect base path từ URL hiện tại
const getBasename = () => {
  const { pathname } = window.location;
  // Nếu URL chứa /hubibo thì dùng basename đó
  if (pathname.startsWith('/hubibo')) return '/hubibo';
  // Nếu không thì root
  return '';
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <BrowserRouter basename={getBasename()}>
          <App />
        </BrowserRouter>
        <Toaster />
        <ReactQueryDevtools initialIsOpen={false} />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
