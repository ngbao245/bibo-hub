// Configure pdfjs-dist worker for react-pdf.

//

// Worker được copy vào public/ bởi scripts/copy-pdf-worker.mjs (chạy

// trong prebuild hook). Vercel serve thẳng từ public, MIME đúng, không

// qua SPA rewrite — tránh fake-worker fallback khi rewrite nuốt path.

//

// base của Vite mặc định là '/', nên absolute path '/pdf.worker.min.mjs'

// luôn resolve đúng cả ở dev (vite serve) lẫn prod.

import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';