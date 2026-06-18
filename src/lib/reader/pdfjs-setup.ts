// Configure pdfjs-dist worker for react-pdf.

// Vite bundle worker qua ?url → emit vào dist/assets/ với hash.

// Cần vercel.json rewrite exclude /assets/* để Vercel không SPA-redirect

// worker file về index.html.

import { pdfjs } from 'react-pdf';

import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;