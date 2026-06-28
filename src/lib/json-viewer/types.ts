import type { JSONPath, Node } from 'jsonc-parser';

// ============================================================
// Types cho JSON viewer - extract từ jsoncrack-react
// Apache 2.0 license, giữ nguyên structure để tương thích parser/canvasHelpers
// ============================================================

export interface NodeRow {
  key: string | null;
  value: string | number | null | boolean;
  type: Node['type'];
  childrenCount?: number;
  to?: string[];
}

export interface NodeData {
  id: string;
  text: Array<NodeRow>;
  width: number;
  height: number;
  path?: JSONPath;
  parentKey?: string;
  parentType?: string;
}

export interface EdgeData {
  id: string;
  from: string;
  to: string;
  text: string | null;
}

export interface GraphData {
  nodes: NodeData[];
  edges: EdgeData[];
}

export type LayoutDirection = 'LEFT' | 'RIGHT' | 'DOWN' | 'UP';

export type CanvasThemeMode = 'light' | 'dark';

// Source format mà user import vào
export type SourceFormat = 'json' | 'csv' | 'yaml' | 'xml';

// View mode: graph hay tree
export type ViewMode = 'graph' | 'tree';