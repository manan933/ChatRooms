import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { optionalProtect } from '../middleware/auth.js';
import Media from '../models/Media.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists on disk for caching / fallbacks
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

// Memory storage to process binary directly into MongoDB Atlas and disk cache
const storage = multer.memoryStorage();

// File upload limits (up to 25MB)
const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB
  },
});

const router = express.Router();

const handleUpload = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded or file buffer empty',
      });
    }

    const mime = req.file.mimetype || 'application/octet-stream';
    const isImage =
      mime.startsWith('image/') ||
      /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|avif)$/i.test(req.file.originalname);
    const type = isImage ? 'image' : 'file';

    const ext = path.extname(req.file.originalname) || (isImage ? '.jpg' : '');
    const baseName = path.basename(req.file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const diskFilename = `${baseName}-${uniqueSuffix}${ext}`;

    // 1. Write to local disk cache (fallback & legacy URLs)
    try {
      const diskPath = path.resolve(uploadsDir, diskFilename);
      fs.writeFileSync(diskPath, req.file.buffer);
    } catch (diskErr) {
      console.warn('[Upload] Disk cache write skipped:', diskErr.message);
    }

    // 2. Permanently store in MongoDB Atlas Database Media collection
    let mediaDoc = null;
    try {
      mediaDoc = await Media.create({
        filename: req.file.originalname,
        contentType: mime,
        data: req.file.buffer,
        size: req.file.size,
        uploadedBy: req.user?._id?.toString() || req.user?.id || null,
      });
    } catch (dbErr) {
      console.error('[Upload] MongoDB Media save error:', dbErr.message);
    }

    // Generate base64 Data URL for instant rendering & resilience
    const base64Str = req.file.buffer.toString('base64');
    const dataUrl = `data:${mime};base64,${base64Str}`;

    // URL preferentially points to the permanent MongoDB Media endpoint
    const mediaUrl = mediaDoc?._id
      ? `/api/upload/media/${mediaDoc._id}`
      : `/uploads/${diskFilename}`;

    res.status(200).json({
      success: true,
      data: {
        url: mediaUrl,
        dataUrl,
        name: req.file.originalname,
        size: formatBytes(req.file.size),
        type,
        mimeType: mime,
        uploadedBy: req.user?._id?.toString() || null,
        mediaId: mediaDoc?._id?.toString() || null,
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

// @route   GET /api/upload/media/:id
// @desc    Retrieve file/image directly from MongoDB Atlas Cloud Database
// @access  Public
router.get('/media/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Check MongoDB Atlas Media collection if valid ObjectId
    if (mongoose.Types.ObjectId.isValid(id)) {
      const media = await Media.findById(id).lean();
      if (media && media.data) {
        res.setHeader('Content-Type', media.contentType || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(media.filename)}"`);
        return res.send(media.data);
      }
    }

    // 2. Fallback: Check local disk uploads directory
    const diskPath = path.resolve(uploadsDir, id);
    if (fs.existsSync(diskPath)) {
      return res.sendFile(diskPath);
    }

    return res.status(404).json({ success: false, message: 'Media not found' });
  } catch (error) {
    console.error('[Media Retrieval Error]', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve media file' });
  }
});

// @route   POST /api/upload & POST /api/upload/file
// @desc    Upload single image or file attachment
// @access  Protected / Optional token
router.post('/', optionalProtect, upload.single('file'), handleUpload);
router.post('/file', optionalProtect, upload.single('file'), handleUpload);

export default router;
