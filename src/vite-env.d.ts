/// <reference types="vite/client" />

// Custom env vars — Vite chỉ expose var có prefix VITE_.
// Type khai ở đây để `import.meta.env` gợi ý IntelliSense đúng.

interface ImportMetaEnv {
  readonly VITE_SUPABASE_AUTH_URL?: string;
  readonly VITE_SUPABASE_AUTH_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}