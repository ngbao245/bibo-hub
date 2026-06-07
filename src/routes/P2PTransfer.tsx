import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Wifi,
  WifiOff,
  Copy,
  Check,
  Upload,
  Download,
  X,
  Loader2,
  Send,
  RefreshCw,
  QrCode,
  Link2,
} from 'lucide-react';
import type { DataConnection, Peer as PeerType } from 'peerjs';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/cn';
import {
  FileReceiver,
  sendFile,
  formatBytes,
  formatSpeed,
  formatDuration,
  generatePeerId,
  type TransferMessage,
} from '@/lib/p2p/transfer';

// ============================================================
// P2P File Transfer Page
// ============================================================
//
// Flow:
// 1. Trang load → tạo PeerJS instance, broker server gán/giữ ID 6 chars.
// 2. UI hiển thị "ID của bạn: ABC123".
// 3. Để gửi: nhập ID đối phương → connect → drop file → gửi.
// 4. Để nhận: cho đối phương ID của mình → đợi connection → đối phương gửi → tự download.
//
// Dùng PeerJS broker public (peerjs.com:443) — không tự host.
// Nếu peer ở khác mạng + có symmetric NAT, có thể fallback TURN
// (PeerJS public không có TURN — sẽ fail với một số NAT, OK cho LAN/đa số case).
// ============================================================

type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';

interface SendingItem {
  id: string;
  file: File;
  sent: number;
  total: number;
  done: boolean;
  startedAt: number;
  speed: number;     // bytes/s (đo trên cửa sổ ~1s)
  eta: number;       // giây còn lại
  error?: string;
}

interface ReceivedItem {
  id: string;
  name: string;
  size: number;
  receivedBytes: number;
  startedAt: number;
  speed: number;
  eta: number;
  blob?: Blob;
  done: boolean;
}

