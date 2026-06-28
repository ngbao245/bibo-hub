// Export preview element → PDF, force light theme.
// Port từ markdown-live-preview/src/main.js fn `exportPreviewToPdf`.

import html2pdf from 'html2pdf.js';
import lightCss from 'github-markdown-css/github-markdown-light.css?inline';

const A4_CONTENT_WIDTH_MM = '190mm'; // 210mm - 2×10mm margin

export async function exportPreviewToPdf(
  previewElement: HTMLElement,
  filename = 'markdown-preview.pdf',
) {
  const opts = {
    margin: 10,
    filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      onclone: (clonedDoc: Document) => {
        // html2canvas clone DOM vào iframe ẩn, sửa trong clone không ảnh hưởng UI thật.
        clonedDoc.documentElement.setAttribute('data-theme', 'light');

        const style = clonedDoc.createElement('style');
        style.id = 'export-light-css';
        style.textContent = `
${lightCss}
.markdown-body, body {
  background: #fff !important;
  color: #24292f !important;
}
`;
        clonedDoc.head.appendChild(style);

        const cloned = clonedDoc.querySelector<HTMLElement>('[data-md-preview-root]');
        if (cloned) {
          cloned.style.background = '#fff';
          cloned.style.color = '#24292f';
          cloned.style.width = A4_CONTENT_WIDTH_MM;
          cloned.style.maxWidth = A4_CONTENT_WIDTH_MM;
        }
      },
    },
    jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const },
  };

  await html2pdf().set(opts).from(previewElement).save();
}