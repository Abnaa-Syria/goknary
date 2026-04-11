import { Request, Response } from 'express';
import path from 'path';

/**
 * Controller to handle centralized file uploads.
 * Supports both single and multiple uploads.
 */
export const uploadFiles = async (req: Request, res: Response) => {
  try {
    // If multiple files were uploaded using upload.array('images')
    if (req.files && Array.isArray(req.files)) {
      const files = req.files as Express.Multer.File[];
      const urls = files.map(file => `/uploads/${file.filename}`);
      return res.json({ urls });
    }

    // If a single file was uploaded using upload.single('image')
    if (req.file) {
      const url = `/uploads/${req.file.filename}`;
      return res.json({ url, urls: [url] });
    }

    return res.status(400).json({ error: 'No files were provided in the request payload' });
  } catch (error) {
    console.error('Master Upload Error:', error);
    res.status(500).json({ error: 'Internal system failure during file persistence phase' });
  }
};
