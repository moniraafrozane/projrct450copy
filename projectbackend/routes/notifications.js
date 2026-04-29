const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

router.get('/', protect, notificationController.getMyNotifications);
router.get('/unread-count', protect, notificationController.getMyUnreadNotificationCount);
router.patch('/read-all', protect, notificationController.markAllNotificationsAsRead);
router.patch('/:id/read', protect, notificationController.markNotificationAsRead);

module.exports = router;