export default function P2PTransfer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [myId, setMyId] = useState<string>('');
  const [peerStatus, setPeerStatus] = useState<'init' | 'open' | 'error'>('init');
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('closed');
  const [remoteId, setRemoteId] = useState('');
  const [connectedTo, setConnectedTo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [sendingFiles, setSendingFiles] = useState<SendingItem[]>([]);
  const [receivingFiles, setReceivingFiles] = useState<ReceivedItem[]>([]);

  const peerRef = useRef<PeerType | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const receiverRef = useRef<FileReceiver>(new FileReceiver());
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Speed tracking — sample window cuối cùng cho từng file
  const speedSamplesRef = useRef<
    Map<string, { time: number; bytes: number }[]>
  >(new Map());

  // Auto-connect nếu URL có ?connect=ABC234
  const autoConnectId = searchParams.get('connect')?.toUpperCase() ?? '';

  // ============================================================
  // Auto-connect khi URL có ?connect=ABC
  // ============================================================
  useEffect(() => {
    if (!autoConnectId || peerStatus !== 'open' || connStatus !== 'closed') return;
    if (autoConnectId === myId) return; // không tự nối
    setRemoteId(autoConnectId);
    // Delay 1 tick để input UI cập nhật trước khi connect
    const t = setTimeout(() => {
      const peer = peerRef.current;
      if (!peer) return;
      const conn = peer.connect(autoConnectId, { reliable: true });
      attachConnection(conn);
    }, 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnectId, peerStatus, myId]);

  // ============================================================
  // Speed/ETA computation — sample window 2s cuối
  // ============================================================
  function recordSample(fileId: string, bytes: number): { speed: number; eta: number; total?: number } {
    const now = performance.now();
    let samples = speedSamplesRef.current.get(fileId);
    if (!samples) {
      samples = [];
      speedSamplesRef.current.set(fileId, samples);
    }
    samples.push({ time: now, bytes });
    // Giữ samples trong window 2s
    const cutoff = now - 2000;
    while (samples.length > 1 && samples[0].time < cutoff) samples.shift();

    if (samples.length < 2) return { speed: 0, eta: Infinity };
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = (last.time - first.time) / 1000;
    const db = last.bytes - first.bytes;
    const speed = dt > 0 ? db / dt : 0;
    return { speed, eta: 0 };
  }

  function clearSamples(fileId: string) {
    speedSamplesRef.current.delete(fileId);
  }

  // ============================================================
  // Init PeerJS
  // ============================================================
  useEffect(() => {
    let cancelled = false;
    let p: PeerType | null = null;

    (async () => {
      const { default: Peer } = await import('peerjs');
      if (cancelled) return;

      const id = generatePeerId();
      // Public broker server peerjs.com (default config)
      p = new Peer(id, {
        debug: 1,
      });
      peerRef.current = p;

      p.on('open', (assignedId: string) => {
        if (cancelled) return;
        setMyId(assignedId);
        setPeerStatus('open');
      });

      p.on('error', (err: Error) => {
        console.error('Peer error:', err);
        if (cancelled) return;
        setPeerStatus('error');
        toast.error(`Lỗi kết nối broker: ${err.message}`);
      });

      // Khi có ai đó connect TỚI mình
      p.on('connection', (conn: DataConnection) => {
        attachConnection(conn);
      });
    })();

    return () => {
      cancelled = true;
      try {
        p?.destroy();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // Attach connection handlers
  // ============================================================
  function attachConnection(conn: DataConnection) {
    connRef.current = conn;
    setConnStatus('connecting');

    conn.on('open', () => {
      setConnStatus('open');
      setConnectedTo(conn.peer);
      toast.success(`Đã kết nối với ${conn.peer}`);
      // Bỏ ?connect= khỏi URL để reload không tự reconnect
      if (searchParams.get('connect')) {
        searchParams.delete('connect');
        setSearchParams(searchParams, { replace: true });
      }
    });

    conn.on('data', (data) => {
      handleIncomingData(data as TransferMessage);
    });

    conn.on('close', () => {
      setConnStatus('closed');
      setConnectedTo(null);
      connRef.current = null;
      toast.info('Đã ngắt kết nối');
    });

    conn.on('error', (err) => {
      console.error('Conn error', err);
      setConnStatus('error');
      toast.error(`Lỗi: ${err.message ?? String(err)}`);
    });
  }

  // ============================================================
  // Connect to remote ID
  // ============================================================
  function connectToRemote() {
    const peer = peerRef.current;
    if (!peer || peerStatus !== 'open') {
      toast.error('Chưa kết nối với broker');
      return;
    }
    const id = remoteId.trim().toUpperCase();
    if (!id) {
      toast.error('Nhập ID đối phương');
      return;
    }
    if (id === myId) {
      toast.error('Không thể tự kết nối với chính mình');
      return;
    }

    const conn = peer.connect(id, {
      reliable: true, // dùng SCTP reliable mode cho file transfer
    });
    attachConnection(conn);
  }

  function disconnect() {
    try {
      connRef.current?.close();
    } catch {
      // ignore
    }
    connRef.current = null;
    setConnStatus('closed');
    setConnectedTo(null);
    receiverRef.current.reset();
  }

  // ============================================================
  // Handle incoming data
  // ============================================================
  function handleIncomingData(msg: TransferMessage) {
    receiverRef.current.handle(msg, {
      onStart: (f) => {
        setReceivingFiles((prev) => [
          ...prev,
          {
            id: f.id,
            name: f.name,
            size: f.size,
            receivedBytes: 0,
            startedAt: performance.now(),
            speed: 0,
            eta: Infinity,
            done: false,
          },
        ]);
        toast.info(`Nhận file: ${f.name} (${formatBytes(f.size)})`);
      },
      onProgress: (f) => {
        const { speed } = recordSample(f.id, f.receivedBytes);
        const remaining = f.size - f.receivedBytes;
        const eta = speed > 0 ? remaining / speed : Infinity;
        setReceivingFiles((prev) =>
          prev.map((x) =>
            x.id === f.id
              ? { ...x, receivedBytes: f.receivedBytes, speed, eta }
              : x,
          ),
        );
      },
      onComplete: (f, blob) => {
        clearSamples(f.id);
        setReceivingFiles((prev) =>
          prev.map((x) =>
            x.id === f.id
              ? { ...x, done: true, receivedBytes: f.size, blob, eta: 0 }
              : x,
          ),
        );
        toast.success(`Đã nhận xong: ${f.name}`);
        // Auto download
        downloadBlob(blob, f.name);
      },
      onCancel: (id) => {
        clearSamples(id);
        setReceivingFiles((prev) =>
          prev.map((x) => (x.id === id ? { ...x, done: true } : x)),
        );
      },
    });
  }

  // ============================================================
  // Send files
  // ============================================================
  async function handleSendFiles(files: FileList | File[]) {
    const conn = connRef.current;
    if (!conn || connStatus !== 'open') {
      toast.error('Chưa kết nối với peer');
      return;
    }

    const arr = Array.from(files);
    for (const file of arr) {
      const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setSendingFiles((prev) => [
        ...prev,
        {
          id: fileId,
          file,
          sent: 0,
          total: file.size,
          done: false,
          startedAt: performance.now(),
          speed: 0,
          eta: Infinity,
        },
      ]);

      try {
        await sendFile(
          file,
          fileId,
          (msg) => {
            try {
              conn.send(msg);
            } catch (e) {
              console.error('Send failed', e);
            }
          },
          (p) => {
            const { speed } = recordSample(p.fileId, p.sent);
            const remaining = p.total - p.sent;
            const eta = speed > 0 ? remaining / speed : Infinity;
            setSendingFiles((prev) =>
              prev.map((x) =>
                x.id === p.fileId
                  ? { ...x, sent: p.sent, speed, eta }
                  : x,
              ),
            );
          },
          undefined,
          // Backpressure: PeerJS expose dataChannel ngoài conn._dataChannel.
          () => {
            const dc = (conn as unknown as { dataChannel?: RTCDataChannel })
              .dataChannel;
            return dc?.bufferedAmount ?? 0;
          },
        );
        clearSamples(fileId);
        setSendingFiles((prev) =>
          prev.map((x) =>
            x.id === fileId
              ? { ...x, sent: file.size, done: true, eta: 0 }
              : x,
          ),
        );
        toast.success(`Đã gửi: ${file.name}`);
      } catch (e) {
        clearSamples(fileId);
        setSendingFiles((prev) =>
          prev.map((x) =>
            x.id === fileId ? { ...x, error: String(e) } : x,
          ),
        );
        toast.error(`Lỗi gửi: ${file.name}`);
      }
    }
  }

  function copyId() {
    navigator.clipboard.writeText(myId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function copyShareLink() {
    const url = `${window.location.origin}/p2p?connect=${myId}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
    toast.success('Đã copy link chia sẻ');
  }

  function regenerateId() {
    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch {
        // ignore
      }
    }
    setMyId('');
    setPeerStatus('init');
    setConnStatus('closed');
    setConnectedTo(null);
    setSendingFiles([]);
    setReceivingFiles([]);
    // Trigger lại useEffect bằng cách reload — đơn giản nhất
    window.location.reload();
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <header className="flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="inline-flex items-center gap-1.5 text-base font-semibold text-foreground">
            <Send className="h-4 w-4" />
            P2P File Transfer
          </h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {/* My ID + Peer status */}
          <section className="border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                ID của bạn
              </h2>
              <PeerStatusBadge status={peerStatus} />
            </div>

            {peerStatus === 'init' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang kết nối broker...
              </div>
            )}

            {peerStatus === 'open' && (
              <>
                <div className="flex items-center gap-2">
                  <code className="flex-1 border border-border bg-background px-3 py-2 text-2xl font-mono font-bold tracking-widest text-primary">
                    {myId}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyId}
                    className="h-10 w-10"
                    title="Copy ID"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyShareLink}
                    className="h-10 w-10"
                    title="Copy share link"
                  >
                    {linkCopied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowQr((v) => !v)}
                    className={cn('h-10 w-10', showQr && 'bg-popover')}
                    title="QR code"
                  >
                    <QrCode className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={regenerateId}
                    className="h-10 w-10"
                    title="Đổi ID mới"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>

                {showQr && (
                  <QrDisplay
                    value={`${window.location.origin}/p2p?connect=${myId}`}
                  />
                )}
              </>
            )}

            {peerStatus === 'error' && (
              <div className="flex items-center justify-between gap-2 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <span>Không kết nối được broker. Thử reload.</span>
                <Button variant="outline" size="sm" onClick={regenerateId}>
                  Thử lại
                </Button>
              </div>
            )}

            <p className="mt-3 text-xs text-muted-foreground">
              Đưa ID, share link, hoặc QR cho đối phương để họ kết nối với bạn.
            </p>
          </section>

          {/* Connect to peer */}
          <section className="border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Kết nối tới đối phương
              </h2>
              <ConnStatusBadge status={connStatus} connectedTo={connectedTo} />
            </div>

            {connStatus !== 'open' ? (
              <div className="flex gap-2">
                <Input
                  value={remoteId}
                  onChange={(e) => setRemoteId(e.target.value.toUpperCase())}
                  placeholder="Nhập ID 6 ký tự"
                  maxLength={6}
                  disabled={peerStatus !== 'open' || connStatus === 'connecting'}
                  className="h-10 font-mono text-lg tracking-widest"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') connectToRemote();
                  }}
                />
                <Button
                  onClick={connectToRemote}
                  disabled={
                    peerStatus !== 'open' ||
                    connStatus === 'connecting' ||
                    remoteId.trim().length < 6
                  }
                  className="h-10 gap-1.5"
                >
                  {connStatus === 'connecting' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wifi className="h-4 w-4" />
                  )}
                  Kết nối
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 border border-green-500/30 bg-green-500/5 px-3 py-2 text-sm text-green-500">
                <span className="inline-flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  Đã kết nối với <code className="font-mono font-bold">{connectedTo}</code>
                </span>
                <Button variant="outline" size="sm" onClick={disconnect} className="gap-1.5">
                  <WifiOff className="h-3 w-3" />
                  Ngắt
                </Button>
              </div>
            )}
          </section>

          {/* File transfer area */}
          {connStatus === 'open' && (
            <section className="space-y-3">
              <FileDropzone
                onFiles={handleSendFiles}
                onPickClick={() => fileInputRef.current?.click()}
              />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleSendFiles(e.target.files);
                  }
                  e.target.value = '';
                }}
              />

              {sendingFiles.length > 0 && (
                <div className="border border-border bg-card">
                  <div className="border-b border-border bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Đang gửi ({sendingFiles.length})
                  </div>
                  <ul>
                    {sendingFiles.map((f) => (
                      <SendingRow
                        key={f.id}
                        item={f}
                        onRemove={() =>
                          setSendingFiles((prev) => prev.filter((x) => x.id !== f.id))
                        }
                      />
                    ))}
                  </ul>
                </div>
              )}

              {receivingFiles.length > 0 && (
                <div className="border border-border bg-card">
                  <div className="border-b border-border bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Đã nhận ({receivingFiles.length})
                  </div>
                  <ul>
                    {receivingFiles.map((f) => (
                      <ReceivingRow
                        key={f.id}
                        item={f}
                        onRemove={() =>
                          setReceivingFiles((prev) => prev.filter((x) => x.id !== f.id))
                        }
                      />
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Help */}
          <details className="border border-border bg-card p-4 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-semibold text-foreground">
              Cách dùng
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>2 thiết bị mở cùng trang này.</li>
              <li>
                Bên A đưa <strong>ID</strong> cho bên B (qua chat, miệng, QR...).
              </li>
              <li>
                Bên B nhập ID đó vào ô <em>Kết nối tới đối phương</em> rồi bấm{' '}
                <em>Kết nối</em>.
              </li>
              <li>Sau khi nối, kéo-thả file vào hoặc click chọn để gửi.</li>
              <li>
                Bên nhận sẽ tự động download file khi nhận xong (browser có thể hỏi
                xác nhận lần đầu).
              </li>
            </ol>
            <p className="mt-2 text-[11px]">
              File truyền trực tiếp peer-to-peer qua WebRTC, KHÔNG qua server. Broker
              chỉ dùng để 2 peer tìm thấy nhau lúc đầu.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================
function PeerStatusBadge({ status }: { status: 'init' | 'open' | 'error' }) {
  const cfg = {
    init: { label: 'Đang kết nối', cls: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-500' },
    open: { label: 'Sẵn sàng', cls: 'border-green-500/30 bg-green-500/5 text-green-500' },
    error: { label: 'Lỗi', cls: 'border-destructive/30 bg-destructive/5 text-destructive' },
  }[status];
  return (
    <span className={cn('border px-2 py-0.5 text-[10px] uppercase tracking-wider', cfg.cls)}>
      {cfg.label}
    </span>
  );
}

function ConnStatusBadge({
  status,
  connectedTo,
}: {
  status: ConnectionStatus;
  connectedTo: string | null;
}) {
  if (status === 'open' && connectedTo) {
    return (
      <span className="border border-green-500/30 bg-green-500/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-green-500">
        Đã nối
      </span>
    );
  }
  if (status === 'connecting') {
    return (
      <span className="border border-yellow-500/30 bg-yellow-500/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-yellow-500">
        Đang nối
      </span>
    );
  }
  return (
    <span className="border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
      Chưa nối
    </span>
  );
}

function FileDropzone({
  onFiles,
  onPickClick,
}: {
  onFiles: (files: FileList | File[]) => void;
  onPickClick: () => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onClick={onPickClick}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files.length > 0) onFiles(e.dataTransfer.files);
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center border-2 border-dashed border-border bg-card py-10 text-center transition-colors',
        over && 'border-primary bg-popover',
      )}
    >
      <Upload className="mb-2 h-8 w-8 text-primary" />
      <p className="text-sm font-medium text-foreground">Kéo-thả file vào đây để gửi</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Hoặc click để chọn nhiều file
      </p>
    </div>
  );
}

function SendingRow({
  item,
  onRemove,
}: {
  item: SendingItem;
  onRemove: () => void;
}) {
  const pct = item.total > 0 ? (item.sent / item.total) * 100 : 0;
  return (
    <li className="border-b border-border last:border-b-0">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <Upload className="h-3.5 w-3.5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-foreground">{item.file.name}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
            <span>
              {formatBytes(item.sent)} / {formatBytes(item.total)} · {pct.toFixed(0)}%
            </span>
            {!item.done && item.speed > 0 && (
              <>
                <span className="font-mono">{formatSpeed(item.speed)}</span>
                <span>ETA {formatDuration(item.eta)}</span>
              </>
            )}
            {item.done && <span className="text-green-500">✓ Xong</span>}
            {item.error && <span className="text-destructive">{item.error}</span>}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onRemove} className="h-6 w-6">
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="h-0.5 w-full bg-background">
        <div
          className={cn(
            'h-full transition-all',
            item.done ? 'bg-green-500' : 'bg-primary',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
}

function ReceivingRow({
  item,
  onRemove,
}: {
  item: ReceivedItem;
  onRemove: () => void;
}) {
  const pct = item.size > 0 ? (item.receivedBytes / item.size) * 100 : 0;
  return (
    <li className="border-b border-border last:border-b-0">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <Download className="h-3.5 w-3.5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-foreground">{item.name}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
            <span>
              {formatBytes(item.receivedBytes)} / {formatBytes(item.size)} ·{' '}
              {pct.toFixed(0)}%
            </span>
            {!item.done && item.speed > 0 && (
              <>
                <span className="font-mono">{formatSpeed(item.speed)}</span>
                <span>ETA {formatDuration(item.eta)}</span>
              </>
            )}
            {item.done && <span className="text-green-500">✓ Xong</span>}
          </div>
        </div>
        {item.done && item.blob && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadBlob(item.blob!, item.name)}
            className="h-7 gap-1 px-2 text-xs"
          >
            <Download className="h-3 w-3" />
            Tải lại
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onRemove} className="h-6 w-6">
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="h-0.5 w-full bg-background">
        <div
          className={cn(
            'h-full transition-all',
            item.done ? 'bg-green-500' : 'bg-primary',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// QrDisplay — render QR code SVG (lazy import qrcode)
// ============================================================
function QrDisplay({ value }: { value: string }) {
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const qrcode = await import('qrcode');
      const out = await qrcode.toString(value, {
        type: 'svg',
        margin: 1,
        color: { dark: '#fff', light: '#0000' },
        width: 240,
      });
      if (!cancelled) setSvg(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <div className="mt-3 flex flex-col items-center gap-2 border border-border bg-background p-4">
      {svg ? (
        <div
          className="h-[240px] w-[240px]"
          dangerouslySetInnerHTML={{ __html: svg }}
          aria-label="QR code"
        />
      ) : (
        <div className="flex h-[240px] w-[240px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      <code className="break-all text-center text-[10px] text-muted-foreground">
        {value}
      </code>
    </div>
  );
}
