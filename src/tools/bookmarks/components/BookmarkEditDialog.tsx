import { useEffect, useRef, useState } from 'react';
import { Upload, RotateCcw, RefreshCw } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { getWorkspaceClient } from '@/lib/workspace/supabase';
import { useAuthStore } from '@/stores/authStore';

import BookmarkFavicon from './BookmarkFavicon';
import { fetchBookmarkMeta } from '../lib/edge-functions';
import { getContrastText } from '../lib/color';
import type { Bookmark, BookmarkCategory } from '../types';

// ============================================================
// BookmarkEditDialog — edit URL, title, note, category, custom icon
// ============================================================

interface BookmarkEditDialogProps {
  open: boolean;
  bookmark: Bookmark | null;
  categories: BookmarkCategory[];
  onClose: () => void;
  onSubmit: (patch: {
    id: string;
    url?: string;
    title?: string;
    note?: string;
    categoryId?: string;
    faviconUrl?: string | null;
    iconType?: 'image' | 'text';
    iconText?: string | null;
    iconRounded?: boolean | null;
    iconBackground?: string | null;
  }) => void;
  onDelete?: (id: string) => void;
  isSubmitting?: boolean;
}

const MAX_ICON_BYTES = 500 * 1024;

// Superdense palette — 16 colors (4x4 grid).
const ICON_BG_PRESETS = [
  '#1FBC9C', '#1CA085', '#2ECC70', '#27AF60',
  '#3398DB', '#2980B9', '#A463BF', '#8E43AD',
  '#3D556E', '#222F3D', '#F2C511', '#F39C19',
  '#E84B3C', '#C0382B', '#DDE6E8', '#BDC3C8',
];

// Diagonal-line "empty" pattern (Superdense uses a slash through white).
const EMPTY_SWATCH_STYLE: React.CSSProperties = {
  background:
    'linear-gradient(135deg, #ffffff calc(50% - 1px), #dc2626 calc(50% - 1px), #dc2626 calc(50% + 1px), #ffffff calc(50% + 1px))',
};

