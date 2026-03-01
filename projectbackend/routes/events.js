const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const eventController = require('../controllers/eventController');

// Protected routes - must come before parameterized routes
router.get('/my/registrations', protect, eventController.getMyRegistrations);
router.get('/my/events', protect, eventController.getMyEvents);

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

// Event statistics (organizer/admin only)
router.get('/:id/stats', protect, eventController.getEventStats);

module.exports = router;
