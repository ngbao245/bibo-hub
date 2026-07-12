// ============================================================
// Agency Studio Settings — Gmail OAuth + Sender profile
// ============================================================

import { useEffect, useState } from 'react';
import { Mail, CheckCircle2, XCircle, ExternalLink, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { authClient } from '@/lib/authClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorState, LoadingState } from '@/components/shared';

interface AgencySettings {
  gmail_email: string | null;
  gmail_connected: boolean;
  sender_display_name: string | null;
  sender_signature: string | null;
}

function useAgencySettings() {
  return useQuery({
    queryKey: ['agency_gmail_status'],
    queryFn: async () => {
      const { data, error } = await authClient
        .from('agency_user_settings')
        .select('gmail_email, gmail_connected, sender_display_name, sender_signature')
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? {
        gmail_email: null,
        gmail_connected: false,
        sender_display_name: null,
        sender_signature: null,
      }) as AgencySettings;
    },
    retry: 2,
    retryDelay: 500,
    staleTime: 0,
  });
}

function useDisconnectGmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await authClient.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await authClient
        .from('agency_user_settings')
        .upsert({
          user_id: user.id,
          gmail_email: null,
          gmail_refresh_token: null,
          gmail_connected: false,
        }, { onConflict: 'user_id' });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agency_gmail_status'] });
      toast.success('Đã disconnect Gmail');
    },
  });
}

function useSaveSenderProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { display_name: string; signature: string }) => {
      const { data: { user } } = await authClient.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await authClient
        .from('agency_user_settings')
        .upsert({
          user_id: user.id,
          sender_display_name: input.display_name.trim() || null,
          sender_signature: input.signature.trim() || null,
        }, { onConflict: 'user_id' });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agency_gmail_status'] });
      toast.success('Đã lưu sender profile');
    },
  });
}

export default function Settings() {
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const query = useAgencySettings();
  const disconnect = useDisconnectGmail();
  const saveMut = useSaveSenderProfile();
  const [showSuccess, setShowSuccess] = useState(false);

  // Sender profile form state — sync 1 lần khi query load
  const [displayName, setDisplayName] = useState('');
  const [signature, setSignature] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (query.data && !dirty) {
      setDisplayName(query.data.sender_display_name ?? '');
      setSignature(query.data.sender_signature ?? '');
    }
  }, [query.data, dirty]);

  useEffect(() => {
    if (params.get('gmail') === 'connected') {
      setShowSuccess(true);
      // Invalidate global để mọi consumer (VD CampaignCreate) refetch.
      void qc.invalidateQueries({ queryKey: ['agency_gmail_status'] });
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [params, qc]);

  async function handleConnect() {
    const { data: { session } } = await authClient.auth.getSession();
    if (!session) { toast.error('Chưa login'); return; }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_AUTH_URL as string;
    const redirectUri = `${supabaseUrl}/functions/v1/gmail-oauth`;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

    if (!clientId) {
      toast.error('Google Client ID chưa được config (VITE_GOOGLE_CLIENT_ID)');
      return;
    }

    const oauthParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
      access_type: 'offline',
      prompt: 'consent',
      state: session.access_token,
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${oauthParams}`;
  }

  async function handleSaveProfile() {
    await saveMut.mutateAsync({ display_name: displayName, signature });
    setDirty(false);
  }

  if (query.isLoading) {
    return (
      <div className="p-6 max-w-md">
        <LoadingState
          variant="skeleton"
          count={2}
          layout="list"
          itemClassName="h-6 w-40 last:h-20 last:w-full"
        />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="p-6">
        <ErrorState message={query.error instanceof Error ? query.error.message : 'Load failed'} onRetry={() => query.refetch()} />
      </div>
    );
  }

  const status = query.data;

  return (
    <div className="p-6 space-y-6 max-w-md">
      {/* Gmail Connection */}
      <section className="space-y-3">
        <h1 className="text-sm font-semibold text-foreground">Gmail Connection</h1>
        <p className="text-xs text-muted-foreground">
          Kết nối Gmail để gửi email campaign trực tiếp từ inbox của bạn. Không cần verify domain.
        </p>

        {showSuccess && (
          <div className="flex items-center gap-2 rounded border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">
            <CheckCircle2 className="h-4 w-4" />
            Gmail đã kết nối thành công!
          </div>
        )}

        <div className="border border-border p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${status?.gmail_connected ? 'bg-success/10' : 'bg-muted'}`}>
              <Mail className={`h-5 w-5 ${status?.gmail_connected ? 'text-success' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {status?.gmail_connected ? 'Connected' : 'Not Connected'}
              </p>
              {status?.gmail_email && (
                <p className="text-xs text-muted-foreground">{status.gmail_email}</p>
              )}
            </div>
          </div>

          {status?.gmail_connected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
              className="gap-1"
            >
              <XCircle className="h-3.5 w-3.5" />
              Disconnect Gmail
            </Button>
          ) : (
            <Button size="sm" onClick={handleConnect} className="gap-1">
              <ExternalLink className="h-3.5 w-3.5" />
              Connect Gmail
            </Button>
          )}
        </div>

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer text-foreground">Gmail limits</summary>
          <ul className="mt-2 space-y-1 pl-4 list-disc">
            <li>Gmail free: 500 emails/ngày</li>
            <li>Google Workspace: 2,000 emails/ngày</li>
            <li>Email gửi từ chính inbox của bạn — recipient thấy "From: your@gmail.com"</li>
          </ul>
        </details>
      </section>

      {/* Sender Profile */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Sender Profile</h2>
        <p className="text-xs text-muted-foreground">
          Custom hiển thị tên người gửi và chữ ký cuối email. Avatar Gmail tự động lấy từ tài khoản Google của bạn — muốn đổi avatar vào <a href="https://myaccount.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Account</a>.
        </p>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Display name</label>
          <Input
            value={displayName}
            onChange={(e) => { setDisplayName(e.target.value); setDirty(true); }}
            placeholder="Baohh from BiBo Studio"
          />
          <p className="text-xs text-muted-foreground/70">
            Recipient sẽ thấy: <code className="text-foreground font-mono">"{displayName || 'Your Name'}" &lt;{status?.gmail_email ?? 'you@gmail.com'}&gt;</code>
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Signature</label>
          <textarea
            value={signature}
            onChange={(e) => { setSignature(e.target.value); setDirty(true); }}
            placeholder={"Baohh — CEO BiBo Studio\nWeb: vudecor.vn\nZalo: 0934xxx"}
            rows={5}
            className="w-full resize-none border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
          />
          <p className="text-xs text-muted-foreground/70">
            Chữ ký append tự động cuối mỗi email. Xuống dòng bằng Enter.
          </p>
        </div>

        {dirty && (
          <Button size="sm" onClick={handleSaveProfile} disabled={saveMut.isPending} className="gap-1">
            {saveMut.isPending ? (
              <LoadingState variant="inline" label="Đang lưu" />
            ) : (
              <><Save className="h-3.5 w-3.5" />Lưu profile</>
            )}
          </Button>
        )}
      </section>
    </div>
  );
}