import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc =
  `${window.location.origin}/hubibo/pdf.worker.min.mjs`;

console.log(
  'WORKER:',
  pdfjs.GlobalWorkerOptions.workerSrc
);
