/**
 * Post-Event Reporting Routes
 * Mounted at /api/events/:eventId (merged with existing events router)
 * or standalone if needed.
 *
 * Routes:
 *   GET  /api/events/:eventId/post-event-template              → download Excel template
 *   GET  /api/events/:eventId/budget-comparison                → planned vs actual
 *   GET  /api/events/:eventId/post-event-reports               → list reports
 *   POST /api/events/:eventId/post-event-reports               → create report
 *   GET  /api/events/:eventId/post-event-reports/:reportId     → get single report
 *   PUT  /api/events/:eventId/post-event-reports/:reportId     → update sections
 *   POST /api/events/:eventId/post-event-reports/:reportId/submit → submit for review
 *   POST /api/events/:eventId/post-event-reports/:reportId/review → admin review
 *   POST /api/events/:eventId/post-event-reports/:reportId/media  → upload media file
 *   DELETE /api/events/:eventId/post-event-reports/:reportId/media/:mediaId → delete media
 */

const express = require('express');
const router  = express.Router({ mergeParams: true });
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/postEventController');

// ── Multer storage for report media ──────────────────────────────────────────

const mediaDir = path.join(__dirname, '../uploads/report-media');
if (!fs.existsSync(mediaDir)) {
  fs.mkdirSync(mediaDir, { recursive: true });
}

const mediaStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, mediaDir),
  filename:    (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `report-media-${uniqueSuffix}${ext}`);
  },
});

const mediaUpload = multer({
  storage: mediaStorage,
  limits:  { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpe?g|png|gif|webp|mp4|mov|avi|mkv|pdf|docx?|pptx?|xlsx?)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      return cb(null, true);
    }
    cb(new Error('File type not allowed for media archive'));
  },
});

// ── Routes ────────────────────────────────────────────────────────────────────

// Template download (any authenticated user)
router.get('/post-event-template', protect, ctrl.downloadTemplate);

// Budget comparison (any authenticated user)
router.get('/budget-comparison', protect, ctrl.getBudgetComparison);

// Report CRUD (society + admin can read; society+admin can create/edit; admin reviews)
router.get(   '/post-event-reports',                          protect, ctrl.getReports);
router.post(  '/post-event-reports',                          protect, ctrl.createReport);
router.get(   '/post-event-reports/:reportId',                protect, ctrl.getReport);
router.get(   '/post-event-reports/:reportId/pdf',            protect, ctrl.downloadReportPdf);
router.put(   '/post-event-reports/:reportId',                protect, ctrl.updateReport);
router.post(  '/post-event-reports/:reportId/submit',         protect, ctrl.submitReport);
router.post(  '/post-event-reports/:reportId/review',         protect, ctrl.reviewReport);

// Media (50MB, any allowed file type)
router.post(  '/post-event-reports/:reportId/media',          protect, mediaUpload.single('file'), ctrl.uploadMedia);
router.delete('/post-event-reports/:reportId/media/:mediaId', protect, ctrl.deleteMedia);

module.exports = router;

// ── Standalone routes (mounted separately at /api/post-event-reports) ─────────
const standaloneRouter = express.Router();
standaloneRouter.get('/template', protect, ctrl.downloadGenericTemplate);
standaloneRouter.get('/',         protect, ctrl.getAllReports);

module.exports.standaloneRouter = standaloneRouter;
