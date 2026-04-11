import { Router, Request, Response } from 'express';
import { upload } from '../middleware/upload';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth';

const router = Router();

// Upload image
router.post('/image', authenticate, upload.single('image'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// Delete image
router.delete('/image/:filename', authenticate, (req: Request, res: Response) => {
  const { filename } = req.params;
  const filePath = path.join(process.cwd(), 'uploads', filename);

  // Check if file exists and delete
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.json({ message: 'File deleted successfully' });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

export default router;
