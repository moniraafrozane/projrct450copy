const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { protect, authorize } = require('../middleware/auth');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const PUBLIC_BACKEND_URL = (
  process.env.PUBLIC_BACKEND_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  process.env.BACKEND_URL ||
  ''
).replace(/\/$/, '');

function buildPublicFileUrl(req, filePath) {
  const baseUrl = PUBLIC_BACKEND_URL || `${req.protocol}://${req.get('host')}`;
  return `${baseUrl.replace(/\/$/, '')}${filePath}`;
}

const receiptUploadsDir = path.join(__dirname, '../uploads/receipts');
if (!fs.existsSync(receiptUploadsDir)) {
  fs.mkdirSync(receiptUploadsDir, { recursive: true });
}

// Event images are stored on Cloudinary (Render's local disk is ephemeral and
// wiped on every restart/redeploy, which was silently breaking image URLs)
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'cse-society/event-images',
    allowed_formats: ['jpeg', 'jpg', 'png', 'gif', 'webp'],
    resource_type: 'image'
  }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (JPEG, JPG, PNG, GIF, WebP)'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

const receiptStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, receiptUploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, nameWithoutExt + '-' + uniqueSuffix + ext);
  }
});

const receiptFileFilter = (req, file, cb) => {
  const allowedExtensions = /pdf|jpeg|jpg|png/;
  const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  const mime = String(file.mimetype || '').toLowerCase();
  const allowedMime = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

  if (extname && allowedMime.includes(mime)) {
    return cb(null, true);
  }

  return cb(new Error('Only PDF, JPG, and PNG files are allowed'));
};

const receiptUpload = multer({
  storage: receiptStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: receiptFileFilter
});

// Upload single image endpoint
router.post('/image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // req.file.path is the secure Cloudinary URL (set by CloudinaryStorage)
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: req.file.path,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message
    });
  }
});

router.post('/receipt', protect, authorize('student', 'society', 'admin'), receiptUpload.single('receipt'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No receipt file provided'
      });
    }

    const fileUrl = buildPublicFileUrl(req, `/uploads/receipts/${req.file.filename}`);

    return res.json({
      success: true,
      message: 'Receipt uploaded successfully',
      fileUrl,
      fileName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype
    });
  } catch (error) {
    console.error('Receipt upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload receipt',
      error: error.message
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message:
          req.path === '/receipt'
            ? 'File size too large. Maximum size is 10MB'
            : 'File size too large. Maximum size is 5MB'
      });
    }
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  res.status(500).json({
    success: false,
    message: error.message || 'An error occurred during upload'
  });
});

module.exports = router;
