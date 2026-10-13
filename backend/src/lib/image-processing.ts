import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

// Keeps Windows/dev from holding file handles on temp inputs that are deleted right after processing.
sharp.cache(false);

/** Longest edge kept for uploads; images are fitted inside, never cropped or enlarged. */
export const MAX_IMAGE_DIMENSION = 1600;
export const WEBP_QUALITY = 80;
/** Decoded-pixel ceiling (≈ 60 MP covers phone cameras) so a small file cannot expand into a huge bitmap. */
export const MAX_INPUT_PIXELS = 60_000_000;
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);

export class ImageUploadError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
    this.name = 'ImageUploadError';
  }
}

export const IMAGE_ERRORS = {
  invalid: 'Invalid image file',
  unsupported: 'Unsupported image format. Only JPEG, PNG and WebP are allowed.',
  dimensions: 'Image dimensions are too large',
  failed: 'Image processing failed. Please try a different image.',
} as const;

const removeQuietly = (filePath: string) => fs.rm(filePath, { force: true }).catch(() => undefined);

/**
 * Validates the real file content (not the browser MIME), auto-orients from EXIF, fits it inside
 * MAX_IMAGE_DIMENSION, and writes `<uuid>.webp` into `outputDir`. EXIF/GPS and other metadata are not
 * copied (sharp's default). Alpha channels are kept. The temp input is never left behind.
 */
export const optimizeUploadedImage = async (inputPath: string, outputDir: string): Promise<string> => {
  const filename = `${randomUUID()}.webp`;
  const outputPath = path.join(outputDir, filename);
  const options = { failOn: 'error' as const, limitInputPixels: MAX_INPUT_PIXELS };

  try {
    let metadata: sharp.Metadata;
    try {
      // Header only (no pixel decode), so the pixel limit is checked explicitly below with a clear message.
      metadata = await sharp(inputPath, { limitInputPixels: false }).metadata();
    } catch {
      throw new ImageUploadError(IMAGE_ERRORS.invalid);
    }
    if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
      throw new ImageUploadError(IMAGE_ERRORS.unsupported);
    }
    if ((metadata.width ?? 0) * (metadata.height ?? 0) > MAX_INPUT_PIXELS) {
      throw new ImageUploadError(IMAGE_ERRORS.dimensions);
    }

    try {
      await sharp(inputPath, options)
        .rotate()
        .resize({
          width: MAX_IMAGE_DIMENSION,
          height: MAX_IMAGE_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY, alphaQuality: 90, effort: 4 })
        .toFile(outputPath);
    } catch (error) {
      await removeQuietly(outputPath);
      console.error('Image processing failed:', error instanceof Error ? error.message : 'unknown error');
      throw new ImageUploadError(IMAGE_ERRORS.failed, 422);
    }
    return filename;
  } finally {
    await removeQuietly(inputPath);
  }
};

/** Removes files written earlier in the same request (all-or-nothing batches). */
export const removeOptimizedImages = (outputDir: string, filenames: string[]) =>
  Promise.all(filenames.map((name) => removeQuietly(path.join(outputDir, path.basename(name)))));
