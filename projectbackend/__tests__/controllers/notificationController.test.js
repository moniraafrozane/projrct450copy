jest.mock('../../config/prisma', () => ({
  notification: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
}));

const prisma = require('../../config/prisma');
const {
  getMyNotifications,
  getMyUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require('../../controllers/notificationController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('controllers/notificationController', () => {
  describe('getMyNotifications', () => {
    it('fetches notifications for the current user with default limit 30', async () => {
      const req = { user: { id: 'u1' }, query: {} };
      const res = mockRes();

      prisma.notification.findMany.mockResolvedValue([
        {
          id: 'n1',
          type: 'info',
          title: 'Title',
          message: 'Msg',
          isRead: false,
          readAt: null,
          createdAt: new Date(),
          eventId: 'e1',
          metadata: null,
          event: { id: 'e1', title: 'Event 1' },
          actor: { name: 'Actor', societyName: 'Society' },
        },
      ]);

      await getMyNotifications(req, res);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recipientId: 'u1' },
          take: 30,
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        notifications: [
          expect.objectContaining({
            id: 'n1',
            eventTitle: 'Event 1',
            actorName: 'Actor',
            actorSocietyName: 'Society',
          }),
        ],
      });
    });

    it('filters to unread only when unreadOnly=true', async () => {
      const req = { user: { id: 'u1' }, query: { unreadOnly: 'true' } };
      const res = mockRes();

      prisma.notification.findMany.mockResolvedValue([]);

      await getMyNotifications(req, res);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recipientId: 'u1', isRead: false },
        })
      );
    });

    it('clamps an out-of-range limit to the 1-100 bounds', async () => {
      const req = { user: { id: 'u1' }, query: { limit: '500' } };
      const res = mockRes();

      prisma.notification.findMany.mockResolvedValue([]);

      await getMyNotifications(req, res);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });

    it('falls back to the default limit when limit is not a valid integer', async () => {
      const req = { user: { id: 'u1' }, query: { limit: 'abc' } };
      const res = mockRes();

      prisma.notification.findMany.mockResolvedValue([]);

      await getMyNotifications(req, res);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 30 })
      );
    });

    it('returns 500 on a database error', async () => {
      const req = { user: { id: 'u1' }, query: {} };
      const res = mockRes();

      prisma.notification.findMany.mockRejectedValue(new Error('db down'));

      await getMyNotifications(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getMyUnreadNotificationCount', () => {
    it('returns the unread count for the current user', async () => {
      const req = { user: { id: 'u1' } };
      const res = mockRes();

      prisma.notification.count.mockResolvedValue(4);

      await getMyUnreadNotificationCount(req, res);

      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { recipientId: 'u1', isRead: false },
      });
      expect(res.json).toHaveBeenCalledWith({ success: true, unreadCount: 4 });
    });
  });

  describe('markNotificationAsRead', () => {
    it('returns 404 when the notification does not belong to the user', async () => {
      const req = { params: { id: 'n1' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.notification.findFirst.mockResolvedValue(null);

      await markNotificationAsRead(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('returns the notification unchanged if already read', async () => {
      const req = { params: { id: 'n1' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.notification.findFirst.mockResolvedValue({
        id: 'n1',
        isRead: true,
        metadata: null,
      });

      await markNotificationAsRead(req, res);

      expect(prisma.notification.update).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('marks an unread notification as read', async () => {
      const req = { params: { id: 'n1' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.notification.findFirst.mockResolvedValue({ id: 'n1', isRead: false, metadata: null });
      prisma.notification.update.mockResolvedValue({
        id: 'n1',
        isRead: true,
        readAt: new Date(),
        metadata: null,
      });

      await markNotificationAsRead(req, res);

      expect(prisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'n1' },
          data: expect.objectContaining({ isRead: true, readAt: expect.any(Date) }),
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  describe('markAllNotificationsAsRead', () => {
    it('marks all unread notifications as read and returns the updated count', async () => {
      const req = { user: { id: 'u1' } };
      const res = mockRes();

      prisma.notification.updateMany.mockResolvedValue({ count: 3 });

      await markAllNotificationsAsRead(req, res);

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { recipientId: 'u1', isRead: false },
        data: expect.objectContaining({ isRead: true }),
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, updatedCount: 3 })
      );
    });
  });
});
