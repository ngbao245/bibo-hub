import { Node, mergeAttributes } from '@tiptap/core';
import {
  NodeViewWrapper,
  NodeViewContent,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from '@tiptap/react';
import { X } from 'lucide-react';

// ============================================================
// VocabBlock - custom Tiptap node giữ nguyên feature v1
// ============================================================
//
// Render 4 ô: Definition / Example / Synonym / Antonym (mỗi ô editable).
// Parse được HTML cũ từ DB (class="vocab-block-wrapper") nên data v1 không bị mất.
//
// Cấu trúc node:
//   vocabBlock (block, không editable trực tiếp)
//   ├── vocabCell (atom: 'definition')  → contains paragraphs
//   ├── vocabCell (atom: 'example')
//   ├── vocabCell (atom: 'synonym')
//   └── vocabCell (atom: 'antonym')
//
// Node "wrapper" + 4 child node "cell" cho phép Tiptap quản lý từng ô riêng,
// user gõ trong ô nào nội dung lưu trong ô đó.
// ============================================================

const CELL_KINDS = ['definition', 'example', 'synonym', 'antonym'] as const;
type CellKind = (typeof CELL_KINDS)[number];

const CELL_LABELS: Record<CellKind, string> = {
  definition: 'Definition',
  example: 'Example',
  synonym: 'Synonym',
  antonym: 'Antonym',
};

// ============================================================
// Vocab Cell node - 1 ô bên trong wrapper
// ============================================================
export const VocabCell = Node.create({
  name: 'vocabCell',
  group: 'vocabCell',
  // content: paragraph hoặc inline content - cho phép user gõ chữ thường
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      kind: {
        default: 'definition',
        parseHTML: (el) => {
          const cls = el.getAttribute('class') ?? '';
          for (const k of CELL_KINDS) {
            if (cls.includes(`vocab-${k}`)) return k;
          }
          return 'definition';
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div.vocab-cell',
        // Cell wrapper. Children được parse bởi rule trong vocab-content (xem dưới).
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const kind = HTMLAttributes.kind as CellKind;
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: `vocab-cell vocab-${kind}` }),
      ['div', { class: 'vocab-label', contenteditable: 'false' }, CELL_LABELS[kind]],
      ['div', { class: 'vocab-content' }, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VocabCellView);
  },
});

function VocabCellView({ node }: NodeViewProps) {
  const kind = (node.attrs.kind as CellKind) ?? 'definition';
  return (
    <NodeViewWrapper as="div" className={`vocab-cell vocab-${kind}`}>
      <div className="vocab-label" contentEditable={false}>
        {CELL_LABELS[kind]}
      </div>
      <NodeViewContent className="vocab-content" />
    </NodeViewWrapper>
  );
}

// ============================================================
// Vocab Block wrapper - chứa 4 cell
// ============================================================
export const VocabBlock = Node.create({
  name: 'vocabBlock',
  group: 'block',
  content: 'vocabCell vocabCell vocabCell vocabCell',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div.vocab-block-wrapper' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'vocab-block-wrapper' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VocabBlockView);
  },

  addCommands() {
    return {
      insertVocabBlock:
        () =>
        ({ chain }) => {
          // Tạo 1 vocab block với 4 cell rỗng
          return chain()
            .focus()
            .insertContent({
              type: 'vocabBlock',
              content: CELL_KINDS.map((kind) => ({
                type: 'vocabCell',
                attrs: { kind },
                content: [{ type: 'paragraph' }],
              })),
            })
            .run();
        },
    };
  },
});

function VocabBlockView({ deleteNode }: NodeViewProps) {
  return (
    <NodeViewWrapper as="div" className="vocab-block-wrapper">
      <button
        type="button"
        contentEditable={false}
        onClick={() => deleteNode()}
        className="vocab-delete-btn"
        title="Xoá vocab block"
      >
        <X size={12} />
      </button>
      <NodeViewContent />
    </NodeViewWrapper>
  );
}

// ============================================================
// Type augment cho command insertVocabBlock (TS biết command này tồn tại)
// ============================================================
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    vocabBlock: {
      insertVocabBlock: () => ReturnType;
    };
  }
}
