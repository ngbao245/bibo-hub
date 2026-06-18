// Configure pdfjs-dist worker for react-pdf.
import { pdfjs } from 'react-pdf';

// Sử dụng CDN worker (không bundle với Vite)
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
