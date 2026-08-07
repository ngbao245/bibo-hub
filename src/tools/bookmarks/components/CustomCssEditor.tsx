import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  RotateCcw,
  Sun,
  Moon,
  ChevronDown,
  MoreVertical,
  Trash2,
  Pencil,
  Plus,
  Check,
  X,
  Search,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/cn';

import BookmarkFavicon from './BookmarkFavicon';
import BookmarkPageStyle from './BookmarkPageStyle';
import type { Bookmark, BookmarkCategory, BookmarkPreset, BookmarkProfile } from '../types';
import { profileToSnapshot } from '../types';
import {
  useBookmarkPresets,
  useCreateBookmarkPreset,
  useUpdateBookmarkPreset,
  useDeleteBookmarkPreset,
  useUpdateBookmarkProfile,
} from '../api';

// ============================================================
// CustomCssEditor — fullscreen split-view editor
// Left: CSS textarea. Right: live preview mirroring actual page.
// Presets: dropdown + save/rename/delete. Draft auto-save via debounce 10s.
// ============================================================

interface Props {
  profile: BookmarkProfile;
  categories: BookmarkCategory[];
  bookmarks: Bookmark[];
  onClose: () => void;
  isSaving?: boolean;
}

const PLACEHOLDER = `/* Example — target category badges */
.bookmark-category-badge {
  font-family: 'Georgia', serif;
  letter-spacing: 0.05em;
}

/* Custom favicon hover */
.bookmark-favicon:hover {
  transform: scale(1.15);
  transition: transform 200ms ease;
}
`;

const DRAFT_DEBOUNCE_MS = 10_000;

