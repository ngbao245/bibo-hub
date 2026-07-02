// ============================================================
// RAG Zustand store
// ============================================================
//
// Single source of truth runtime cho RAG module:
//   - config:   parse từ MockAPI Config record (fallback default)
//   - tokens:   decrypt từ MockAPI SettingInfor record
//   - status:   bootstrap state cho UI quyết định render gì
//   - chatMode: mode hiện tại (Auto/Internal) — có thể override khỏi config
//
// Bootstrap flow:
//   App.tsx mount → tryBootstrapRag() → setConfig/setTokens/setStatus
//   Các component (modal, search, chat) read từ store, không gọi vault lại.
// ============================================================

import { create } from 'zustand';

import {
  DEFAULT_RAG_CONFIG,
  EMPTY_RAG_TOKENS,
  activeGeminiKeys,
  type RagChatMode,
  type RagConfig,
  type RagStatus,
  type RagTokens,
} from '@/lib/rag/types';

/**
 * Pending prompt — caller (vd SelectionMenu trong reader) request RAG chat
 * tự pre-fill + gửi. ChatTab subscribe, consume rồi clear.
 *
 * `preferBookMode`: gợi ý chuyển sang Book mode trước khi gửi (chỉ apply
 * nếu reader đang active, ngược lại fallback chế độ hiện tại).
 */
export interface RagPendingPrompt {
  text: string;
  preferBookMode: boolean;
  /** id để ChatTab phân biệt prompt mới (kể cả text trùng). */
  id: string;
}

interface RagState {
  config: RagConfig;
  tokens: RagTokens;
  status: RagStatus;
  /** Lỗi gần nhất khi bootstrap (cho UI hiển thị CTA setup). */
  errorMessage: string | null;
  /** Mode chat hiện tại — khởi tạo từ config.chatDefaultMode, user có thể override trong phiên. */
  chatMode: RagChatMode;
  /** Request từ ngoài (Reader SelectionMenu) — ChatTab consume rồi clear. */
  pendingPrompt: RagPendingPrompt | null;

  setConfig: (config: RagConfig) => void;
  setTokens: (tokens: RagTokens) => void;
  setStatus: (status: RagStatus, errorMessage?: string | null) => void;
  setChatMode: (mode: RagChatMode) => void;
  /** Đặt pending prompt + (nếu cần) caller tự gọi modalStore.open('rag'). */
  setPendingPrompt: (text: string, opts?: { preferBookMode?: boolean }) => void;
  clearPendingPrompt: () => void;
  reset: () => void;
}

export const useRagStore = create<RagState>((set) => ({
  config: DEFAULT_RAG_CONFIG,
  tokens: EMPTY_RAG_TOKENS,
  status: 'idle',
  errorMessage: null,
  chatMode: DEFAULT_RAG_CONFIG.chatDefaultMode,
  pendingPrompt: null,

  setConfig: (config) =>
    set((state) => ({
      config,
      // Sync chatMode nếu user chưa override trong phiên này
      chatMode: state.status === 'idle' ? config.chatDefaultMode : state.chatMode,
    })),

  setTokens: (tokens) => set({ tokens }),

  setStatus: (status, errorMessage = null) => set({ status, errorMessage }),

  setChatMode: (mode) => set({ chatMode: mode }),

  setPendingPrompt: (text, opts) =>
    set({
      pendingPrompt: {
        text,
        preferBookMode: opts?.preferBookMode ?? false,
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      },
    }),

  clearPendingPrompt: () => set({ pendingPrompt: null }),

  reset: () =>
    set({
      config: DEFAULT_RAG_CONFIG,
      tokens: EMPTY_RAG_TOKENS,
      status: 'idle',
      errorMessage: null,
      chatMode: DEFAULT_RAG_CONFIG.chatDefaultMode,
      pendingPrompt: null,
    }),
}));

// ============================================================
// Selectors — dùng để tránh re-render không cần thiết
// ============================================================

/** True nếu có ít nhất 1 Gemini key đã setup. */
export const selectHasGeminiKey = (state: RagState): boolean =>
  activeGeminiKeys(state.tokens).length > 0;

/** True nếu RAG sẵn sàng dùng (ready status + có key). */
export const selectIsReady = (state: RagState): boolean =>
  state.status === 'ready' && activeGeminiKeys(state.tokens).length > 0;