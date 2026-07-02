// ============================================================
// RAG auto-bootstrap — gọi 1 lần ở App.tsx khi mount
//
// Flow:
//   1. setStatus('loading')
//   2. loadRagConfig() — luôn có default fallback
//   3. loadRagTokens() — có thể fail nếu chưa setup
//   4. Nếu có >=1 Gemini key → status='ready'
//      Nếu không → status='needs_setup'
//
// Không throw error: mọi failure đều set status + errorMessage,
// UI tự handle CTA (hide RAG features, link vào Setting).
// ============================================================

import { activeGeminiKeys, RagVaultError } from './types';
import { loadRagConfig } from './rag-config';
import { loadRagTokens } from './rag-vault';
import { useRagStore } from '@/stores/ragStore';

/**
 * Bootstrap RAG module.
 *
 * Idempotent: gọi nhiều lần không hại, sẽ reload config + tokens mới.
 * Trả về status cuối cùng để caller log/handle.
 */
export async function tryBootstrapRag(): Promise<{
  status: 'ready' | 'needs_setup' | 'error';
  errorMessage?: string;
}> {
  const store = useRagStore.getState();
  store.setStatus('loading');

  // 1. Config (luôn có giá trị nhờ default fallback)
  try {
    const config = await loadRagConfig();
    store.setConfig(config);
  } catch (err) {
    // loadRagConfig() đã defensive nhưng phòng trường hợp bất ngờ
    const message = err instanceof Error ? err.message : 'unknown';
    store.setStatus('error', `Load config failed: ${message}`);
    return { status: 'error', errorMessage: message };
  }

  // 2. Tokens — có thể fail nếu user chưa setup record SettingInfor
  try {
    const tokens = await loadRagTokens();
    store.setTokens(tokens);

    if (activeGeminiKeys(tokens).length === 0) {
      // Record tồn tại nhưng tất cả Gemini key đều rỗng
      store.setStatus('needs_setup', 'No Gemini API key configured');
      return { status: 'needs_setup', errorMessage: 'No Gemini API key configured' };
    }

    store.setStatus('ready');
    return { status: 'ready' };
  } catch (err) {
    if (err instanceof RagVaultError) {
      // 'no_record' là case bình thường khi user chưa setup
      // 'decrypt_failed' là case nghiêm trọng (passphrase sai)
      const isNoRecord = err.code === 'no_record';
      store.setStatus(isNoRecord ? 'needs_setup' : 'error', err.message);
      return {
        status: isNoRecord ? 'needs_setup' : 'error',
        errorMessage: err.message,
      };
    }
    const message = err instanceof Error ? err.message : 'unknown';
    store.setStatus('error', `Load tokens failed: ${message}`);
    return { status: 'error', errorMessage: message };
  }
}