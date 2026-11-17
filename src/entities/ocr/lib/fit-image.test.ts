// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';

import { fitImageForOcr } from './fit-image';

const MB = 1024 * 1024;

function file(name: string, type: string, size: number): File {
  const created = new File(['x'], name, { type });
  Object.defineProperty(created, 'size', { value: size });
  return created;
}

/** A canvas whose JPEG output shrinks with the pixel count and the quality, like a real one. */
function stubCanvas(bytesPerPixelAtFullQuality: number) {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 4032, height: 3024, close: () => {} })),
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: () => {},
    drawImage: () => {},
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    _type?: string,
    quality = 1,
  ) {
    const size = Math.round(this.width * this.height * bytesPerPixelAtFullQuality * quality);
    callback(new Blob([new Uint8Array(size)], { type: 'image/jpeg' }));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('fitImageForOcr', () => {
  it('leaves a PDF alone', async () => {
    const pdf = file('statement.pdf', 'application/pdf', 3 * MB);
    expect(await fitImageForOcr(pdf, 1 * MB)).toBe(pdf);
  });

  it('leaves a JPG or PNG that already fits alone', async () => {
    const photo = file('statement.jpg', 'image/jpeg', 600 * 1024);
    expect(await fitImageForOcr(photo, 1 * MB)).toBe(photo);
  });

  it('redraws a phone photo as a JPEG under the limit', async () => {
    stubCanvas(0.3);

    const fitted = await fitImageForOcr(file('IMG_2041.jpg', 'image/jpeg', 4 * MB), 1 * MB);

    expect(fitted.type).toBe('image/jpeg');
    expect(fitted.name).toBe('IMG_2041.jpg');
    expect(fitted.size).toBeLessThanOrEqual(1 * MB);
  });

  it('turns an iPhone HEIC photo into a JPEG even when it is small', async () => {
    stubCanvas(0.05);

    const fitted = await fitImageForOcr(file('IMG_2042.HEIC', 'image/heic', 300 * 1024), 1 * MB);

    expect(fitted.type).toBe('image/jpeg');
    expect(fitted.name).toBe('IMG_2042.jpg');
  });

  it('gives up with a reason rather than sending an unreadable thumbnail', async () => {
    stubCanvas(50);

    await expect(fitImageForOcr(file('huge.png', 'image/png', 9 * MB), 1 * MB)).rejects.toThrow(
      /could not be made smaller than 1 MB/,
    );
  });
});
