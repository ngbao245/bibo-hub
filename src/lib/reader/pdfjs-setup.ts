import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc =
  `${import.meta.env.BASE_URL}pdf.worker.min.mjs`;