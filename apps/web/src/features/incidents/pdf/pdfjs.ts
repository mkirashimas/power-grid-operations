import type { PDFDocumentLoadingTask } from 'pdfjs-dist';
import type { Attachment } from '../model';
import { getFile } from '../storage/db';

type Pdfjs = typeof import('pdfjs-dist');

let loading: Promise<Pdfjs> | undefined;

/** Loads pdf.js on first use (it is large), with its worker. Browser only. */
export const loadPdfjs = (): Promise<Pdfjs> => {
  loading ??= import('pdfjs-dist').then((pdfjs) => {
    // pdf.js looks for its worker next to its own module, which bundling moves; point it at the
    // worker file the bundler emits.
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).href;
    return pdfjs;
  });
  return loading;
};

export class MissingFileError extends Error {}

/** An attachment's bytes: a sample from /public, or an upload from IndexedDB. */
export const readAttachment = async (attachment: Attachment): Promise<Uint8Array> => {
  if (attachment.source === 'sample' && attachment.url) {
    const response = await fetch(attachment.url);
    if (!response.ok) throw new MissingFileError(attachment.url);
    return new Uint8Array(await response.arrayBuffer());
  }
  const blob = await getFile(attachment.id);
  if (!blob) throw new MissingFileError(attachment.id);
  return new Uint8Array(await blob.arrayBuffer());
};

/**
 * Opens a document. pdf.js 6 never evaluates code from the file; scripting and XFA forms stay
 * off, and missing standard fonts fall back to system fonts.
 */
export const openPdf = (pdfjs: Pdfjs, data: Uint8Array): PDFDocumentLoadingTask =>
  pdfjs.getDocument({
    data,
    enableXfa: false,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });

/** Each page's text items, for search (`findMatches`). */
export const extractText = async (
  doc: Awaited<PDFDocumentLoadingTask['promise']>,
): Promise<string[][]> =>
  Promise.all(
    Array.from({ length: doc.numPages }, async (_, index) => {
      const page = await doc.getPage(index + 1);
      const content = await page.getTextContent();
      return content.items.map((item) => ('str' in item ? item.str : ''));
    }),
  );
