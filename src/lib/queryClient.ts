// ============================================================
// queryClient — singleton TanStack Query client
// ============================================================
//
// Extract khỏi main.tsx để module ngoài React (VD workspace client
// subscriber) có thể invalidate queries khi token đổi.
//
// Import từ main.tsx cho <QueryClientProvider>, import từ modules
// khác khi cần side-effect invalidate.
// ============================================================

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});