export default function CustomCssEditor({
  profile,
  categories,
  bookmarks,
  onClose,
  isSaving,
}: Props) {
  const presetsQuery = useBookmarkPresets();
  const presets = presetsQuery.data ?? [];
  const activePreset = useMemo(
    () => (profile.activePresetId ? presets.find((p) => p.id === profile.activePresetId) : null),
    [presets, profile.activePresetId],
  );

  // Baseline = what "saved" state currently is: active preset css (if any) else empty.
  // When no preset active, textarea starts blank — profile.customCss still applies to page
  // via BookmarkPageStyle, but editor only shows preset content when one is selected.
  const baselineCss = activePreset ? activePreset.css : '';

  // Initial draft: prefer explicit draft in profile, else baseline.
  const [draft, setDraft] = useState<string>(() =>
    profile.customCssDraft ?? baselineCss,
  );
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>(
    profile.theme === 'light' ? 'light' : 'dark',
  );

  // Modal + dropdown state
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [confirmApply, setConfirmApply] = useState<BookmarkPreset | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  // Rebase draft when active preset content changes (e.g. after apply from elsewhere).
  useEffect(() => {
    // Reset draft to baseline only if there's no unsaved draft persisted.
    if (profile.customCssDraft === null) {
      setDraft(baselineCss);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.activePresetId]);

  const isModified = draft !== baselineCss;

  // Debounced draft save into profile.custom_css_draft.
  const updateProfile = useUpdateBookmarkProfile();
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    // If draft matches baseline → clear draft field in DB (only when previously had draft).
    if (!isModified && profile.customCssDraft !== null) {
      draftSaveTimer.current = setTimeout(() => {
        updateProfile.mutate({ customCssDraft: null });
      }, DRAFT_DEBOUNCE_MS);
      return () => {
        if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
      };
    }
    if (!isModified) return;
    // Skip when identical to already-persisted draft.
    if (draft === profile.customCssDraft) return;
    draftSaveTimer.current = setTimeout(() => {
      updateProfile.mutate({ customCssDraft: draft });
    }, DRAFT_DEBOUNCE_MS);
    return () => {
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, baselineCss, profile.customCssDraft]);

  // Mutations
  const createPreset = useCreateBookmarkPreset();
  const updatePreset = useUpdateBookmarkPreset();
  const deletePreset = useDeleteBookmarkPreset();

  function handleDiscard() {
    if (!isModified) return;
    if (!window.confirm('Bỏ toàn bộ thay đổi chưa lưu?')) return;
    setDraft(baselineCss);
    updateProfile.mutate({ customCssDraft: null });
  }

  function handleReset() {
    if (!window.confirm('Xoá toàn bộ CSS trong editor? (Không xoá preset đã lưu)')) return;
    setDraft('');
  }

  // NOTE: `onSave` prop closes the editor + reopens Settings dialog (parent behavior).
  // We do NOT call it inside preset flows because:
  //   1. Editor should stay open when applying/saving preset (user may switch again).
  //   2. Calling onSave triggers a parent updateProfile mutation running in parallel
  //      with our internal preset-related mutation → race condition on profile fields
  //      (last-write-wins loses either customCss or activePresetId).
  // Instead, all preset flows commit a single `updateProfile.mutate(patch)` with the
  // complete set of profile changes. Editor stays open. Draft is cleared server-side.

  function handleSaveChanges() {
    if (!activePreset || !isModified) return;
    updatePreset.mutate(
      { id: activePreset.id, css: draft },
      {
        onSuccess: () => {
          updateProfile.mutate({ customCss: draft, customCssDraft: null });
          toast.success(`Đã cập nhật preset "${activePreset.name}"`);
        },
      },
    );
  }

  function handleSaveAs(name: string, includeSettings: boolean) {
    const snapshot = includeSettings ? profileToSnapshot(profile) : null;
    createPreset.mutate(
      { name, css: draft, snapshot },
      {
        onSuccess: (created) => {
          updateProfile.mutate({
            customCss: draft,
            activePresetId: created.id,
            customCssDraft: null,
          });
          setSaveAsOpen(false);
          toast.success(`Đã tạo preset "${created.name}"`);
        },
      },
    );
  }

  function handleApplyPreset(preset: BookmarkPreset) {
    if (preset.id === profile.activePresetId && preset.css === draft) return;
    if (preset.includesSettings && preset.settingsSnapshot) {
      setConfirmApply(preset);
      return;
    }
    doApply(preset);
  }

  function doApply(preset: BookmarkPreset) {
    setDraft(preset.css);
    const patch = {
      customCss: preset.css,
      activePresetId: preset.id,
      customCssDraft: null,
    } as Record<string, unknown>;
    if (preset.includesSettings && preset.settingsSnapshot) {
      const s = preset.settingsSnapshot;
      Object.assign(patch, {
        backgroundType: s.backgroundType,
        backgroundValue: s.backgroundValue,
        backgroundOverlayColor: s.backgroundOverlayColor,
        backgroundOverlayOpacity: s.backgroundOverlayOpacity,
        backgroundBlendMode: s.backgroundBlendMode,
        categoryLabelColor: s.categoryLabelColor,
        categoryBgColor: s.categoryBgColor,
        bookmarkTitleColor: s.bookmarkTitleColor,
        heroTitleColor: s.heroTitleColor,
        heroSpaceColor: s.heroSpaceColor,
        heroUrlColor: s.heroUrlColor,
        iconBackdrop: s.iconBackdrop,
        columnCount: s.columnCount,
        iconSize: s.iconSize,
        theme: s.theme,
      });
    }
    updateProfile.mutate(patch);
    setConfirmApply(null);
    toast.success(`Đã áp dụng preset "${preset.name}"`);
  }

  function handleDetachPreset() {
    updateProfile.mutate({
      customCss: draft,
      activePresetId: null,
      customCssDraft: null,
    });
    toast.success('Đã tách khỏi preset');
  }

  function handleDeletePreset(preset: BookmarkPreset) {
    if (!window.confirm(`Xoá preset "${preset.name}"?`)) return;
    deletePreset.mutate(preset.id, {
      onSuccess: () => toast.success('Đã xoá preset'),
    });
  }

  function startRename(preset: BookmarkPreset) {
    setRenamingId(preset.id);
    setRenameDraft(preset.name);
  }

  function commitRename() {
    if (!renamingId) return;
    const target = presets.find((p) => p.id === renamingId);
    if (!target) return setRenamingId(null);
    const next = renameDraft.trim();
    if (!next || next === target.name) return setRenamingId(null);
    if (presets.some((p) => p.id !== renamingId && p.name === next)) {
      toast.error('Tên preset đã tồn tại');
      return;
    }
    if (next.length > 60) {
      toast.error('Tên tối đa 60 ký tự');
      return;
    }
    updatePreset.mutate(
      { id: renamingId, name: next },
      {
        onSuccess: () => {
          setRenamingId(null);
          toast.success('Đã đổi tên preset');
        },
      },
    );
  }

  // Preview data
  const bookmarksByCategory = new Map<string, Bookmark[]>();
  for (const b of bookmarks) {
    const arr = bookmarksByCategory.get(b.categoryId) ?? [];
    arr.push(b);
    bookmarksByCategory.set(b.categoryId, arr);
  }
  const columnCount = profile.columnCount;
  const gridCols = ['', 'grid-cols-1', 'grid-cols-1 md:grid-cols-2', 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3', 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'][columnCount] ?? 'grid-cols-3';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-border/60 bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Đóng">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-foreground">Custom CSS</h1>
            <p className="truncate text-[11px] text-muted-foreground">
              Áp dụng cho cả edit page và public page. Advanced.
            </p>
          </div>

          {/* Preset dropdown */}
          <div className="ml-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5">
                  <span
                    className={cn(
                      'max-w-[180px] truncate text-xs',
                      !activePreset && 'text-muted-foreground italic',
                    )}
                  >
                    {activePreset
                      ? activePreset.name
                      : presets.length === 0
                        ? 'No presets yet'
                        : 'Choose a preset…'}
                    {isModified && <span className="ml-1 not-italic text-primary">*</span>}
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {presets.length === 0 ? (
                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                    Chưa có preset
                  </DropdownMenuItem>
                ) : (
                  presets.map((p) => (
                    <PresetRow
                      key={p.id}
                      preset={p}
                      isActive={p.id === profile.activePresetId}
                      isRenaming={renamingId === p.id}
                      renameDraft={renameDraft}
                      onRenameDraft={setRenameDraft}
                      onApply={() => handleApplyPreset(p)}
                      onStartRename={() => startRename(p)}
                      onCommitRename={commitRename}
                      onCancelRename={() => setRenamingId(null)}
                      onDelete={() => handleDeletePreset(p)}
                    />
                  ))
                )}
                {activePreset && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleDetachPreset} className="text-xs">
                      Tách khỏi preset (giữ CSS)
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setSaveAsOpen(true)} className="text-xs">
                  <Plus className="mr-1.5 h-3 w-3" />
                  Save as new preset...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Preview theme toggle */}
          <div className="flex items-center gap-0.5 rounded-md border border-border/60 p-0.5">
            <button
              type="button"
              onClick={() => setPreviewTheme('light')}
              className={cn(
                'inline-flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium transition-colors cursor-pointer',
                previewTheme === 'light'
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              title="Preview light"
            >
              <Sun className="h-3 w-3" /> Light
            </button>
            <button
              type="button"
              onClick={() => setPreviewTheme('dark')}
              className={cn(
                'inline-flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium transition-colors cursor-pointer',
                previewTheme === 'dark'
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              title="Preview dark"
            >
              <Moon className="h-3 w-3" /> Dark
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Clear
          </Button>
          {isModified && (
            <Button variant="outline" size="sm" onClick={handleDiscard} disabled={isSaving}>
              Discard
            </Button>
          )}
          {/* Save button — split based on state */}
          {activePreset ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" disabled={!isModified || isSaving} className="gap-1">
                  {isSaving ? 'Đang lưu…' : 'Save'}
                  <ChevronDown className="h-3 w-3 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={handleSaveChanges} className="text-xs">
                  <Check className="mr-1.5 h-3 w-3" />
                  Save changes to "{activePreset.name}"
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSaveAsOpen(true)} className="text-xs">
                  <Plus className="mr-1.5 h-3 w-3" />
                  Save as new preset...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              size="sm"
              onClick={() => setSaveAsOpen(true)}
              disabled={!isModified || isSaving}
            >
              {isSaving ? 'Đang lưu…' : 'Save as preset...'}
            </Button>
          )}
        </div>
      </header>

      {/* Split view */}
      <div className="flex-1 grid min-h-0 grid-cols-1 md:grid-cols-2">
        {/* Editor pane */}
        <div className="flex flex-col border-b border-border/60 md:border-b-0 md:border-r">
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
            <span className="font-mono">style.css</span>
            <span className="ml-auto tabular-nums">
              {draft.length}/4000
            </span>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 4000))}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            aria-label="Custom CSS editor"
            className="flex-1 resize-none border-0 bg-background px-4 py-3 font-mono text-xs text-foreground focus:outline-none"
          />
        </div>

        {/* Preview pane */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse [animation-duration:2s] motion-reduce:animate-none" />
            </span>
            <span className="font-semibold uppercase tracking-wider">Live Preview</span>
            {isModified && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                Unsaved
              </span>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            {/* Preview mirrors actual page structure: `.bibo-bookmark-page` root + header + `.flex-1` content wrapper.
                Passing `profile` to BookmarkPageStyle so Settings-driven CSS rules (bg, overlay, badge, title colors)
                apply here too — preview then matches the saved result 1:1. */}
            <BookmarkPageStyle theme={previewTheme} customCss={draft} profile={profile}>
              <div className="bibo-bookmark-page relative flex min-h-full flex-col">
                <header className="bibo-bookmark-header sticky top-0 z-10 border-b border-border/50 bg-background/80 px-4 py-3 backdrop-blur-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">Bookmarks</span>
                    <div className="relative ml-auto max-w-[180px] flex-1">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search..."
                        readOnly
                        tabIndex={-1}
                        onFocus={(e) => e.target.blur()}
                        className="pointer-events-none h-7 w-full cursor-default select-none rounded-md border border-input bg-background pl-7 pr-2 text-[11px] text-muted-foreground placeholder:text-muted-foreground/60"
                      />
                    </div>
                  </div>
                </header>
                <div className="relative z-10 flex-1 overflow-visible p-4">
                  <div className={cn('mx-auto grid max-w-7xl gap-6', gridCols)}>
                    {Array.from({ length: columnCount }, (_, colIdx) => {
                      const colCats = categories
                        .filter((c) => c.columnIndex === colIdx)
                        .sort((a, b) => a.orderIndex - b.orderIndex);
                      if (colCats.length === 0) return <div key={colIdx} />;
                      return (
                        <div key={colIdx} className="flex flex-col gap-6">
                          {colCats.map((cat) => (
                            <MiniCategory
                              key={cat.id}
                              cat={cat}
                              bookmarks={bookmarksByCategory.get(cat.id) ?? []}
                              iconSize={profile.iconSize}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                  {categories.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground py-12">
                      Chưa có category để preview.
                    </p>
                  )}
                </div>
              </div>
            </BookmarkPageStyle>
          </div>
        </div>
      </div>

      {/* Save as new preset dialog */}
      {saveAsOpen && (
        <SavePresetDialog
          onCancel={() => setSaveAsOpen(false)}
          onSave={handleSaveAs}
          existingNames={presets.map((p) => p.name)}
          isSaving={createPreset.isPending}
        />
      )}

      {/* Confirm apply full-theme */}
      {confirmApply && (
        <Dialog open onOpenChange={(v) => !v && setConfirmApply(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Áp dụng preset kèm Settings?</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2 text-sm text-muted-foreground">
              <p>
                Preset <strong>&quot;{confirmApply.name}&quot;</strong> bao gồm cả appearance settings
                (background, cột, icon size, màu, theme).
              </p>
              <p>Áp dụng sẽ <strong>ghi đè</strong> Settings hiện tại của bạn. Tiếp tục?</p>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setConfirmApply(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => doApply(confirmApply)}>
                Áp dụng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ============================================================
// Preset row (inside dropdown)
// ============================================================

function PresetRow({
  preset,
  isActive,
  isRenaming,
  renameDraft,
  onRenameDraft,
  onApply,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDelete,
}: {
  preset: BookmarkPreset;
  isActive: boolean;
  isRenaming: boolean;
  renameDraft: string;
  onRenameDraft: (v: string) => void;
  onApply: () => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
}) {
  // Controlled kebab menu: keep open while mouse hovers menu content, close 250ms after leave.
  // Radix default closes on outside interaction; we relax that so user can move cursor from
  // trigger button down to the menu items without the menu snapping shut.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleMenuClose() {
    if (menuCloseTimerRef.current) clearTimeout(menuCloseTimerRef.current);
    menuCloseTimerRef.current = setTimeout(() => setMenuOpen(false), 250);
  }
  function cancelMenuClose() {
    if (menuCloseTimerRef.current) {
      clearTimeout(menuCloseTimerRef.current);
      menuCloseTimerRef.current = null;
    }
  }
  if (isRenaming) {
    return (
      <div className="flex items-center gap-1 px-2 py-1">
        <Input
          value={renameDraft}
          onChange={(e) => onRenameDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onCommitRename();
            }
            if (e.key === 'Escape') onCancelRename();
          }}
          autoFocus
          maxLength={60}
          className="h-7 text-xs"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onCommitRename}
        >
          <Check className="h-3.5 w-3.5 text-success" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onCancelRename}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded px-1 text-xs transition-colors',
        isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted focus-within:bg-muted',
      )}
    >
      <button
        type="button"
        onClick={onApply}
        className={cn(
          'flex flex-1 items-center gap-1 rounded px-1 py-1.5 text-left text-xs transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary',
          isActive ? 'text-primary' : 'text-foreground',
        )}
        aria-label={`Apply preset ${preset.name}`}
        aria-pressed={isActive}
      >
        {isActive && <Check className="h-3 w-3 shrink-0" />}
        <span className={cn('flex-1 truncate', !isActive && 'ml-4')}>{preset.name}</span>
        {preset.includesSettings && (
          <span
            title="Bao gồm Settings"
            className="rounded bg-muted-foreground/15 px-1 text-[9px] font-medium text-muted-foreground"
          >
            THEME
          </span>
        )}
      </button>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            aria-label={`More actions for ${preset.name}`}
            onMouseEnter={cancelMenuClose}
            onMouseLeave={scheduleMenuClose}
          >
            <MoreVertical className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={cancelMenuClose}
          onMouseLeave={scheduleMenuClose}
          className="w-40"
        >
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              cancelMenuClose();
              setMenuOpen(false);
              onStartRename();
            }}
            className="text-xs"
          >
            <Pencil className="mr-1.5 h-3 w-3" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              cancelMenuClose();
              setMenuOpen(false);
              onDelete();
            }}
            className="text-xs text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-1.5 h-3 w-3" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ============================================================
// Save as new preset dialog
// ============================================================

function SavePresetDialog({
  onCancel,
  onSave,
  existingNames,
  isSaving,
}: {
  onCancel: () => void;
  onSave: (name: string, includeSettings: boolean) => void;
  existingNames: string[];
  isSaving: boolean;
}) {
  const [name, setName] = useState('');
  const [includeSettings, setIncludeSettings] = useState(false);
  const trimmed = name.trim();
  const isDuplicate = existingNames.includes(trimmed);
  const tooLong = trimmed.length > 60;
  const canSave = trimmed.length >= 1 && !isDuplicate && !tooLong && !isSaving;

  return (
    <Dialog open onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save as new preset</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Preset name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Glass Purple, Minimal Neon..."
              autoFocus
              maxLength={60}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSave) onSave(trimmed, includeSettings);
              }}
            />
            {isDuplicate && (
              <p className="text-[11px] text-destructive">Tên đã tồn tại</p>
            )}
            {tooLong && (
              <p className="text-[11px] text-destructive">Tối đa 60 ký tự</p>
            )}
          </div>
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 p-2.5 hover:border-primary/40">
            <input
              type="checkbox"
              checked={includeSettings}
              onChange={(e) => setIncludeSettings(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-primary"
            />
            <div className="flex-1 space-y-0.5">
              <div className="text-xs font-medium text-foreground">
                Include current Settings
              </div>
              <div className="text-[11px] text-muted-foreground">
                Snapshot background, cột, icon size, màu, theme. Apply preset sau này sẽ khôi phục
                lại toàn bộ.
              </div>
            </div>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!canSave}
            onClick={() => onSave(trimmed, includeSettings)}
          >
            {isSaving ? 'Đang lưu…' : 'Save preset'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Mini category for preview
// ============================================================

function MiniCategory({
  cat,
  bookmarks,
  iconSize,
}: {
  cat: BookmarkCategory;
  bookmarks: Bookmark[];
  iconSize: number;
}) {
  return (
    <div className="bookmark-category">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="bookmark-category-badge inline-flex items-center rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm">
          {cat.name}
        </span>
      </div>
      <ul
        className="m-0 flex flex-wrap gap-1.5 p-0"
        style={{ listStyle: 'none', minHeight: iconSize + 4 }}
      >
        {bookmarks.slice(0, 30).map((b) => (
          <li key={b.id}>
            <BookmarkFavicon
              faviconUrl={b.faviconUrl}
              title={b.title}
              url={b.url}
              size={iconSize}
              className="bookmark-favicon"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
