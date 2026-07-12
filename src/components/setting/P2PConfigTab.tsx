import { useEffect, useState } from 'react';
import { Eye, EyeOff, Save } from 'lucide-react';
import { toast } from 'sonner';

import {
  useSettingQuery,
  useUpdateSettingMutation,
  type P2PConfigValue,
} from '@/api/settingsApi';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorState } from '@/components/shared';

interface P2PDraft {
  firebase: {
    apiKey: string;
    authDomain: string;
    databaseURL: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  turn: {
    username: string;
    credential: string;
  };
}

/** Fields cần mask mặc định */
const SECRET_FIELDS = new Set<string>(['apiKey', 'appId', 'messagingSenderId', 'credential']);

const EMPTY: P2PDraft = {
  firebase: {
    apiKey: '',
    authDomain: '',
    databaseURL: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },
  turn: { username: '', credential: '' },
};

function normalize(v: P2PConfigValue | null): P2PDraft {
  if (!v || typeof v !== 'object') return { ...EMPTY };
  const fb = (v as { firebase?: Partial<P2PDraft['firebase']> }).firebase ?? {};
  const turn = (v as { turn?: Partial<P2PDraft['turn']> }).turn ?? {};
  return {
    firebase: { ...EMPTY.firebase, ...fb },
    turn: { ...EMPTY.turn, ...turn },
  };
}

export default function P2PConfigTab() {
  const query = useSettingQuery('p2p_config');
  const update = useUpdateSettingMutation('p2p_config');

  const [draft, setDraft] = useState<P2PDraft>(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (query.data !== undefined) {
      setDraft(normalize(query.data));
      setDirty(false);
    }
  }, [query.data]);

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <ErrorState
        message={query.error instanceof Error ? query.error.message : 'Load fail'}
        onRetry={() => query.refetch()}
      />
    );
  }

  function updateFB<K extends keyof P2PDraft['firebase']>(key: K, value: string) {
    setDraft((d) => ({ ...d, firebase: { ...d.firebase, [key]: value } }));
    setDirty(true);
  }

  function updateTurn<K extends keyof P2PDraft['turn']>(key: K, value: string) {
    setDraft((d) => ({ ...d, turn: { ...d.turn, [key]: value } }));
    setDirty(true);
  }

  async function handleSave() {
    try {
      await update.mutateAsync(draft as unknown as P2PConfigValue);
      toast.success('Đã lưu P2P config');
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save fail');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-foreground">P2P Config</h3>
        <p className="text-xs text-muted-foreground">
          Firebase Realtime DB + Metered TURN server credentials.
        </p>
      </div>

      <section className="space-y-3">
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Firebase
        </h4>
        {(Object.keys(EMPTY.firebase) as (keyof P2PDraft['firebase'])[]).map((k) => (
          <Field
            key={k}
            label={k}
            value={draft.firebase[k]}
            onChange={(v) => updateFB(k, v)}
            isSecret={SECRET_FIELDS.has(k)}
            visible={visibleFields.has(`firebase.${k}`)}
            onToggleVisible={() =>
              setVisibleFields((prev) => {
                const next = new Set(prev);
                const key = `firebase.${k}`;
                next.has(key) ? next.delete(key) : next.add(key);
                return next;
              })
            }
          />
        ))}
      </section>

      <section className="space-y-3">
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          TURN Server (Metered)
        </h4>
        <Field
          label="username"
          value={draft.turn.username}
          onChange={(v) => updateTurn('username', v)}
          isSecret={false}
          visible={true}
          onToggleVisible={() => {}}
        />
        <Field
          label="credential"
          value={draft.turn.credential}
          onChange={(v) => updateTurn('credential', v)}
          isSecret={SECRET_FIELDS.has('credential')}
          visible={visibleFields.has('turn.credential')}
          onToggleVisible={() =>
            setVisibleFields((prev) => {
              const next = new Set(prev);
              next.has('turn.credential') ? next.delete('turn.credential') : next.add('turn.credential');
              return next;
            })
          }
        />
      </section>

      <div className="flex items-center gap-2">
        <Button onClick={handleSave} disabled={!dirty || update.isPending} className="gap-2">
          <Save className="h-4 w-4" />
          {update.isPending ? 'Đang lưu...' : 'Lưu'}
        </Button>
        {dirty && <span className="text-xs text-warning">Có thay đổi chưa lưu</span>}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  isSecret,
  visible,
  onToggleVisible,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  isSecret: boolean;
  visible: boolean;
  onToggleVisible: () => void;
}) {
  const showAsPassword = isSecret && !visible;
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <Input
          type={showAsPassword ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs"
        />
        {isSecret && (
          <Button type="button" variant="ghost" size="icon" onClick={onToggleVisible}>
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}