// ============================================================
// Project Packer types
// ============================================================

/** Một file đã đọc xong, sẵn sàng để pack */
export interface PackedFile {
  path: string;     // Relative path: "src/App.tsx"
  content: string;  // Nội dung text
  size: number;     // Số byte (UTF-8)
  chunkIndex?: number;
  chunkTotal?: number;
}

/** Một file user đã chọn (chưa đọc content) */
export interface SelectedFile {
  file: File;
  path: string;
  selected: boolean;
}

/** Một "part" output sau khi pack */
export interface PackPart {
  index: number;        // 1-based
  total: number;        // Tổng số part
  content: string;      // Text đầy đủ (kèm markers)
  charCount: number;    // Số ký tự, để hiển thị
  fileNames: string[];  // Tên file trong part (cho preview)
}

/** Tuỳ chỉnh khi pack */
export interface PackOptions {
  /** Số ký tự tối đa mỗi part. Mặc định 50,000 (an toàn chat). */
  maxCharsPerPart: number;
  /** Glob/string patterns để loại trừ */
  excludePatterns: string[];
  /** Extensions được phép pack. Empty = pack tất cả text files. */
  includeExtensions: string[];
}

/** Preset cho từng loại project */
export interface PackerPreset {
  id: string;
  label: string;
  excludePatterns: string[];
  includeExtensions: string[];
}

/** Log entry trong terminal */
export interface LogEntry {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  timestamp: Date;
}
