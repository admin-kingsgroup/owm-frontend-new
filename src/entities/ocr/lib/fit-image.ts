import { formatFileSize, ocrFileType } from './check-file';

/**
 * A photo, made small enough for the OCR provider.
 *
 * A phone camera writes 2–5 MB per photo and OCR.space's free tier takes 1 MB, so a statement
 * photographed on a phone would be refused every time. The image is redrawn here, in the browser,
 * at a size that still keeps small print legible — a long edge of at most 2,400 px is about 300 DPI
 * for an A4 page — and re-encoded as JPEG, stepping quality and then size down until it fits.
 *
 * Also how an iPhone's HEIC photo becomes something the server reads: the browser decodes it, the
 * canvas re-encodes it as JPEG. A PDF is returned as it is; it cannot be shrunk here.
 */

const MAX_EDGE = 2400;
const QUALITIES = [0.85, 0.72, 0.6];
const SHRINK_STEP = 0.8;
const MAX_ATTEMPTS = 5;

type Drawable = ImageBitmap | HTMLImageElement;

function sizeOf(image: Drawable): { width: number; height: number } {
  return 'naturalWidth' in image
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : { width: image.width, height: image.height };
}

/** Decoded the browser's own way, upright according to the photo's EXIF orientation. */
async function decode(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Older Safari rejects the options object; fall through to an <img>.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

function asJpegName(name: string): string {
  return `${name.replace(/\.[^.]+$/, '') || 'statement'}.jpg`;
}

/** Whether the file is an image the browser may be able to redraw, whatever its format. */
function isImage(file: File): boolean {
  return file.type.startsWith('image/') || /\.(jpe?g|png|heic|heif)$/i.test(file.name);
}

/**
 * The file to upload: the original when it is already a JPG or PNG within `maxBytes`, otherwise a
 * redrawn JPEG within it. Throws with a message for the person when it cannot be made to fit.
 */
export async function fitImageForOcr(file: File, maxBytes: number): Promise<File> {
  if (!isImage(file)) return file;
  if (ocrFileType(file) !== null && file.size <= maxBytes) return file;

  let image: Drawable;
  try {
    image = await decode(file);
  } catch {
    throw new Error(
      `“${file.name}” could not be opened as an image in this browser. Save it as JPG or PNG and try again.`,
    );
  }

  const { width, height } = sizeOf(image);
  let scale = Math.min(1, MAX_EDGE / Math.max(width, height));

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const context = canvas.getContext('2d');
    if (!context) break;

    // White under the image: a transparent PNG would otherwise turn black as a JPEG.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of QUALITIES) {
      const blob = await encode(canvas, quality);
      if (blob && blob.size <= maxBytes) {
        return new File([blob], asJpegName(file.name), { type: 'image/jpeg' });
      }
    }

    scale *= SHRINK_STEP;
  }

  throw new Error(
    `This photo could not be made smaller than ${formatFileSize(maxBytes)} while keeping the text readable. Photograph a smaller part of the page, or upload the bank's PDF.`,
  );
}
