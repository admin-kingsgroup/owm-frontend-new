/**
 * Reading a PDF bank statement into words with their positions on the page.
 *
 * Two ways in, tried in order:
 *
 * 1. **The PDF's own text.** A statement downloaded from net banking is made of real text, which
 *    pdf.js reads exactly, with no guessing — fast and right every time.
 * 2. **OCR**, only when a page has no text to read: a scan, or a photo saved as PDF. Each page is
 *    drawn onto a canvas and Tesseract reads the picture. It is slower (a few seconds a page) and
 *    can misread a figure, which is why the review step checks every line against the running
 *    balance before anything is sent.
 *
 * Both run in the browser. The statement never leaves the person's computer to be read — only
 * the lines they approve are sent, and only to OWM. The OCR engine's program and its English
 * language data are downloaded from a CDN the first time, then cached by the browser.
 *
 * Both libraries are loaded only when a PDF is actually opened, so nobody pays for them otherwise.
 */

export interface PositionedWord {
  text: string;
  /** Left and right edges, top and bottom — in page units, top-down. */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface PdfWords {
  pages: PositionedWord[][];
  /** True when the text came from OCR rather than from the PDF itself. */
  ocr: boolean;
}

/** The PDF is locked. `incorrect` says whether a password was tried and refused. */
export class PdfPasswordError extends Error {
  readonly incorrect: boolean;

  constructor(incorrect: boolean) {
    super(
      incorrect ? 'That password did not open the PDF.' : 'This PDF is protected by a password.',
    );
    this.name = 'PdfPasswordError';
    this.incorrect = incorrect;
  }
}

export type Progress = (message: string) => void;

/** Fewer characters than this on a page means there is no text layer worth reading — a scan. */
const MIN_TEXT_PER_PAGE = 40;
/** Bank statements run to a few dozen pages; past this, something else has been uploaded. */
const MAX_PAGES = 60;
/** How much larger than the page a scan is drawn for OCR. Higher reads small print better, slower. */
const OCR_SCALE = 2.5;

type PdfDocument = import('pdfjs-dist').PDFDocumentProxy;

async function loadPdfJs() {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

/** Splits a run of text pdf.js handed over as one item where it has wide gaps inside it. */
function splitItem(
  text: string,
  x: number,
  width: number,
  top: number,
  bottom: number,
): PositionedWord[] {
  const parts = text.split(/(\s{2,})/);
  if (parts.length === 1) {
    return text.trim() ? [{ text: text.trim(), x0: x, x1: x + width, y0: top, y1: bottom }] : [];
  }
  const perChar = text.length > 0 ? width / text.length : 0;
  const words: PositionedWord[] = [];
  let offset = 0;
  for (const part of parts) {
    if (part.trim() && !/^\s+$/.test(part)) {
      words.push({
        text: part.trim(),
        x0: x + offset * perChar,
        x1: x + (offset + part.length) * perChar,
        y0: top,
        y1: bottom,
      });
    }
    offset += part.length;
  }
  return words;
}

export async function readPdfWords(
  data: ArrayBuffer,
  password: string | undefined,
  progress: Progress,
): Promise<PdfWords> {
  progress('Opening the PDF…');
  const pdfjs = await loadPdfJs();

  // The loading task owns the worker; destroying it is what frees the document afterwards.
  const task = pdfjs.getDocument({ data: new Uint8Array(data), password });
  let doc: PdfDocument;
  try {
    doc = await task.promise;
  } catch (error) {
    await task.destroy();
    if (error instanceof pdfjs.PasswordException) {
      throw new PdfPasswordError(error.code === pdfjs.PasswordResponses.INCORRECT_PASSWORD);
    }
    throw new Error('That PDF could not be opened. It may be damaged.', { cause: error });
  }

  try {
    if (doc.numPages > MAX_PAGES) {
      throw new Error(
        `That PDF has ${doc.numPages} pages — more than a bank statement should. Upload one month or quarter at a time.`,
      );
    }

    const pages: PositionedWord[][] = [];
    let thin = 0;
    for (let number = 1; number <= doc.numPages; number += 1) {
      progress(`Reading page ${number} of ${doc.numPages}…`);
      const page = await doc.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const words: PositionedWord[] = [];
      let characters = 0;
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        characters += item.str.trim().length;
        const [, , , d, e, f] = item.transform as number[];
        const height = item.height || Math.abs(d) || 10;
        // PDF measures up from the bottom; everything here measures down from the top.
        const bottom = viewport.height - f;
        words.push(...splitItem(item.str, e, item.width, bottom - height, bottom));
      }
      if (characters < MIN_TEXT_PER_PAGE) thin += 1;
      pages.push(words);
      page.cleanup();
    }

    // Most pages have no text: it is a scan, so read the pictures instead.
    if (thin > doc.numPages / 2) {
      return { pages: await ocrPages(doc, progress), ocr: true };
    }
    return { pages, ocr: false };
  } finally {
    await task.destroy();
  }
}

async function ocrPages(doc: PdfDocument, progress: Progress): Promise<PositionedWord[][]> {
  progress('This PDF is a scan. Loading the text reader (OCR)…');
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: (message: { status: string; progress: number }) => {
      if (
        message.status === 'loading language traineddata' ||
        message.status === 'loading tesseract core'
      ) {
        progress(`Loading the text reader… ${Math.round(message.progress * 100)}%`);
      }
    },
  });

  try {
    const pages: PositionedWord[][] = [];
    for (let number = 1; number <= doc.numPages; number += 1) {
      progress(
        `Reading page ${number} of ${doc.numPages} by OCR — this takes a few seconds a page…`,
      );
      const page = await doc.getPage(number);
      const viewport = page.getViewport({ scale: OCR_SCALE });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;

      const result = await worker.recognize(canvas, {}, { blocks: true });
      const words: PositionedWord[] = [];
      for (const block of result.data.blocks ?? []) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            for (const word of line.words) {
              if (!word.text.trim()) continue;
              words.push({
                text: word.text.trim(),
                x0: word.bbox.x0 / OCR_SCALE,
                x1: word.bbox.x1 / OCR_SCALE,
                y0: word.bbox.y0 / OCR_SCALE,
                y1: word.bbox.y1 / OCR_SCALE,
              });
            }
          }
        }
      }
      pages.push(words);
      page.cleanup();
      canvas.width = 0;
      canvas.height = 0;
    }
    return pages;
  } finally {
    await worker.terminate();
  }
}
