
import { useCallback, useEffect, useRef, useState } from 'react';
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
  getIceServers,
  type TransferMessage,
} from '@/lib/p2p/transfer';
import {
  setOffer,
  setAnswer,
  getOfferSdp,
  listenAnswer,
  pushCandidate,
  listenCandidates,
  deleteRoom,
  roomExists,
} from '@/lib/p2p/firebase';

// ============================================================
// P2P File Transfer — WebRTC + Firebase Signaling
// ============================================================
//
// Flow giống PeerJS cũ nhưng dùng Firebase Realtime DB thay broker:
// 1. Trang load → sinh ID 6 chars
// 2. Bên A: bấm "Đợi kết nối" → tạo offer, ghi lên Firebase room
// 3. Bên B: nhập ID bên A → đọc offer, tạo answer, ghi lên Firebase
// 4. Bên A: listen answer → nhận → WebRTC nối → xoá room
// 5. Truyền file qua DataChannel
// ============================================================

type PeerStatus = 'idle' | 'waiting' | 'connecting' | 'connected' | 'error';

interface ErrorInfo {
  title: string;
  detail: string;
  hint?: string;
}

interface SendingItem {
  id: string;
  file: File;
  sent: number;
  total: number;
  done: boolean;
  startedAt: number;
  speed: number;
  eta: number;
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
  const [myId] = useState(() => generatePeerId());
  const [peerStatus, setPeerStatus] = useState<PeerStatus>('idle');
  const [remoteId, setRemoteId] = useState('');
  const [connectedTo, setConnectedTo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [sendingFiles, setSendingFiles] = useState<SendingItem[]>([]);
  const [receivingFiles, setReceivingFiles] = useState<ReceivedItem[]>([]);
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const receiverRef = useRef<FileReceiver>(new FileReceiver());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const speedSamplesRef = useRef<Map<string, { time: number; bytes: number }[]>>(new Map());
  // Diagnostics
  const iceErrorsRef = useRef<Array<{ url?: string; code?: number; text?: string }>>([]);
  const localCandidateCountRef = useRef(0);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const autoConnectId = searchParams.get('connect')?.toUpperCase() ?? '';

  // ============================================================
  // Speed/ETA
  // ============================================================
  function recordSample(fileId: string, bytes: number): { speed: number; eta: number } {
    const now = performance.now();
    let samples = speedSamplesRef.current.get(fileId);
    if (!samples) {
      samples = [];
      speedSamplesRef.current.set(fileId, samples);
    }
    samples.push({ time: now, bytes });
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
  // Setup DataChannel
  // ============================================================
  const setupDC = useCallback((dc: RTCDataChannel) => {
    dcRef.current = dc;
    dc.binaryType = 'arraybuffer';

    dc.onopen = () => {
      setPeerStatus('connected');
      toast.success('Sẵn sàng truyền file!');
    };

    dc.onclose = () => {
      setPeerStatus('idle');
      setConnectedTo(null);
      toast.info('Đã ngắt kết nối');
    };

    dc.onmessage = (event) => {
      let msg: TransferMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === 'chunk' && typeof (msg as unknown as { b64: string }).b64 === 'string') {
        const b64 = (msg as unknown as { b64: string }).b64;
        const binary = atob(b64);
        const buf = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
        msg = { ...msg, data: buf.buffer };
      }
      handleIncomingData(msg);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // Phân tích lỗi kết nối → message dễ hiểu
  // ============================================================
  function analyzeFailure(): ErrorInfo {
    const errors = iceErrorsRef.current;
    const noLocal = localCandidateCountRef.current === 0;

    // Tất cả TURN/STUN đều fail DNS lookup
    const allDnsFailed = errors.length > 0 && errors.every((e) => e.code === 701);
    if (allDnsFailed) {
      return {
        title: 'Mạng đang chặn STUN/TURN servers',
        detail: 'Tất cả STUN/TURN domain đều không lookup được. Mạng (firewall/ISP) đang block.',
        hint: 'Thử: đổi DNS sang 1.1.1.1, dùng VPN, hoặc chuyển sang 4G hotspot.',
      };
    }

    // Có lookup được nhưng không gather được candidate nào
    if (noLocal) {
      return {
        title: 'Không thu thập được ICE candidate',
        detail: 'Browser không sinh ra candidate nào — mạng có thể block UDP outbound.',
        hint: 'Thử dùng mạng khác (4G hotspot, mạng nhà). WebRTC cần UDP để hoạt động.',
      };
    }

    // Có candidate nhưng vẫn fail
    const turnErrors = errors.filter((e) => e.url?.startsWith('turn'));
    if (turnErrors.length > 0) {
      return {
        title: 'TURN server không hoạt động',
        detail: `TURN auth/connect fail: ${turnErrors[0].text ?? 'unknown'}`,
        hint: 'TURN credentials có thể đã hết hạn. Liên hệ admin để cập nhật.',
      };
    }

    return {
      title: 'Kết nối WebRTC thất bại',
      detail: 'Không thể thiết lập kết nối P2P giữa 2 thiết bị.',
      hint: 'Thử reload và kết nối lại. Nếu vẫn fail, kiểm tra mạng.',
    };
  }

  // ============================================================
  // Create PeerConnection
  // ============================================================
  async function createPC(): Promise<RTCPeerConnection> {
    iceErrorsRef.current = [];
    localCandidateCountRef.current = 0;

    const iceServers = await getIceServers();
    const pc = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: 'relay', // ép qua TURN, bypass UDP block
    });
    pcRef.current = pc;

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
        setPeerStatus('connected');
        setErrorInfo(null);
      } else if (pc.connectionState === 'failed') {
        if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
        const info = analyzeFailure();
        setErrorInfo(info);
        setPeerStatus('error');
        toast.error(info.title);
      } else if (pc.connectionState === 'disconnected') {
        setPeerStatus('error');
        setErrorInfo({
          title: 'Mất kết nối',
          detail: 'Đối phương ngắt kết nối hoặc mạng gián đoạn.',
        });
      }
    };

    return pc;
  }

