import { memo, useState } from 'react';
import styles from './TreeView.module.css';

// ============================================================
// TreeView - alternative đến GraphView. Pure React, không lib nặng.
// Recursive render JSON object/array với expand/collapse.
// ============================================================

interface TreeViewProps {
  data: unknown;
}

type ValueType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' | 'undefined';

function getValueType(v: unknown): ValueType {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  const t = typeof v;
  if (t === 'object') return 'object';
  if (t === 'string') return 'string';
  if (t === 'number') return 'number';
  if (t === 'boolean') return 'boolean';
  return 'undefined';
}

function renderPrimitive(value: unknown, type: ValueType) {
  if (type === 'string') return <span className={styles.string}>{`"${value}"`}</span>;
  if (type === 'number') return <span className={styles.number}>{String(value)}</span>;
  if (type === 'boolean') return <span className={styles.boolean}>{String(value)}</span>;
  if (type === 'null') return <span className={styles.null}>null</span>;
  return <span>{String(value)}</span>;
}

interface NodeRowProps {
  /** Key của row, null nếu là root */
  nodeKey: string | number | null;
  value: unknown;
  /** Depth dùng để default expand top levels */
  depth: number;
  /** Mặc định expand bao nhiêu level từ root */
  defaultExpandDepth: number;
}

function TreeNodeBase({ nodeKey, value, depth, defaultExpandDepth }: NodeRowProps) {
  const type = getValueType(value);
  const isContainer = type === 'object' || type === 'array';
  const [expanded, setExpanded] = useState(depth < defaultExpandDepth);

  const childCount = isContainer
    ? type === 'array'
      ? (value as unknown[]).length
      : Object.keys(value as Record<string, unknown>).length
    : 0;

  const summary =
    type === 'array' ? `[${childCount} items]` : type === 'object' ? `{${childCount} keys}` : null;

  return (
    <div>
      <div className={styles.row}>
        {isContainer && childCount > 0 ? (
          <span
            className={`${styles.chevron} ${expanded ? styles.expanded : ''}`}
            role="button"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            onClick={() => setExpanded((v) => !v)}
          >
            ▶
          </span>
        ) : (
          <span className={styles.chevronSpacer} />
        )}

        {nodeKey !== null && (
          <>
            <span className={styles.key}>
              {typeof nodeKey === 'number' ? `[${nodeKey}]` : `"${nodeKey}"`}
            </span>
            <span className={styles.colon}>:</span>
          </>
        )}

        {isContainer ? (
          <span className={styles.summary}>{summary}</span>
        ) : (
          renderPrimitive(value, type)
        )}
      </div>

      {isContainer && expanded && childCount > 0 && (
        <div className={styles.children}>
          {type === 'array'
            ? (value as unknown[]).map((child, idx) => (
                <TreeNode
                  key={idx}
                  nodeKey={idx}
                  value={child}
                  depth={depth + 1}
                  defaultExpandDepth={defaultExpandDepth}
                />
              ))
            : Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                <TreeNode
                  key={k}
                  nodeKey={k}
                  value={v}
                  depth={depth + 1}
                  defaultExpandDepth={defaultExpandDepth}
                />
              ))}
        </div>
      )}
    </div>
  );
}

const TreeNode = memo(TreeNodeBase);

export function TreeView({ data }: TreeViewProps) {
  if (data === null || data === undefined) {
    return <div className={styles.empty}>Không có dữ liệu</div>;
  }

  return (
    <div className={styles.container}>
      <TreeNode nodeKey={null} value={data} depth={0} defaultExpandDepth={2} />
    </div>
  );
}