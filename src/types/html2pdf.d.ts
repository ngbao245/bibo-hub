// html2pdf.js không có types official. Declare tối thiểu cho usage trong app.

declare module 'html2pdf.js' {
  interface Html2PdfInstance {
    set(opts: Record<string, unknown>): Html2PdfInstance;
    from(el: HTMLElement): Html2PdfInstance;
    save(): Promise<void>;
  }
  const html2pdf: () => Html2PdfInstance;
  export default html2pdf;
}

// raw/inline CSS import qua Vite
declare module '*.css?inline' {
  const css: string;
  export default css;
}