const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const analyticsReportController = require('../controllers/analyticsReportController');

router.get('/options', protect, analyticsReportController.getMetricOptions);
router.get('/monthly-budget', protect, analyticsReportController.getMonthlyBudgetEvents);
router.get('/', protect, analyticsReportController.listReports);
router.post('/', protect, analyticsReportController.createReport);
router.get('/:reportId', protect, analyticsReportController.getReport);
router.get('/:reportId/export', protect, analyticsReportController.exportReport);

module.exports = router;