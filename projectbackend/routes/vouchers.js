const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const voucherController = require('../controllers/voucherController');

// All voucher routes require authentication
router.post('/', protect, voucherController.createVoucher);
router.get('/', protect, voucherController.getVouchers);
router.get('/summary', protect, voucherController.getVoucherSummary);
router.get('/:id', protect, voucherController.getVoucherById);
router.put('/:id', protect, voucherController.updateVoucher);
router.delete('/:id', protect, voucherController.deleteVoucher);
router.put('/:id/submit', protect, voucherController.submitVoucher);
router.put('/:id/forward', protect, voucherController.forwardVoucher);
router.put('/:id/approve', protect, voucherController.approveVoucher);
router.put('/:id/reject', protect, voucherController.rejectVoucher);

module.exports = router;
