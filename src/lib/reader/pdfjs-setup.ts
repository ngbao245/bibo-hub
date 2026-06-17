// Configure pdfjs-dist worker for react-pdf.
// Dùng CDN unpkg để tránh path resolve sai trên các deploy environment
// có rewrite rules / base path khác nhau.

import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
