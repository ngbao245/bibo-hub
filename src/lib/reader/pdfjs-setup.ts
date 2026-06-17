// Configure pdfjs-dist worker for react-pdf.
// Use CDN worker để tránh issues với Vite bundling

import { pdfjs } from 'react-pdf';

// Sử dụng CDN worker - reliable và không có CORS issues
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

if (import.meta.env.DEV) {
    console.log('PDF.js version:', pdfjs.version);
    console.log('PDF.js worker URL:', pdfjs.GlobalWorkerOptions.workerSrc);
}
