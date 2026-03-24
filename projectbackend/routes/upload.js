const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, authorize } = require('../middleware/auth');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads/images');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const receiptUploadsDir = path.join(__dirname, '../uploads/receipts');
if (!fs.existsSync(receiptUploadsDir)) {
  fs.mkdirSync(receiptUploadsDir, { recursive: true });
}

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-randomstring-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, nameWithoutExt + '-' + uniqueSuffix + ext);
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

    // Generate URL for the uploaded image
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/images/${req.file.filename}`;

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: imageUrl,
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

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/receipts/${req.file.filename}`;

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