  // ============================================================
  // Host: Tạo room, đợi peer kết nối (trickle ICE)
  // ============================================================
  async function startHosting() {
    setPeerStatus('waiting');

    try {
      const pc = await createPC();
      const dc = pc.createDataChannel('file-transfer', { ordered: true });
      setupDC(dc);

      // Logging chi tiết
      pc.oniceconnectionstatechange = () => {
        // ICE state changed
      };
      pc.onicegatheringstatechange = () => {
        // gathering state changed
      };

      pc.addEventListener('icecandidateerror', (e: Event) => {
        const err = e as RTCPeerConnectionIceErrorEvent;
        iceErrorsRef.current.push({
          url: err.url,
          code: err.errorCode,
          text: err.errorText,
        });
      });

      // Trickle ICE: push candidate lên Firebase ngay khi sinh ra
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          localCandidateCountRef.current++;
          pushCandidate(myId, 'offer', e.candidate.toJSON()).catch(() => {
            /* ignore push errors */
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await setOffer(myId, pc.localDescription!.toJSON());

      // Queue candidates đến trước khi có remoteDescription
      const pendingCandidates: RTCIceCandidateInit[] = [];
      let remoteSet = false;

      const unsubCand = listenCandidates(myId, 'answer', async (cand) => {
        if (!remoteSet) {
          pendingCandidates.push(cand);
          return;
        }
        try {
          await pc.addIceCandidate(cand);
        } catch {
          /* ignore */
        }
      });

      const unsubAns = listenAnswer(myId, async (sdp) => {
        if (pc.currentRemoteDescription) return;
        try {
          await pc.setRemoteDescription(sdp);
          remoteSet = true;
          for (const cand of pendingCandidates) {
            try {
              await pc.addIceCandidate(cand);
            } catch {
              /* ignore */
            }
          }
          pendingCandidates.length = 0;
        } catch {
          setPeerStatus('error');
        }
      });

      unsubRef.current = () => {
        unsubCand();
        unsubAns();
      };

      // Timeout 30s — nếu không connect được thì báo lỗi
      connectTimeoutRef.current = setTimeout(() => {
        if (peerStatus !== 'connected' && pc.connectionState !== 'connected') {
          const info = analyzeFailure();
          setErrorInfo(info);
          setPeerStatus('error');
          toast.error(info.title);
        }
      }, 30000);

      toast.success('Đang đợi kết nối...');
    } catch (e) {
      setPeerStatus('error');
      toast.error(`Lỗi: ${String(e)}`);
    }
  }

  // ============================================================
  // Join: Kết nối tới room của host (trickle ICE)
  // ============================================================
  async function joinRoom(targetId: string) {
    const id = targetId.trim().toUpperCase();
    if (!id || id.length < 6) {
      toast.error('Nhập ID 6 ký tự');
      return;
    }
    if (id === myId) {
      toast.error('Không thể kết nối với chính mình');
      return;
    }

    setPeerStatus('connecting');

    try {
      const exists = await roomExists(id);
      if (!exists) {
        toast.error('Không tìm thấy phòng. Đối phương chưa bấm "Đợi kết nối".');
        setPeerStatus('idle');
        return;
      }

      const offerSdp = await getOfferSdp(id);
      if (!offerSdp) {
        toast.error('Không đọc được offer');
        setPeerStatus('idle');
        return;
      }

      const pc = await createPC();
      pc.ondatachannel = (event) => {
        setupDC(event.channel);
      };

      pc.oniceconnectionstatechange = () => {
        // ICE state changed
      };
      pc.onicegatheringstatechange = () => {
        // gathering state changed
      };

      pc.addEventListener('icecandidateerror', (e: Event) => {
        const err = e as RTCPeerConnectionIceErrorEvent;
        iceErrorsRef.current.push({
          url: err.url,
          code: err.errorCode,
          text: err.errorText,
        });
      });

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          localCandidateCountRef.current++;
          pushCandidate(id, 'answer', e.candidate.toJSON()).catch(() => {
            /* ignore */
          });
        }
      };

      // setRemoteDescription FIRST → sau đó mới subscribe candidates
      await pc.setRemoteDescription(offerSdp);

      const unsubCand = listenCandidates(id, 'offer', async (cand) => {
        try {
          await pc.addIceCandidate(cand);
        } catch {
          /* ignore */
        }
      });
      unsubRef.current = unsubCand;

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await setAnswer(id, pc.localDescription!.toJSON());
      setConnectedTo(id);
      toast.info('Đang kết nối...');

      // Timeout 30s
      connectTimeoutRef.current = setTimeout(() => {
        if (pc.connectionState !== 'connected') {
          const info = analyzeFailure();
          setErrorInfo(info);
          setPeerStatus('error');
          toast.error(info.title);
        }
      }, 30000);

      if (searchParams.get('connect')) {
        searchParams.delete('connect');
        setSearchParams(searchParams, { replace: true });
      }
    } catch (e) {
      setPeerStatus('error');
      toast.error(`Lỗi kết nối: ${String(e)}`);
    }
  }

