import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  rectangularSelection,
  crosshairCursor,
  placeholder,
} from '@codemirror/view';
import { EditorState, Compartment, type Extension } from '@codemirror/state';
import {
  foldGutter,
  foldKeymap,
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
  HighlightStyle,
  indentUnit,
} from '@codemirror/language';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { xml } from '@codemirror/lang-xml';
import { tags as t } from '@lezer/highlight';
import type { SourceFormat } from './types';

// ============================================================
// CodeMirror 6 setup cho DataEditor.
//
// Cherry-pick extensions thay vì basicSetup để control bundle size +
// load đúng feature cần (line numbers + fold gutter + bracket match +
// indent + history + search + close brackets + active line highlight).
//
// Theme palette Tomorrow Night Bright-ish (key đỏ / string olive /
// number xanh / literal teal) — đồng bộ với `json-highlight.ts` mà
// `NodeDetailsDialog` đang dùng cho code block trong modal.
// ============================================================

// Compartment cho phép reconfigure language extension không cần tạo
// EditorState mới. Khi đổi format → dispatch reconfigure compartment.
export const languageCompartment = new Compartment();

export function getLanguageExtension(format: SourceFormat): Extension {
  switch (format) {
    case 'json':
      return json();
    case 'yaml':
      return yaml();
    case 'xml':
      return xml();
    case 'csv':
      return []; // Plain text — không có language pack cho CSV.
  }
}

const PLACEHOLDERS: Record<SourceFormat, string> = {
  json: 'Dán JSON vào đây...',
  csv: 'Dán CSV vào đây...',
  yaml: 'Dán YAML vào đây...',
  xml: 'Dán XML vào đây...',
};

// Palette match với json-highlight.ts (cho NodeDetailsDialog).
const C = {
  punct: '#C5C8C6',
  key: '#C7444A',
  string: '#9AA83A',
  number: '#6089B4',
  literal: '#408080',
  tag: '#6089B4',
  attr: '#C7822E',
  comment: '#7F8C8D',
  variable: '#D4D4D4',
} as const;

const highlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: C.literal },
  { tag: [t.literal, t.bool, t.null], color: C.literal },
  { tag: t.number, color: C.number },
  { tag: [t.string, t.special(t.string)], color: C.string },
  { tag: [t.propertyName, t.attributeName], color: C.key },
  { tag: t.tagName, color: C.tag },
  // XML attribute name (lezer xml dùng `attributeName` cho attr)
  { tag: t.attributeValue, color: C.string },
  { tag: t.comment, color: C.comment, fontStyle: 'italic' },
  { tag: [t.bracket, t.punctuation, t.separator], color: C.punct },
  { tag: t.operator, color: C.punct },
  { tag: t.variableName, color: C.variable },
  { tag: t.invalid, color: '#FF5370' },
]);

