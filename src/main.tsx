import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { TooltipProvider } from '@radix-ui/react-tooltip';

import App from './App';
import { Toaster } from './components/ui/sonner';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <BrowserRouter basename="">
          <App />
        </BrowserRouter>
        <Toaster />
        <ReactQueryDevtools initialIsOpen={false} />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
