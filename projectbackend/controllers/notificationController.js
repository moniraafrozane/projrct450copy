const prisma = require('../config/prisma');

const formatNotification = (notification) => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  isRead: notification.isRead,
  readAt: notification.readAt,
  createdAt: notification.createdAt,
  eventId: notification.eventId,
  eventTitle: notification.metadata?.eventTitle || notification.event?.title || null,
  actorName: notification.actor?.name || null,
  actorSocietyName: notification.actor?.societyName || null,
});

exports.getMyNotifications = async (req, res) => {
  try {
    const unreadOnly = String(req.query.unreadOnly || '').toLowerCase() === 'true';
    const requestedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 30;

    const notifications = await prisma.notification.findMany({
      where: {
        recipientId: req.user.id,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      include: {
        actor: {
          select: {
            name: true,
            societyName: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return res.json({
      success: true,
      notifications: notifications.map(formatNotification),
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
      error: error.message,
    });
  }
};

exports.getMyUnreadNotificationCount = async (req, res) => {
  try {
    const unreadCount = await prisma.notification.count({
      where: {
        recipientId: req.user.id,
        isRead: false,
      },
    });

    return res.json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error('Get unread notification count error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching unread notification count',
      error: error.message,
    });
  }
};

exports.markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.notification.findFirst({
      where: {
        id,
        recipientId: req.user.id,
      },
      include: {
        actor: {
          select: {
            name: true,
            societyName: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    if (existing.isRead) {
      return res.json({
        success: true,
        notification: formatNotification(existing),
      });
    }

    const notification = await prisma.notification.update({
      where: { id: existing.id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
      include: {
        actor: {
          select: {
            name: true,
            societyName: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      notification: formatNotification(notification),
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error marking notification as read',
      error: error.message,
    });
  }
};

exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        recipientId: req.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return res.json({
      success: true,
      message: 'All notifications marked as read',
      updatedCount: result.count,
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error marking all notifications as read',
      error: error.message,
    });
  }
};