// Editor theme: align với token theme của app (dark + VSCode blue accent).
// Font: copy VSCode default `Consolas, "Courier New", monospace` 14px /
// line-height 19px. `ui-monospace` của shadcn quá mảnh trên Windows.
// `liga: 0, calt: 0` tắt ligature giống VSCode (không biến `=>` thành `⇒`).
export const editorTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      fontSize: '14px',
      backgroundColor: 'transparent',
      color: '#d4d4d4',
    },
    '.cm-scroller': {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontFeatureSettings: '"liga" 0, "calt" 0',
      fontVariationSettings: 'normal',
      lineHeight: '19px',
      letterSpacing: '0px',
    },
    '.cm-content': {
      caretColor: '#d4d4d4',
      padding: '6px 0',
    },
    '.cm-cursor': {
      borderLeftColor: '#d4d4d4',
      borderLeftWidth: '2px',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: '#858585',
      border: 'none',
      borderRight: '1px solid hsl(240 4% 25%)',
      fontVariantNumeric: 'tabular-nums',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 8px 0 0',
      minWidth: '38px',
      width: '38px',
      textAlign: 'right',
      boxSizing: 'border-box',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: '#d4d4d4',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: 'rgba(0, 122, 204, 0.15)',
      border: '1px solid rgba(0, 122, 204, 0.4)',
      color: '#858585',
      borderRadius: '3px',
      padding: '0 4px',
      margin: '0 2px',
    },
    '.cm-foldGutter .cm-gutterElement': {
      cursor: 'pointer',
      color: '#858585',
      padding: '0 4px',
      width: '26px',
      boxSizing: 'border-box',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    '.cm-foldGutter .cm-gutterElement:hover': {
      color: '#d4d4d4',
    },
    '.cm-fold-marker svg': {
      display: 'block',
    },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(0, 122, 204, 0.4) !important',
    },
    '&.cm-focused .cm-selectionBackground': {
      backgroundColor: 'rgba(0, 122, 204, 0.4) !important',
    },
    '.cm-matchingBracket, .cm-nonmatchingBracket': {
      backgroundColor: 'rgba(0, 122, 204, 0.2)',
      outline: '1px solid rgba(0, 122, 204, 0.5)',
    },
    '.cm-searchMatch': {
      backgroundColor: 'rgba(255, 230, 0, 0.25)',
      outline: '1px solid rgba(255, 230, 0, 0.5)',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'rgba(255, 165, 0, 0.4)',
    },
    '.cm-tooltip': {
      backgroundColor: 'hsl(240 2% 18%)',
      border: '1px solid hsl(240 4% 25%)',
      color: '#d4d4d4',
    },
    '.cm-panels': {
      backgroundColor: 'hsl(240 1% 15%)',
      color: '#d4d4d4',
    },
    '.cm-panel.cm-search input': {
      backgroundColor: 'hsl(0 0% 12%)',
      color: '#d4d4d4',
      border: '1px solid hsl(240 4% 25%)',
      padding: '2px 6px',
    },
  },
  { dark: true }
);

/** Build extensions cho 1 EditorView. Truyền onChange để bridge sang React. */
export function buildExtensions(
  format: SourceFormat,
  onChange: (text: string) => void
): Extension[] {
  return [
    // Gutter & visuals
    lineNumbers(),
    highlightActiveLineGutter(),
    foldGutter({
      // SVG chevron giống VSCode codicon `chevron-down` (open) /
      // `chevron-right` (closed). 16x16 viewBox, stroke-based để scale
      // mượt mọi DPI. CSS class .cm-foldGutter set kích cỡ 26px (giống
      // VSCode `.codicon-folding-expanded {width:26px}`).
      markerDOM: (open) => {
        const wrap = document.createElement('span');
        wrap.className = 'cm-fold-marker';
        wrap.setAttribute('aria-hidden', 'true');
        wrap.innerHTML = open
          ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4,6 8,10 12,6"/></svg>'
          : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,4 10,8 6,12"/></svg>';
        return wrap;
      },
    }),
    drawSelection(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),

    // Editing helpers
    history(),
    bracketMatching(),
    closeBrackets(),
    autocompletion({ activateOnTyping: false }), // chỉ hiện khi Ctrl+Space
    indentOnInput(),
    indentUnit.of('  '), // 2 spaces

    // Keymap (Ctrl+Z, Ctrl+F, Tab indent, bracket close, fold...)
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      indentWithTab,
    ]),

    // Language (compartment để reconfigure khi đổi format)
    languageCompartment.of(getLanguageExtension(format)),

    // Placeholder hiển thị khi doc rỗng.
    placeholder(PLACEHOLDERS[format]),

    // Highlight + theme
    syntaxHighlighting(highlightStyle, { fallback: true }),
    editorTheme,

    // Bridge sang React: gọi onChange khi doc thay đổi (user gõ).
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    }),

    EditorState.allowMultipleSelections.of(true),
    // Không add EditorView.lineWrapping → mặc định off (horizontal scroll).
  ];
}