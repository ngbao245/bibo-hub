import { useState, type FormEvent } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { TOOLS } from '@/lib/tools';
import { useCreateUserMutation } from '@/api/authApi';
import { AUTH_FUNCTIONS_URL, AUTH_ANON_KEY_PUBLIC } from '@/lib/authClient';
import type { UserRole } from '@/stores/authStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

const ALL_TOOL_IDS = TOOLS.map((t) => t.id);
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

function randomPassword(length = 12): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  let out = '';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length];
  return out;
}

/** Check username có tồn tại chưa qua Edge Function lookup-username. */
async function checkUsernameAvailable(username: string): Promise<boolean> {
  try {
    const res = await fetch(`${AUTH_FUNCTIONS_URL}/lookup-username`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: AUTH_ANON_KEY_PUBLIC,
      },
      body: JSON.stringify({ username }),
    });
    // 404 = không tồn tại → available. 200 = tồn tại → taken.
    return res.status === 404;
  } catch {
    // Network error → không chắc, cho pass để backend catch duplicate
    return true;
  }
}

export default function CreateUserDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const create = useCreateUserMutation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [allowed, setAllowed] = useState<string[]>([]);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  function reset() {
    setUsername('');
    setPassword('');
    setRole('user');
    setAllowed([]);
    setUsernameError(null);
  }

  function toggleTool(id: string) {
    setAllowed((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  function validateUsername(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return 'Username không được để trống';
    if (!USERNAME_REGEX.test(trimmed)) {
      return 'Username 3-20 ký tự, chỉ chữ, số, gạch dưới';
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const formatError = validateUsername(username);
    if (formatError) {
      setUsernameError(formatError);
      toast.error(formatError);
      return;
    }
    if (!password) {
      toast.error('Nhập password');
      return;
    }

    setCheckingUsername(true);
    const available = await checkUsernameAvailable(username.trim().toLowerCase());
    setCheckingUsername(false);
    if (!available) {
      setUsernameError('Username đã tồn tại');
      toast.error('Username đã tồn tại');
      return;
    }

    try {
      await create.mutateAsync({
        username: username.trim().toLowerCase(),
        password,
        role,
        allowed_tools: role === 'admin' ? ['*'] : allowed,
      });
      toast.success(`Đã tạo user ${username.trim().toLowerCase()}`);
      reset();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create fail');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Tạo user mới</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Username</label>
              <Input
                type="text"
                required
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setUsernameError(null);
                }}
                placeholder="baobibo (3-20 ký tự, chữ+số+_)"
                autoFocus
                pattern="[a-zA-Z0-9_]{3,20}"
              />
              {usernameError && (
                <p className="text-[11px] text-destructive">{usernameError}</p>
              )}
              <p className="text-[10px] text-muted-foreground">
                Email tự sinh: <code className="font-mono">{username ? `${username.trim().toLowerCase()}@bibo-tools.local` : '(chưa nhập)'}</code>
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Password</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ít nhất 6 ký tự"
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPassword(randomPassword())}
                  className="gap-1"
                >
                  <RefreshCw className="h-4 w-4" />
                  Random
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Gửi password này cho user. User đổi email thật + password ở tab Profile.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Role</label>
              <div className="flex gap-2">
                {(['user', 'admin'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={
                      role === r
                        ? 'border border-primary bg-primary/15 px-3 py-1 text-xs text-primary'
                        : 'border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted'
                    }
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">
                Tool được dùng {role === 'admin' && '(admin bypass)'}
              </label>
              <div className="max-h-48 overflow-y-auto border border-border p-2">
                <div className="grid grid-cols-2 gap-2">
                  {ALL_TOOL_IDS.map((id) => (
                    <label
                      key={id}
                      className="flex items-center gap-2 text-xs text-foreground"
                    >
                      <Checkbox
                        checked={role === 'admin' || allowed.includes(id)}
                        onCheckedChange={() => toggleTool(id)}
                        disabled={role === 'admin'}
                      />
                      <span>{id}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onClose();
              }}
            >
              Huỷ
            </Button>
            <Button type="submit" disabled={create.isPending || checkingUsername}>
              {create.isPending ? 'Đang tạo...' : checkingUsername ? 'Đang check...' : 'Tạo user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}