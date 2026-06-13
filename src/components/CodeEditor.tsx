
import { useCallback, useRef } from 'react';
import { cn } from '@/lib/cn';

// ============================================================
// CodeEditor — textarea with line numbers + VSCode shortcuts
// ============================================================
//
// Quan trọng: dùng document.execCommand('insertText'/'delete') thay vì
// set value programmatically. Lý do: execCommand fire native input event
// → React state sync + browser undo stack (Ctrl+Z) hoạt động bình thường.
// Nếu set value trực tiếp qua onChange thì undo stack bị xoá.
//
// VSCode-like behavior:
//   - Ctrl+C no selection: copy whole line + '\n'
//   - Ctrl+X no selection: cut whole line + '\n'
//   - Ctrl+V no selection:
//       * Clipboard ends with '\n' → insert above current line
//       * Otherwise → inline paste
//   - Ctrl+D: duplicate current line
//   - Tab/Shift+Tab: indent/dedent 2 spaces
//   - Ctrl+Z/Y: native undo/redo
// ============================================================

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function CodeEditor({
  value,
  onChange,
  placeholder,
  className,
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lines = value.split('\n');
  const lineCount = lines.length || 1;

  /** Replace text in textarea từ start→end bằng `replacement`, giữ undo stack. */
  function replaceRange(
    ta: HTMLTextAreaElement,
    start: number,
    end: number,
    replacement: string,
    finalCursor: number,
  ) {
    ta.focus();
    ta.setSelectionRange(start, end);
    if (replacement === '') {
      document.execCommand('delete');
    } else {
      document.execCommand('insertText', false, replacement);
    }
    ta.setSelectionRange(finalCursor, finalCursor);
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const ta = e.currentTarget;
      const { selectionStart, selectionEnd, value: val } = ta;
      const hasSelection = selectionStart !== selectionEnd;

      // --- Ctrl+C no selection: copy line + \n ---
      if (e.ctrlKey && e.key === 'c' && !hasSelection) {
        e.preventDefault();
        const { lineStart, lineEnd } = getLineRange(val, selectionStart);
        navigator.clipboard.writeText(val.slice(lineStart, lineEnd) + '\n');
        return;
      }

      // --- Ctrl+X no selection: cut line ---
      if (e.ctrlKey && e.key === 'x' && !hasSelection) {
        e.preventDefault();
        const { lineStart, lineEnd } = getLineRange(val, selectionStart);
        navigator.clipboard.writeText(val.slice(lineStart, lineEnd) + '\n');

        let removeStart = lineStart;
        let removeEnd = lineEnd;
        if (lineEnd < val.length) {
          removeEnd = lineEnd + 1;
        } else if (lineStart > 0) {
          removeStart = lineStart - 1;
        }
        replaceRange(ta, removeStart, removeEnd, '', removeStart);
        return;
      }

      // --- Ctrl+V no selection ---
      if (e.ctrlKey && e.key === 'v' && !hasSelection) {
        e.preventDefault();
        navigator.clipboard.readText().then((clipText) => {
          if (!clipText) return;
          const cur = textareaRef.current;
          if (!cur) return;
          const current = cur.value;
          const cursorPos = cur.selectionStart;

          if (clipText.endsWith('\n')) {
            // Whole-line paste → insert trước dòng hiện tại
            const { lineStart } = getLineRange(current, cursorPos);
            replaceRange(cur, lineStart, lineStart, clipText, cursorPos + clipText.length);
          } else {
            // Inline paste
            replaceRange(cur, cursorPos, cursorPos, clipText, cursorPos + clipText.length);
          }
        });
        return;
      }

      // --- Ctrl+D: duplicate line ---
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        const { lineStart, lineEnd } = getLineRange(val, selectionStart);
        const lineText = val.slice(lineStart, lineEnd);
        replaceRange(ta, lineEnd, lineEnd, '\n' + lineText, selectionStart + lineText.length + 1);
        return;
      }

      // --- Tab: indent ---
      if (e.key === 'Tab' && !e.ctrlKey) {
        e.preventDefault();
        if (e.shiftKey) {
          const { lineStart } = getLineRange(val, selectionStart);
          if (val.slice(lineStart).startsWith('  ')) {
            replaceRange(ta, lineStart, lineStart + 2, '', Math.max(lineStart, selectionStart - 2));
          }
        } else {
          replaceRange(ta, selectionStart, selectionEnd, '  ', selectionStart + 2);
        }
        return;
      }
    },
    [],
  );

  return (
    <div className={cn('flex flex-1 overflow-hidden', className)}>
      <div
        className="flex shrink-0 flex-col items-end overflow-hidden border-r border-border bg-card px-2 py-3 font-mono text-[10px] leading-5 text-muted-foreground/50 select-none"
        aria-hidden
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <span key={i}>{i + 1}</span>
        ))}
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        spellCheck={false}
        className="flex-1 resize-none bg-background p-3 font-mono text-xs leading-5 focus:outline-none"
      />
    </div>
  );
}

function getLineRange(text: string, cursor: number): { lineStart: number; lineEnd: number } {
  let lineStart = cursor;
  while (lineStart > 0 && text[lineStart - 1] !== '\n') lineStart--;
  let lineEnd = cursor;
  while (lineEnd < text.length && text[lineEnd] !== '\n') lineEnd++;
  return { lineStart, lineEnd };
}