const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const eventController = require('../controllers/eventController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure certificate uploads directory exists
const certificatesDir = path.join(__dirname, '../uploads/certificates');
if (!fs.existsSync(certificatesDir)) {
	fs.mkdirSync(certificatesDir, { recursive: true });
}

// Configure multer for certificate upload
const certificateStorage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, certificatesDir);
	},
	filename: function (req, file, cb) {
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
		const ext = path.extname(file.originalname);
		const nameWithoutExt = path.basename(file.originalname, ext);
		cb(null, nameWithoutExt + '-' + uniqueSuffix + ext);
	}
});

const certificateFileFilter = (req, file, cb) => {
	const allowedExtensions = /pdf/;
	const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
	const mime = String(file.mimetype || '').toLowerCase();

	if (extname && mime === 'application/pdf') {
		return cb(null, true);
	}

	return cb(new Error('Only PDF files are allowed for certificates'));
};

const certificateUpload = multer({
	storage: certificateStorage,
	limits: {
		fileSize: 10 * 1024 * 1024 // 10MB limit
	},
	fileFilter: certificateFileFilter
});

// Protected routes - must come before parameterized routes
router.get('/my/registrations', protect, eventController.getMyRegistrations);
router.get('/my/events', protect, eventController.getMyEvents);
router.get('/manage/all', protect, eventController.getManageableEvents);
router.get('/society/all', protect, eventController.getSocietyEvents);

// Public routes
router.get('/', eventController.getAllEvents);
router.get('/:id', eventController.getEventById);

// Protected routes (require authentication)
router.post('/', protect, eventController.createEvent);
router.put('/:id', protect, eventController.updateEvent);
router.delete('/:id', protect, eventController.deleteEvent);

// Event registration routes
router.post('/:eventId/register', protect, eventController.registerForEvent);
router.delete('/:eventId/register', protect, eventController.cancelRegistration);
router.get('/:eventId/registrations/:registrationId/log', protect, eventController.getMyRegistrationLog);
router.put('/:eventId/registrations/:registrationId/attendance', protect, eventController.updateRegistrationAttendance);
router.post('/:eventId/registrations/:registrationId/certificate-request', protect, eventController.applyForCertificate);
router.put('/:eventId/registrations/:registrationId/status', protect, eventController.updateRegistrationStatus);
router.post('/:eventId/registrations/:registrationId/comment', protect, eventController.addRegistrationComment);
router.post('/:eventId/registrations/:registrationId/system-event', protect, eventController.addRegistrationSystemEvent);

// Event statistics (organizer/admin only)
router.get('/:id/stats', protect, eventController.getEventStats);

// Certificate management routes
router.get('/:eventId/pending-certificates', protect, eventController.getPendingCertificates);
router.post('/:eventId/registrations/:registrationId/certificate/upload', protect, certificateUpload.single('certificate'), eventController.uploadCertificate);
router.post('/:eventId/registrations/:registrationId/certificate/approve', protect, eventController.approveCertificate);

module.exports = router;
