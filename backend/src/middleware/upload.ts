import multer from 'multer';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import fs from 'fs';
import { NextFunction, Request, Response } from 'express';

// Ensure uploads directory exists. In production, set UPLOAD_DIR to a persistent volume.
export const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Raw uploads wait here (not publicly served) until they are converted into uploadDir.
const tempDir = path.join(os.tmpdir(), 'goknary-uploads');
fs.mkdirSync(tempDir, { recursive: true });

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB per file
export const MAX_UPLOAD_FILES = 10;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, tempDir);
  },
  // Never derived from the client filename.
  filename: (_req, _file, cb) => {
    cb(null, `${randomUUID()}.upload`);
  },
});

// First gate only; the real content is verified when the image is decoded.
const fileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported image format. Only JPEG, PNG and WebP are allowed.'), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: MAX_UPLOAD_FILES,
  },
});

const MULTER_MESSAGES: Record<string, { status: number; error: string }> = {
  LIMIT_FILE_SIZE: { status: 413, error: 'Image is too large. Maximum size is 10MB.' },
  LIMIT_FILE_COUNT: { status: 400, error: `Too many files. Maximum is ${MAX_UPLOAD_FILES} images.` },
  LIMIT_UNEXPECTED_FILE: { status: 400, error: `Too many files. Maximum is ${MAX_UPLOAD_FILES} images.` },
};

/** `upload.array` with clean JSON errors; multer already deletes partially received files on failure. */
export const uploadImagesMiddleware = (field: string) => {
  const handler = upload.array(field, MAX_UPLOAD_FILES);
  return (req: Request, res: Response, next: NextFunction) =>
    handler(req, res, (err?: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const mapped = MULTER_MESSAGES[err.code] ?? { status: 400, error: 'Invalid upload' };
        return res.status(mapped.status).json({ error: mapped.error });
      }
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid upload' });
    });
};
