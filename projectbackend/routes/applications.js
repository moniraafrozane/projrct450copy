const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const applicationController = require('../controllers/applicationController');

// All application routes require authentication
router.post('/budgets', protect, applicationController.createBudgetBreakdown);
router.get('/budgets', protect, applicationController.getBudgetBreakdowns);
router.post('/', protect, applicationController.createApplication);
router.get('/', protect, applicationController.getApplications);
router.get('/:id/pdf', protect, applicationController.exportApplicationPdf);
router.get('/:id/print', protect, applicationController.printApplicationPdf);
router.get('/:id', protect, applicationController.getApplicationById);
router.put('/:id', protect, applicationController.updateApplication);
router.put('/:id/submit', protect, applicationController.submitApplication);
router.put('/:id/forward', protect, applicationController.forwardToAdmin);
router.put('/:id/approve', protect, applicationController.approveApplication);
router.put('/:id/return', protect, applicationController.returnApplication);
router.post('/:id/notes', protect, applicationController.addNote);

module.exports = router;