export default function BookmarkEditDialog({
  open,
  bookmark,
  categories,
  onClose,
  onSubmit,
  onDelete,
  isSubmitting,
}: BookmarkEditDialogProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [iconType, setIconType] = useState<'image' | 'text'>('image');
  const [iconText, setIconText] = useState<string>('');
  const [iconRounded, setIconRounded] = useState<boolean>(true);
  const [iconBackground, setIconBackground] = useState<string | null>(null);
  const [textFocusToken, setTextFocusToken] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [refetching, setRefetching] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!bookmark) return;
    setUrl(bookmark.url);
    setTitle(bookmark.title);
    setNote(bookmark.note);
    setCategoryId(bookmark.categoryId);
    setFaviconUrl(bookmark.faviconUrl);
    setIconType(bookmark.iconType);
    setIconText(bookmark.iconText ?? '');
    setIconRounded(bookmark.iconRounded ?? true);
    setIconBackground(bookmark.iconBackground);
  }, [bookmark, open]);

  if (!bookmark) return null;

  async function handleUpload(file: File) {
    if (!bookmark) return;
    if (file.size > MAX_ICON_BYTES) {
      toast.error('Ảnh > 500KB, chọn file nhỏ hơn');
      return;
    }
    const profile = useAuthStore.getState().profile;
    if (!profile) {
      toast.error('Chưa đăng nhập');
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().slice(0, 5);
      const path = `${profile.id}/custom/${bookmark.id}.${ext}?v=${Date.now()}`;
      const cleanPath = path.split('?')[0];
      const client = getWorkspaceClient();
      const { error } = await client.storage
        .from('bookmark-favicons')
        .upload(cleanPath, file, { upsert: true, cacheControl: '2592000' });
      if (error) {
        toast.error('Upload lỗi: ' + error.message);
        return;
      }
      const { data } = client.storage.from('bookmark-favicons').getPublicUrl(cleanPath);
      // Bust CDN cache with query param
      const bustedUrl = `${data.publicUrl}?v=${Date.now()}`;
      setFaviconUrl(bustedUrl);
      toast.success('Đã upload icon');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!bookmark) return;
    if (!/^https?:\/\/.+/i.test(url)) {
      toast.error('URL phải bắt đầu bằng http:// hoặc https://');
      return;
    }

    const patch: {
      id: string;
      url?: string;
      title?: string;
      note?: string;
      categoryId?: string;
      faviconUrl?: string | null;
      iconType?: 'image' | 'text';
      iconText?: string | null;
      iconRounded?: boolean | null;
      iconBackground?: string | null;
    } = {
      id: bookmark.id,
      url: url !== bookmark.url ? url : undefined,
      title: title !== bookmark.title ? title : undefined,
      note: note !== bookmark.note ? note : undefined,
      categoryId: categoryId !== bookmark.categoryId ? categoryId : undefined,
      faviconUrl: faviconUrl !== bookmark.faviconUrl ? faviconUrl : undefined,
      iconType: iconType !== bookmark.iconType ? iconType : undefined,
      iconText:
        (iconText || null) !== bookmark.iconText ? (iconText || null) : undefined,
      iconRounded:
        iconRounded !== (bookmark.iconRounded ?? true) ? iconRounded : undefined,
      iconBackground:
        iconBackground !== bookmark.iconBackground ? iconBackground : undefined,
    };

    // Auto-refetch favicon when URL changed (unless user uploaded custom in same session).
    const urlChanged = url !== bookmark.url;
    const customUploadedThisSession =
      faviconUrl !== bookmark.faviconUrl && faviconUrl !== null;
    if (urlChanged && !customUploadedThisSession) {
      setRefetching(true);
      try {
        const meta = await fetchBookmarkMeta(url);
        if (meta.faviconUrl) patch.faviconUrl = meta.faviconUrl;
        // Only auto-fill title if user didn't manually change it
        if (meta.title && title === bookmark.title) patch.title = meta.title;
      } catch {
        toast.error('Không fetch được favicon mới cho URL này');
      } finally {
        setRefetching(false);
      }
    }

    // No-op guard: nothing changed → close silently
    const hasChange =
      patch.url !== undefined ||
      patch.title !== undefined ||
      patch.note !== undefined ||
      patch.categoryId !== undefined ||
      patch.faviconUrl !== undefined ||
      patch.iconType !== undefined ||
      patch.iconText !== undefined ||
      patch.iconRounded !== undefined ||
      patch.iconBackground !== undefined;
    if (!hasChange) {
      onClose();
      return;
    }

    onSubmit(patch);
  }

  function handleReset() {
    setFaviconUrl(null);
  }

  async function handleRefetch() {
    if (!url || refetching) return;
    setRefetching(true);
    try {
      const meta = await fetchBookmarkMeta(url);
      if (meta.faviconUrl) {
        // Bust CDN cache so the img refreshes visibly
        setFaviconUrl(`${meta.faviconUrl.split('?')[0]}?v=${Date.now()}`);
        toast.success('Đã fetch lại favicon');
      } else {
        toast.error('Không fetch được favicon');
      }
    } catch (e) {
      toast.error('Lỗi refetch: ' + (e as Error).message);
    } finally {
      setRefetching(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sửa bookmark</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {iconType === 'text' ? (
              <IconTextEditable
                value={iconText}
                onChange={setIconText}
                background={iconBackground}
                size={48}
                title={title}
                url={url}
                focusToken={textFocusToken}
              />
            ) : (
              <BookmarkFavicon
                faviconUrl={faviconUrl}
                title={title}
                url={url}
                size={48}
                iconType={iconType}
                iconText={iconText || null}
                iconRounded={iconRounded}
                iconBackground={iconBackground}
              />
            )}
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
              >
                <Upload className="h-3 w-3" />
                {uploading ? 'Đang upload…' : 'Upload custom icon'}
              </button>
              <button
                type="button"
                onClick={handleRefetch}
                disabled={refetching}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary disabled:opacity-50"
                title="Fetch lại favicon từ Google API"
              >
                <RefreshCw className={`h-3 w-3 ${refetching ? 'animate-spin' : ''}`} />
                {refetching ? 'Đang fetch…' : 'Refresh favicon'}
              </button>
              {faviconUrl && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" /> Xoá favicon
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = '';
                }}
              />
            </div>
          </div>

          <Field label="Icon">
            <div className="space-y-2">
              <select
                value={iconType}
                onChange={(e) => {
                  const next = e.target.value as 'image' | 'text';
                  setIconType(next);
                  if (next === 'text') setTextFocusToken((n) => n + 1);
                }}
                className="h-9 w-full border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="image">Image (favicon)</option>
                <option value="text">Text / Emoji</option>
              </select>

              {iconType === 'text' && (
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Click vào icon preview ở trên để nhập text hoặc emoji (1-3 ký tự).
                </p>
              )}

              <div className="flex items-center gap-4 pt-1">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={iconRounded}
                    onChange={(e) => setIconRounded(e.target.checked)}
                    className="h-3.5 w-3.5 cursor-pointer"
                  />
                  Rounded
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={iconBackground !== null}
                    onChange={(e) => setIconBackground(e.target.checked ? '' : null)}
                    className="h-3.5 w-3.5 cursor-pointer"
                  />
                  Background
                </label>

                {iconBackground !== null && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="h-7 w-7 overflow-hidden rounded-md border-2 border-border/60 transition-transform hover:scale-105"
                        title={iconBackground || 'Transparent — click để chọn màu'}
                        style={iconBackground ? { background: iconBackground } : EMPTY_SWATCH_STYLE}
                        aria-label="Chọn màu nền"
                      />
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-2"
                      side="top"
                      align="start"
                      sideOffset={6}
                    >
                      <div className="grid grid-cols-4 gap-1.5">
                        {ICON_BG_PRESETS.map((hex) => {
                          const active =
                            iconBackground?.toLowerCase() === hex.toLowerCase();
                          return (
                            <button
                              key={hex}
                              type="button"
                              onClick={() => setIconBackground(hex)}
                              className={`relative h-8 w-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                                active
                                  ? 'border-primary ring-2 ring-primary/40'
                                  : 'border-black/10'
                              }`}
                              style={{ background: hex }}
                              title={hex}
                              aria-label={hex}
                            >
                              {active && (
                                <span className="absolute inset-0 flex items-center justify-center text-white drop-shadow">
                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 border-t border-border/40 pt-2">
                        <label
                          className="relative h-6 w-6 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border/60"
                          style={{ background: iconBackground || '#1FBC9C' }}
                          title="Custom color"
                        >
                          <input
                            type="color"
                            value={iconBackground || '#1FBC9C'}
                            onChange={(e) => setIconBackground(e.target.value)}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          />
                        </label>
                        <Input
                          value={iconBackground || ''}
                          onChange={(e) => setIconBackground(e.target.value)}
                          placeholder="#hex"
                          className="h-7 flex-1 font-mono text-[11px]"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => setIconBackground('')}
                        >
                          Clear
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          </Field>

          <Field label="URL *">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </Field>

          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>

          <Field label="Category">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-9 w-full border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Ghi chú">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional…"
              className="min-h-[60px] w-full resize-y border border-input bg-background p-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
        </div>

        <DialogFooter className="justify-between">
          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => {
              if (window.confirm(`Xoá "${bookmark.title || bookmark.url}"?`)) {
                onDelete?.(bookmark.id);
              }
            }}
          >
            Xoá
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Huỷ
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || refetching}>
              {refetching ? 'Đang fetch favicon…' : isSubmitting ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Inline-editable text/emoji favicon preview.
// Styled to match the display <BookmarkFavicon> exactly for a seamless "click-to-edit" feel.
function IconTextEditable({
  value,
  onChange,
  background,
  size,
  title,
  url,
  focusToken,
}: {
  value: string;
  onChange: (v: string) => void;
  background: string | null;
  size: number;
  title: string;
  url: string;
  /**
   * Increments each time user picks 'text' from the icon-type dropdown.
   * When it changes (and > 0), the input auto-focuses + selects.
   * Value 0 = initial mount from existing bookmark → no auto-focus (would
   * steal focus from URL/title fields).
   */
  focusToken: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const effectiveBg = background || '#ffffff';
  const textColor = getContrastText(effectiveBg);
  const placeholder = (title.trim() || url.trim() || 'A').charAt(0).toUpperCase();

  useEffect(() => {
    if (focusToken === 0) return;
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => clearTimeout(t);
  }, [focusToken]);

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => {
        // Grapheme-aware slice so multi-codepoint emojis aren't cut in half.
        const chars = Array.from(e.target.value);
        onChange(chars.slice(0, 3).join(''));
      }}
      placeholder={placeholder}
      spellCheck={false}
      autoComplete="off"
      className="bookmark-favicon shrink-0 rounded-[50%] border-0 p-0 text-center font-semibold shadow-sm outline-none ring-1 ring-black/5 transition-shadow duration-200 focus:ring-2 focus:ring-primary/40"
      style={{
        width: size,
        height: size,
        background: effectiveBg,
        color: textColor,
        fontSize: size * 0.42,
        lineHeight: `${size}px`,
        textAlign: 'center',
      }}
      aria-label="Edit icon text or emoji"
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
