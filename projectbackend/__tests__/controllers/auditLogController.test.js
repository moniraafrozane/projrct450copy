jest.mock('../../config/prisma', () => ({
  adminAuditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
}));

const prisma = require('../../config/prisma');
const { createAuditLog, getAuditLogs, getResourceAuditTrail } = require('../../controllers/auditLogController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('controllers/auditLogController', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('createAuditLog', () => {
    it('writes an audit log entry with the given fields', async () => {
      prisma.adminAuditLog.create.mockResolvedValue({ id: 'log-1' });

      const result = await createAuditLog({
        action: 'user_role_assigned',
        module: 'user_management',
        description: 'desc',
        actorId: 'admin-1',
      });

      expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'user_role_assigned',
          module: 'user_management',
          description: 'desc',
          actorId: 'admin-1',
        }),
      });
      expect(result).toEqual({ id: 'log-1' });
    });

    it('swallows errors so a failed audit write never throws', async () => {
      prisma.adminAuditLog.create.mockRejectedValue(new Error('db down'));

      await expect(createAuditLog({ action: 'x', module: 'y' })).resolves.toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('getAuditLogs', () => {
    it('rejects non-admin users', async () => {
      const req = { query: {}, user: { roles: ['student'] } };
      const res = mockRes();

      await getAuditLogs(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.adminAuditLog.findMany).not.toHaveBeenCalled();
    });

    it('returns paginated logs for admins with default pagination', async () => {
      const req = { query: {}, user: { roles: ['admin'] } };
      const res = mockRes();

      prisma.adminAuditLog.findMany.mockResolvedValue([{ id: 'log-1' }]);
      prisma.adminAuditLog.count.mockResolvedValue(1);

      await getAuditLogs(req, res);

      expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 50,
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        logs: [{ id: 'log-1' }],
        pagination: { total: 1, page: 1, limit: 50, pages: 1 },
      });
    });

    it('applies filters and pagination from the query string', async () => {
      const req = {
        query: { module: 'user_management', action: 'user_role_assigned', page: '2', limit: '10' },
        user: { roles: ['admin'] },
      };
      const res = mockRes();

      prisma.adminAuditLog.findMany.mockResolvedValue([]);
      prisma.adminAuditLog.count.mockResolvedValue(0);

      await getAuditLogs(req, res);

      expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith({
        where: { module: 'user_management', action: 'user_role_assigned' },
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      });
    });
  });

  describe('getResourceAuditTrail', () => {
    it('rejects non-admin users', async () => {
      const req = { params: { resourceType: 'User', resourceId: 'u1' }, user: { roles: [] } };
      const res = mockRes();

      await getResourceAuditTrail(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns the audit trail for a resource', async () => {
      const req = { params: { resourceType: 'User', resourceId: 'u1' }, user: { roles: ['admin'] } };
      const res = mockRes();

      prisma.adminAuditLog.findMany.mockResolvedValue([{ id: 'log-1', resourceId: 'u1' }]);

      await getResourceAuditTrail(req, res);

      expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith({
        where: { resourceType: 'User', resourceId: 'u1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(res.json).toHaveBeenCalledWith({ success: true, logs: [{ id: 'log-1', resourceId: 'u1' }] });
    });
  });
});
