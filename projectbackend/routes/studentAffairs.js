const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const studentAffairsController = require('../controllers/studentAffairsController');

router.post('/receipts', protect, studentAffairsController.createReceipt);
router.get('/receipts', protect, studentAffairsController.getReceipts);
router.get('/receipts/my', protect, studentAffairsController.getMyReceipts);
router.get('/receipts/report', protect, studentAffairsController.getReceiptsReport);
router.get('/fee-status-summary', protect, studentAffairsController.getFeeStatusSummary);
router.get('/receipts/:id', protect, studentAffairsController.getReceiptById);
router.post('/fee-payments/mark-paid', protect, studentAffairsController.markFeePaymentPaid);
router.put('/receipts/:id/forward', protect, studentAffairsController.forwardReceiptToAdmin);
router.put('/receipts/:id/decision', protect, studentAffairsController.reviewReceipt);

module.exports = router;
