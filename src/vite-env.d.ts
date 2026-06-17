/// <reference types="vite/client" />

// Cho phép import file CSS trong TypeScript (Vite xử lý import này khi build).
declare module '*.css';

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_BUCKET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}