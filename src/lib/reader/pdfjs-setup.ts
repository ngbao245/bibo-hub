// Configure pdfjs-dist worker for react-pdf.
// Bundle worker local qua Vite `?url` thay vì CDN: tránh
//  - Fake worker fallback ("Failed to resolve module specifier 'pdf.worker.mjs'")
//    khi CDN bị chặn / CORS / proxy strip.
//  - Version mismatch giữa pdfjs-dist root và bản nested trong react-pdf.
import { pdfjs } from 'react-pdf';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
