const express = require('express');
const positionController = require('../controllers/positionController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Initialize positions (admin only)
router.post('/init', protect, positionController.initializePositions);

// Get all positions
router.get('/', protect, positionController.getPositions);

// Get available positions
router.get('/available', protect, positionController.getAvailablePositions);

// Get user's positions
router.get('/user/:userId', protect, positionController.getUserPositions);

// Get position by ID
router.get('/:id', protect, positionController.getPositionById);

// Assign position to user (by position ID)
router.post('/assign', protect, positionController.assignPosition);

// Assign position to user (by position title)
router.post('/assign-by-title', protect, positionController.assignPositionByTitle);

// Unassign position
router.put('/:id/unassign', protect, positionController.unassignPosition);

module.exports = router;
