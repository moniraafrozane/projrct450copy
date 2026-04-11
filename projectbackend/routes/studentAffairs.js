const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const studentAffairsController = require('../controllers/studentAffairsController');

router.post('/receipts', protect, studentAffairsController.createReceipt);
router.get('/receipts', protect, studentAffairsController.getReceipts);
router.get('/receipts/my', protect, studentAffairsController.getMyReceipts);
router.get('/receipts/:id', protect, studentAffairsController.getReceiptById);
router.put('/receipts/:id/decision', protect, studentAffairsController.reviewReceipt);

module.exports = router;
