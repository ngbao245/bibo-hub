import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

console.log(
  'WORKER FINAL:',
  pdfjs.GlobalWorkerOptions.workerSrc
);