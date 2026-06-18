import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc =
  `${window.location.origin}/hubibo/pdf.worker.min.mjs`;

console.log(
  'window.location.origin',
  window.location.origin
);

console.log(
  'pdfjs version',
  pdfjs.version
);

console.log(
  'WORKER:',
  pdfjs.GlobalWorkerOptions.workerSrc
);
