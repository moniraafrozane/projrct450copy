const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const auditLogController = require('../controllers/auditLogController');

// Admin-only routes
router.get('/', protect, auditLogController.getAuditLogs);
router.get('/:resourceType/:resourceId', protect, auditLogController.getResourceAuditTrail);

module.exports = router;
