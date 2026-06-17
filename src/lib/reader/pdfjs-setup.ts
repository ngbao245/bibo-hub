// Configure pdfjs-dist worker for react-pdf.
// Vite bundles the worker .mjs as a separate asset and gives us a URL.

import { pdfjs } from 'react-pdf';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;