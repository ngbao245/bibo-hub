// Convert markdown string → sanitized HTML.
// Port từ markdown-live-preview/src/main.js fn `convert`.

import { marked } from 'marked';
import DOMPurify from 'dompurify';

// One-time marked config
marked.setOptions({
  gfm: true,
  breaks: false,
});

export function renderMarkdown(md: string): string {
  const html = marked.parse(md) as string;
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target'],
  });
}