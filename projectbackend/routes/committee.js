const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createCommittee,
  getCommittees,
  getActiveCommittee,
  getCommitteeById,
  updateCommittee,
  addMember,
  removeMember,
  updateMemberRole,
  deactivateCommittee,
} = require('../controllers/committeeController');

// Public-ish reads (any authenticated user)
router.get('/', protect, getCommittees);
router.get('/active', protect, getActiveCommittee);
router.get('/:id', protect, getCommitteeById);

// Admin-only mutations
router.post('/', protect, authorize('admin'), createCommittee);
router.put('/:id', protect, authorize('admin'), updateCommittee);
router.put('/:id/deactivate', protect, authorize('admin'), deactivateCommittee);

// Member management (admin-only)
router.post('/:id/members', protect, authorize('admin'), addMember);
router.put('/:id/members/:memberId', protect, authorize('admin'), updateMemberRole);
router.delete('/:id/members/:memberId', protect, authorize('admin'), removeMember);

module.exports = router;
