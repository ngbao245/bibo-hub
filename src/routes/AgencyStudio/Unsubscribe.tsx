// ============================================================
// Unsubscribe — Public page, no auth required
// ============================================================
// Route: /agency-studio/unsubscribe?token=xxx
// Calls Edge Function unsubscribe to process the token.
// ============================================================

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MailX, CheckCircle2 } from 'lucide-react';

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token');

  const [state, setState] = useState<'loading' | 'success' | 'already' | 'error'>('loading');
  const [leadName, setLeadName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setErrorMsg('Link không hợp lệ — thiếu token.');
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_AUTH_URL as string;

    fetch(`${supabaseUrl}/functions/v1/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json() as { ok?: boolean; already?: boolean; lead_name?: string; error?: string };
        if (!res.ok || !data.ok) {
          setState('error');
          setErrorMsg(data.error ?? 'Link không hợp lệ hoặc đã hết hạn.');
          return;
        }
        setLeadName(data.lead_name ?? null);
        setState(data.already ? 'already' : 'success');
      })
      .catch(() => {
        setState('error');
        setErrorMsg('Không thể kết nối. Vui lòng thử lại sau.');
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        {state === 'loading' && (
          <p className="text-sm text-muted-foreground">Đang xử lý...</p>
        )}

        {(state === 'success' || state === 'already') && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <h1 className="text-base font-semibold text-foreground">
              {state === 'already' ? 'Đã unsubscribe trước đó' : 'Unsubscribe thành công'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {leadName ? `${leadName}, bạn` : 'Bạn'} sẽ không nhận được email từ người gửi này nữa.
            </p>
          </>
        )}

        {state === 'error' && (
          <>
            <MailX className="mx-auto h-12 w-12 text-destructive" />
            <h1 className="text-base font-semibold text-foreground">Link không hợp lệ</h1>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
          </>
        )}
      </div>
    </div>
  );
}