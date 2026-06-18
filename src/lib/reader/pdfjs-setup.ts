import { pdfjs } from 'react-pdf';

// Guard: chỉ set nếu chưa được set (main.tsx sẽ set trước)
if (!pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
  console.log('PDF WORKER SETUP EXECUTED (fallback)');
  console.log('WORKER AFTER SET:', pdfjs.GlobalWorkerOptions.workerSrc);
}