  // ============================================================
  // Auto-connect from URL
  // ============================================================
  useEffect(() => {
    if (!autoConnectId || peerStatus !== 'idle') return;
    if (autoConnectId === myId) return;
    setRemoteId(autoConnectId);
    const t = setTimeout(() => joinRoom(autoConnectId), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnectId]);

  // ============================================================
  // Disconnect
  // ============================================================
  function disconnect() {
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    unsubRef.current?.();
    unsubRef.current = null;
    try { dcRef.current?.close(); } catch { /* */ }
    try { pcRef.current?.close(); } catch { /* */ }
    dcRef.current = null;
    pcRef.current = null;
    setPeerStatus('idle');
    setConnectedTo(null);
    setErrorInfo(null);
    setSendingFiles([]);
    setReceivingFiles([]);
    receiverRef.current.reset();
    speedSamplesRef.current.clear();
    deleteRoom(myId).catch(() => {});
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubRef.current?.();
      try { dcRef.current?.close(); } catch { /* */ }
      try { pcRef.current?.close(); } catch { /* */ }
      deleteRoom(myId).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // Handle incoming data
  // ============================================================
  function handleIncomingData(msg: TransferMessage) {
    receiverRef.current.handle(msg, {
      onStart: (f) => {
        setReceivingFiles((prev) => [
          ...prev,
          { id: f.id, name: f.name, size: f.size, receivedBytes: 0, startedAt: performance.now(), speed: 0, eta: Infinity, done: false },
        ]);
        toast.info(`Nhận file: ${f.name} (${formatBytes(f.size)})`);
      },
      onProgress: (f) => {
        const { speed } = recordSample(f.id, f.receivedBytes);
        const remaining = f.size - f.receivedBytes;
        const eta = speed > 0 ? remaining / speed : Infinity;
        setReceivingFiles((prev) => prev.map((x) => x.id === f.id ? { ...x, receivedBytes: f.receivedBytes, speed, eta } : x));
      },
      onComplete: (f, blob) => {
        clearSamples(f.id);
        setReceivingFiles((prev) => prev.map((x) => x.id === f.id ? { ...x, done: true, receivedBytes: f.size, blob, eta: 0 } : x));
        toast.success(`Đã nhận xong: ${f.name}`);
        downloadBlob(blob, f.name);
      },
      onCancel: (id) => {
        clearSamples(id);
        setReceivingFiles((prev) => prev.map((x) => x.id === id ? { ...x, done: true } : x));
      },
    });
  }

  // ============================================================
  // Send files
  // ============================================================
  async function handleSendFiles(files: FileList | File[]) {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') {
      toast.error('Chưa kết nối');
      return;
    }

    const arr = Array.from(files);
    for (const file of arr) {
      const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setSendingFiles((prev) => [
        ...prev,
        { id: fileId, file, sent: 0, total: file.size, done: false, startedAt: performance.now(), speed: 0, eta: Infinity },
      ]);

      try {
        await sendFile(
          file,
          fileId,
          (msg) => {
            if (msg.type === 'chunk') {
              const bytes = new Uint8Array(msg.data);
              let binary = '';
              for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
              dc.send(JSON.stringify({ type: 'chunk', id: msg.id, index: msg.index, b64: btoa(binary) }));
            } else {
              dc.send(JSON.stringify(msg));
            }
          },
          (p) => {
            const { speed } = recordSample(p.fileId, p.sent);
            const remaining = p.total - p.sent;
            const eta = speed > 0 ? remaining / speed : Infinity;
            setSendingFiles((prev) => prev.map((x) => x.id === p.fileId ? { ...x, sent: p.sent, speed, eta } : x));
          },
          undefined,
          () => dc.bufferedAmount,
        );
        clearSamples(fileId);
        setSendingFiles((prev) => prev.map((x) => x.id === fileId ? { ...x, sent: file.size, done: true, eta: 0 } : x));
        toast.success(`Đã gửi: ${file.name}`);
      } catch (e) {
        clearSamples(fileId);
        setSendingFiles((prev) => prev.map((x) => x.id === fileId ? { ...x, error: String(e) } : x));
        toast.error(`Lỗi gửi: ${file.name}`);
      }
    }
  }

  // ============================================================
  // Helpers
  // ============================================================
  function copyId() {
    navigator.clipboard.writeText(myId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function copyShareLink() {
    const currentPath = window.location.pathname;
    const url = `${window.location.origin}${currentPath}?connect=${myId}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
    toast.success('Đã copy link chia sẻ');
  }

  // ============================================================
  // Render
  // ============================================================
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
          {/* My ID + Status */}
          <section className="border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                ID của bạn
              </h2>
              <PeerStatusBadge status={peerStatus} />
            </div>

            <div className="flex items-center gap-2">
              <code className="flex-1 border border-border bg-background px-3 py-2 text-2xl font-mono font-bold tracking-widest text-primary">
                {myId}
              </code>
              <Button variant="outline" size="icon" onClick={copyId} className="h-10 w-10" title="Copy ID">
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" onClick={copyShareLink} className="h-10 w-10" title="Copy share link">
                {linkCopied ? <Check className="h-4 w-4 text-success" /> : <Link2 className="h-4 w-4" />}
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
              <Button variant="outline" size="icon" onClick={() => window.location.reload()} className="h-10 w-10" title="Đổi ID mới">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {showQr && (
              <QrDisplay value={`${window.location.origin}${window.location.pathname}?connect=${myId}`} />
            )}

            {peerStatus === 'idle' && (
              <div className="mt-3">
                <Button onClick={startHosting} className="gap-2">
                  <Wifi className="h-4 w-4" />
                  Đợi kết nối
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Bấm để mở phòng. Đưa ID, share link, hoặc QR cho đối phương.
                </p>
              </div>
            )}

            {peerStatus === 'waiting' && (
              <div className="mt-3 flex items-center gap-2 text-sm text-warning">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang đợi đối phương kết nối...
              </div>
            )}
          </section>

          {/* Connect to peer */}
          <section className="border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Kết nối tới đối phương
              </h2>
              {connectedTo && peerStatus === 'connected' && (
                <span className="border border-success/30 bg-success/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-success">
                  Đã nối
                </span>
              )}
            </div>

            {peerStatus !== 'connected' ? (
              <div className="flex gap-2">
                <Input
                  value={remoteId}
                  onChange={(e) => setRemoteId(e.target.value.toUpperCase())}
                  placeholder="Nhập ID 6 ký tự"
                  maxLength={6}
                  disabled={peerStatus === 'connecting'}
                  className="h-10 font-mono text-lg tracking-widest"
                  onKeyDown={(e) => { if (e.key === 'Enter') joinRoom(remoteId); }}
                />
                <Button
                  onClick={() => joinRoom(remoteId)}
                  disabled={peerStatus === 'connecting' || remoteId.trim().length < 6}
                  className="h-10 gap-1.5"
                >
                  {peerStatus === 'connecting' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wifi className="h-4 w-4" />
                  )}
                  Kết nối
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
                <span className="inline-flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  Đã kết nối
                </span>
                <Button variant="outline" size="sm" onClick={disconnect} className="gap-1.5">
                  <WifiOff className="h-3 w-3" />
                  Ngắt
                </Button>
              </div>
            )}
          </section>

          {/* Error details */}
          {errorInfo && peerStatus === 'error' && (
            <section className="border border-destructive/40 bg-destructive/5 p-4">
              <h3 className="text-sm font-semibold text-destructive flex items-center gap-2">
                <WifiOff className="h-4 w-4" />
                {errorInfo.title}
              </h3>
              <p className="mt-2 text-xs text-foreground">{errorInfo.detail}</p>
              {errorInfo.hint && (
                <div className="mt-2 border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                  {errorInfo.hint}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={disconnect}>
                  Reset
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.open('https://test.webrtc.org/', '_blank')}>
                  Test mạng
                </Button>
              </div>
            </section>
          )}

          {/* File transfer area */}
          {peerStatus === 'connected' && (
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
                  if (e.target.files && e.target.files.length > 0) handleSendFiles(e.target.files);
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
                      <SendingRow key={f.id} item={f} onRemove={() => setSendingFiles((prev) => prev.filter((x) => x.id !== f.id))} />
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
                      <ReceivingRow key={f.id} item={f} onRemove={() => setReceivingFiles((prev) => prev.filter((x) => x.id !== f.id))} />
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
              <li>Bên A bấm <strong>Đợi kết nối</strong> để mở phòng.</li>
              <li>Đưa <strong>ID</strong> cho bên B (qua chat, miệng, QR, share link...).</li>
              <li>Bên B nhập ID đó vào ô <em>Kết nối tới đối phương</em> rồi bấm <em>Kết nối</em>.</li>
              <li>Sau khi nối, kéo-thả file vào hoặc click chọn để gửi.</li>
              <li>Bên nhận tự động download file khi nhận xong.</li>
            </ol>
            <p className="mt-2 text-[11px]">
              File truyền trực tiếp peer-to-peer qua WebRTC. Không đi qua server.
              Firebase chỉ dùng để 2 peer tìm nhau lúc đầu (signaling).
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

function PeerStatusBadge({ status }: { status: PeerStatus }) {
  const cfg: Record<PeerStatus, { label: string; cls: string }> = {
    idle: { label: 'Chưa mở phòng', cls: 'border-border bg-background text-muted-foreground' },
    waiting: { label: 'Đang đợi', cls: 'border-warning/30 bg-warning/5 text-warning' },
    connecting: { label: 'Đang nối', cls: 'border-warning/30 bg-warning/5 text-warning' },
    connected: { label: 'Đã kết nối', cls: 'border-success/30 bg-success/5 text-success' },
    error: { label: 'Lỗi', cls: 'border-destructive/30 bg-destructive/5 text-destructive' },
  };
  const c = cfg[status];
  return (
    <span className={cn('border px-2 py-0.5 text-[10px] uppercase tracking-wider', c.cls)}>
      {c.label}
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
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
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
      <p className="mt-1 text-xs text-muted-foreground">Hoặc click để chọn nhiều file</p>
    </div>
  );
}

function SendingRow({ item, onRemove }: { item: SendingItem; onRemove: () => void }) {
  const pct = item.total > 0 ? (item.sent / item.total) * 100 : 0;
  return (
    <li className="border-b border-border last:border-b-0">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <Upload className="h-3.5 w-3.5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-foreground">{item.file.name}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
            <span>{formatBytes(item.sent)} / {formatBytes(item.total)} · {pct.toFixed(0)}%</span>
            {!item.done && item.speed > 0 && (
              <>
                <span className="font-mono">{formatSpeed(item.speed)}</span>
                <span>ETA {formatDuration(item.eta)}</span>
              </>
            )}
            {item.done && <span className="text-success">Xong</span>}
            {item.error && <span className="text-destructive">{item.error}</span>}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onRemove} className="h-6 w-6">
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="h-0.5 w-full bg-background">
        <div className={cn('h-full transition-all', item.done ? 'bg-success' : 'bg-primary')} style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

function ReceivingRow({ item, onRemove }: { item: ReceivedItem; onRemove: () => void }) {
  const pct = item.size > 0 ? (item.receivedBytes / item.size) * 100 : 0;
  return (
    <li className="border-b border-border last:border-b-0">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <Download className="h-3.5 w-3.5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-foreground">{item.name}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
            <span>{formatBytes(item.receivedBytes)} / {formatBytes(item.size)} · {pct.toFixed(0)}%</span>
            {!item.done && item.speed > 0 && (
              <>
                <span className="font-mono">{formatSpeed(item.speed)}</span>
                <span>ETA {formatDuration(item.eta)}</span>
              </>
            )}
            {item.done && <span className="text-success">Xong</span>}
          </div>
        </div>
        {item.done && item.blob && (
          <Button variant="outline" size="sm" onClick={() => downloadBlob(item.blob!, item.name)} className="h-7 gap-1 px-2 text-xs">
            <Download className="h-3 w-3" />
            Tải lại
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onRemove} className="h-6 w-6">
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="h-0.5 w-full bg-background">
        <div className={cn('h-full transition-all', item.done ? 'bg-success' : 'bg-primary')} style={{ width: `${pct}%` }} />
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

// QR Display — lazy import qrcode
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
    return () => { cancelled = true; };
  }, [value]);

  return (
    <div className="mt-3 flex flex-col items-center gap-2 border border-border bg-background p-4">
      {svg ? (
        <div className="h-[240px] w-[240px]" dangerouslySetInnerHTML={{ __html: svg }} aria-label="QR code" />
      ) : (
        <div className="flex h-[240px] w-[240px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      <code className="break-all text-center text-[10px] text-muted-foreground">{value}</code>
    </div>
  );
}