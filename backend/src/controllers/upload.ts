import { Request, Response } from 'express';
import fs from 'fs/promises';
import { uploadDir } from '../middleware/upload';
import { ImageUploadError, optimizeUploadedImage, removeOptimizedImages } from '../lib/image-processing';

/**
 * Controller to handle centralized file uploads.
 * Every image is converted to an optimized `<uuid>.webp`; the response shape is unchanged.
 * A batch is all-or-nothing: if one image is rejected, images already converted in this request are removed.
 */
export const uploadFiles = async (req: Request, res: Response) => {
  const files: Express.Multer.File[] = Array.isArray(req.files) ? req.files : req.file ? [req.file] : [];
  if (files.length === 0) {
    return res.status(400).json({ error: 'No files were provided in the request payload' });
  }

  const saved: string[] = [];
  try {
    for (const [index, file] of files.entries()) {
      try {
        saved.push(await optimizeUploadedImage(file.path, uploadDir));
      } catch (error) {
        if (error instanceof ImageUploadError && files.length > 1) {
          error.message = `Image ${index + 1}: ${error.message}`;
        }
        throw error;
      }
    }

    const urls = saved.map((name) => `/uploads/${name}`);
    // Single file was uploaded using upload.single('image')
    if (req.file) return res.json({ url: urls[0], urls });
    return res.json({ urls });
  } catch (error) {
    await removeOptimizedImages(uploadDir, saved);
    // Temp files of images not reached yet in the loop.
    await Promise.all(files.map((file) => fs.rm(file.path, { force: true }).catch(() => undefined)));
    if (error instanceof ImageUploadError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Master Upload Error:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Image processing failed' });
  }
};
