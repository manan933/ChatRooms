import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { optionalProtect } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Format bytes into readable string (e.g. 1.2 MB, 450 KB)
const formatBytes = (bytes, decimals = 1) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  },
});

// File upload limits (up to 25MB)
const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB
  },
});

const router = express.Router();

const handleUpload = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const mime = req.file.mimetype || '';
    const isImage = mime.startsWith('image/');
    const type = isImage ? 'image' : 'file';
    const relativeUrl = `/uploads/${req.file.filename}`;

    res.status(200).json({
      success: true,
      data: {
        url: relativeUrl,
        name: req.file.originalname,
        size: formatBytes(req.file.size),
        type,
        mimeType: mime,
        uploadedBy: req.user?._id?.toString() || null,
      },
    });
  } catch (error) {
    console.error('[Upload Error]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'File upload failed',
    });
  }
};

// @route   POST /api/upload & POST /api/upload/file
// @desc    Upload single image or file attachment
// @access  Protected / Optional token
router.post('/', optionalProtect, upload.single('file'), handleUpload);
router.post('/file', optionalProtect, upload.single('file'), handleUpload);

export default router;
