import { useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  List,
  ListOrdered,
  Code2,
  Heading1,
  Heading2,
  Undo2,
  Redo2,
  BookOpen,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { VocabBlock, VocabCell } from '@/lib/editor/VocabBlock';

import '@/styles/editor.css';

// ============================================================
// RichEditor - Tiptap-based WYSIWYG editor
// ============================================================
//
// Features:
// - Bold / Italic / Underline / Strike
// - Highlight (mark, vàng nhạt)
// - Bullet / Ordered list
// - Code block
// - Heading H1, H2
// - Undo / Redo (Tiptap built-in qua history)
// - Vocab Block (custom, giữ tương thích data v1)
// - Placeholder khi rỗng
//
// Selection được expose qua `onEditorReady` để parent dùng (vd word count).
// onChange callback emit HTML đã serialize → save vào DB y như v1 lưu.
// ============================================================

interface RichEditorProps {
  /** Nội dung HTML khởi tạo (từ DB) */
  value: string;
  /** Callback khi nội dung đổi - phát HTML đã serialize */
  onChange: (html: string) => void;
  /** Placeholder hiển thị khi editor rỗng */
  placeholder?: string;
  /** Callback nhận editor instance (cho word count, focus...) */
  onEditorReady?: (editor: Editor) => void;
}

export default function RichEditor({ value, onChange, placeholder, onEditorReady }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // StarterKit đã có heading/lists/code/history sẵn
      }),
      Underline,
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Bắt đầu viết...',
      }),
      VocabBlock,
      VocabCell,
    ],
    content: value,
    onUpdate: ({ editor: ed }) => {
      if (ed.isDestroyed) return;
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'tiptap',
      },
      // Tab = 4 spaces (v1 behavior)
      handleKeyDown: (_view, event) => {
        if (event.key === 'Tab') {
          event.preventDefault();
          if (editor && !editor.isDestroyed) {
            editor.commands.insertContent('    ');
          }
          return true;
        }
        return false;
      },
    },
  });

  // 📚 useEffect: khi value prop đổi (vd user select note khác) → set lại content.
  // Phải check editor.getHTML() !== value để tránh reset content khi onUpdate
  // chính nó trigger update prop (vòng lặp infinite).
  useEffect(() => {
    if (!editor) return;
    if (editor.isDestroyed) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  // 📚 Khi editor ready, gọi callback (để parent gắn word counter)
  useEffect(() => {
    if (!editor) return;
    if (editor.isDestroyed) return;
    onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  if (!editor) return null;

  return (
    <div className="flex h-full flex-col overflow-hidden border border-input bg-background">
      <Toolbar editor={editor} />
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// ============================================================
// Toolbar - các nút format
// ============================================================
function Toolbar({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-card px-1 py-1">
      <ToolbarButton
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline (Ctrl+U)"
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        active={editor.isActive('highlight')}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        title="Highlight"
      >
        <Highlighter className="h-4 w-4" />
      </ToolbarButton>

      <Separator />

      <ToolbarButton
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>

      <Separator />

      <ToolbarButton
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered list"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>

      <Separator />

      <ToolbarButton
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title="Code block"
      >
        <Code2 className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        active={false}
        onClick={() => editor.chain().focus().insertVocabBlock().run()}
        title="Vocab block"
      >
        <BookOpen className="h-4 w-4" />
      </ToolbarButton>

      <div className="ml-auto flex items-center gap-0.5">
        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
      </div>
    </div>
  );
}

function Separator() {
  return <span className="mx-0.5 h-5 w-px bg-border" />;
}

function ToolbarButton({
  children,
  active,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn('h-8 w-8', active && 'bg-popover text-primary')}
    >
      {children}
    </Button>
  );
}
