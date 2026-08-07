// ============================================================
// PDF Studio Edit PDF — Main toolbar with all target capabilities
// ============================================================

import { useState } from 'react';
import {
  LayoutGrid, Hand, Undo2, Redo2, Type, TextCursor,
  Eraser, Highlighter, Pencil, Image, Square, Circle,
  Minus, ArrowRight, Check, X, PenTool, StickyNote,
  Link2, Columns, FileStack, Wand2, HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';
import { HelpPanel } from './HelpPanel';

// ─── Capability state machine ────────────────────────────────

export type CapabilityState = 'available' | 'processing' | 'unavailable' | 'planned';

export interface ToolDef {
  id: string;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  group: string;
  state: CapabilityState;
  processingReason?: string;
  unavailableReason?: string;
}

// Precedence: processing > unavailable > planned > available
function getEffectiveMessage(tool: ToolDef): string | null {
  if (tool.state === 'processing') return tool.processingReason ?? 'Dang xu ly...';
  if (tool.state === 'unavailable') return tool.unavailableReason ?? 'Khong kha dung voi tai lieu nay.';
  if (tool.state === 'planned') return `Tinh nang "${tool.label}" dang duoc phat trien.`;
  return null;
}

// ─── Tool definitions ────────────────────────────────────────

const TOOLS: ToolDef[] = [
  // Navigation
  { id: 'thumbnails', icon: <LayoutGrid className="h-4 w-4" />, label: 'Thumbnails', group: 'nav', state: 'available' },
  { id: 'move', icon: <Hand className="h-4 w-4" />, label: 'Move', shortcut: 'Space+Drag', group: 'nav', state: 'available' },
  // History
  { id: 'undo', icon: <Undo2 className="h-4 w-4" />, label: 'Undo', shortcut: 'Ctrl+Z', group: 'history', state: 'available' },
  { id: 'redo', icon: <Redo2 className="h-4 w-4" />, label: 'Redo', shortcut: 'Ctrl+Y', group: 'history', state: 'available' },
  // Text
  { id: 'add-text', icon: <Type className="h-4 w-4" />, label: 'Add Text', group: 'text', state: 'available' },
  { id: 'edit-text', icon: <TextCursor className="h-4 w-4" />, label: 'Edit Text', group: 'text', state: 'available' },
  // Markup
  { id: 'eraser', icon: <Eraser className="h-4 w-4" />, label: 'Eraser', group: 'markup', state: 'available' },
  { id: 'highlight', icon: <Highlighter className="h-4 w-4" />, label: 'Highlight', group: 'markup', state: 'available' },
  { id: 'pencil', icon: <Pencil className="h-4 w-4" />, label: 'Pencil', group: 'markup', state: 'available' },
  // Content
  { id: 'image', icon: <Image className="h-4 w-4" />, label: 'Image', group: 'content', state: 'available' },
  // Shapes
  { id: 'rectangle', icon: <Square className="h-4 w-4" />, label: 'Rectangle', group: 'shapes', state: 'available' },
  { id: 'ellipse', icon: <Circle className="h-4 w-4" />, label: 'Ellipse', group: 'shapes', state: 'available' },
  { id: 'line', icon: <Minus className="h-4 w-4" />, label: 'Line', group: 'shapes', state: 'available' },
  { id: 'arrow', icon: <ArrowRight className="h-4 w-4" />, label: 'Arrow', group: 'shapes', state: 'available' },
  // Symbols
  { id: 'check', icon: <Check className="h-4 w-4" />, label: 'Check', group: 'symbols', state: 'available' },
  { id: 'cross', icon: <X className="h-4 w-4" />, label: 'Cross', group: 'symbols', state: 'available' },
  // Document (deferred)
  { id: 'sign', icon: <PenTool className="h-4 w-4" />, label: 'Sign', group: 'document', state: 'planned' },
  { id: 'notes', icon: <StickyNote className="h-4 w-4" />, label: 'Notes', group: 'document', state: 'planned' },
  { id: 'links', icon: <Link2 className="h-4 w-4" />, label: 'Links', group: 'document', state: 'planned' },
  // Page
  { id: 'page-layout', icon: <Columns className="h-4 w-4" />, label: 'Page Layout', group: 'page', state: 'available' },
  { id: 'manage-pages', icon: <FileStack className="h-4 w-4" />, label: 'Manage Pages', group: 'page', state: 'available' },
  // More
  { id: 'more-tools', icon: <Wand2 className="h-4 w-4" />, label: 'More Tools', group: 'more', state: 'planned' },
];

interface EditorToolbarProps {
  activeTool: string | null;
  onToolSelect: (toolId: string) => void;
}

export function EditorToolbar({ activeTool, onToolSelect }: EditorToolbarProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  const handleClick = (tool: ToolDef) => {
    const message = getEffectiveMessage(tool);
    if (message) {
      toast.info(message);
      return;
    }
    onToolSelect(tool.id);
  };

  // Group tools for rendering with separators
  let lastGroup = '';

  return (
    <>
      <div className="flex items-center gap-0.5 border-b border-border bg-background px-3 py-1.5 overflow-x-auto">
        {TOOLS.map((tool) => {
          const showSeparator = lastGroup !== '' && tool.group !== lastGroup;
          lastGroup = tool.group;

          return (
            <div key={tool.id} className="flex items-center">
              {showSeparator && (
                <div className="mx-1 h-5 w-px bg-border" />
              )}
              <button
                onClick={() => handleClick(tool)}
                title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}${tool.state === 'planned' ? ' — Sap co' : ''}`}
                className={cn(
                  'flex flex-col items-center justify-center rounded px-2 py-1.5 text-muted-foreground transition-colors',
                  'hover:bg-muted hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  activeTool === tool.id && tool.state === 'available' && 'bg-primary/10 text-primary',
                  tool.state === 'planned' && 'opacity-60',
                )}
              >
                {tool.icon}
                <span className="mt-0.5 text-[10px] leading-tight whitespace-nowrap">{tool.label}</span>
              </button>
            </div>
          );
        })}

        {/* Help button at the end */}
        <div className="flex items-center">
          <div className="mx-1 h-5 w-px bg-border" />
          <button
            onClick={() => setHelpOpen(!helpOpen)}
            title="Help & Shortcuts"
            className={cn(
              'flex flex-col items-center justify-center rounded px-2 py-1.5 text-muted-foreground transition-colors',
              'hover:bg-muted hover:text-foreground',
              helpOpen && 'bg-primary/10 text-primary',
            )}
          >
            <HelpCircle className="h-4 w-4" />
            <span className="mt-0.5 text-[10px] leading-tight">Help</span>
          </button>
        </div>
      </div>

      {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
    </>
  );
}
