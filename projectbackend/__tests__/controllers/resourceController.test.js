jest.mock('../../config/prisma', () => ({
  resourceItem: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
}));
jest.mock('../../controllers/auditLogController', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

const prisma = require('../../config/prisma');
const { createAuditLog } = require('../../controllers/auditLogController');
const resourceController = require('../../controllers/resourceController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const societyUser = { id: 'soc-1', email: 'soc@b.com', name: 'Society User', roles: ['society'] };
const studentUser = { id: 'stu-1', email: 'stu@b.com', name: 'Student User', roles: ['student'] };

describe('controllers/resourceController', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createResource', () => {
    it('rejects non-society users', async () => {
      const req = { user: studentUser, body: { title: 'Doc' } };
      const res = mockRes();

      await resourceController.createResource(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Only society members can access resources' })
      );
      expect(prisma.resourceItem.create).not.toHaveBeenCalled();
    });

    it('rejects when title is missing', async () => {
      const req = { user: societyUser, body: { type: 'policy_link', linkUrl: 'https://example.com' } };
      const res = mockRes();

      await resourceController.createResource(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'title is required' })
      );
    });

    it('rejects an invalid visibility value', async () => {
      const req = {
        user: societyUser,
        body: { title: 'Doc', type: 'policy_link', linkUrl: 'https://example.com', visibility: 'public' },
      };
      const res = mockRes();

      await resourceController.createResource(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid visibility value' })
      );
    });

    it('rejects an invalid resource type', async () => {
      const req = { user: societyUser, body: { title: 'Doc', type: 'audio' } };
      const res = mockRes();

      await resourceController.createResource(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid resource type' })
      );
    });

    it('rejects a policy_link resource without a valid linkUrl', async () => {
      const req = { user: societyUser, body: { title: 'Doc', type: 'policy_link', linkUrl: 'not-a-url' } };
      const res = mockRes();

      await resourceController.createResource(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'policy_link resources require a valid linkUrl' })
      );
    });

    it('rejects a file resource missing fileUrl, fileName, or mimeType', async () => {
      const req = { user: societyUser, body: { title: 'Doc', type: 'document' } };
      const res = mockRes();

      await resourceController.createResource(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'document resources require fileUrl, fileName, and mimeType' })
      );
    });

    it('rejects a fileUrl that does not point to uploaded resource storage', async () => {
      const req = {
        user: societyUser,
        body: {
          title: 'Doc',
          type: 'document',
          fileUrl: 'https://evil.com/hack.pdf',
          fileName: 'hack.pdf',
          mimeType: 'application/pdf',
        },
      };
      const res = mockRes();

      await resourceController.createResource(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Resource fileUrl must point to uploaded resources storage' })
      );
    });

    it('creates a policy_link resource and writes an audit log', async () => {
      const req = {
        user: societyUser,
        ip: '127.0.0.1',
        body: { title: 'Policy Doc', type: 'policy_link', linkUrl: 'https://example.com/policy' },
      };
      const res = mockRes();

      prisma.resourceItem.create.mockResolvedValue({
        id: 'r1',
        title: 'Policy Doc',
        type: 'policy_link',
        visibility: 'society_only',
        linkUrl: 'https://example.com/policy',
        fileUrl: null,
      });

      await resourceController.createResource(req, res);

      expect(prisma.resourceItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Policy Doc',
            type: 'policy_link',
            visibility: 'society_only',
            linkUrl: 'https://example.com/policy',
            fileUrl: null,
            createdById: 'soc-1',
          }),
        })
      );
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'resource_created', actorId: 'soc-1' })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Resource created successfully' })
      );
    });

    it('creates a document resource with an uploaded fileUrl', async () => {
      const req = {
        user: societyUser,
        ip: '127.0.0.1',
        body: {
          title: 'Report',
          type: 'document',
          fileUrl: '/uploads/resources/report.pdf',
          fileName: 'report.pdf',
          mimeType: 'application/pdf',
        },
      };
      const res = mockRes();

      prisma.resourceItem.create.mockResolvedValue({
        id: 'r2',
        title: 'Report',
        type: 'document',
        visibility: 'society_only',
        linkUrl: null,
        fileUrl: '/uploads/resources/report.pdf',
      });

      await resourceController.createResource(req, res);

      expect(prisma.resourceItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'document',
            fileUrl: '/uploads/resources/report.pdf',
            fileName: 'report.pdf',
            mimeType: 'application/pdf',
            linkUrl: null,
          }),
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('getResources', () => {
    it('rejects non-society users', async () => {
      const req = { user: studentUser, query: {} };
      const res = mockRes();

      await resourceController.getResources(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.resourceItem.findMany).not.toHaveBeenCalled();
    });

    it('rejects an invalid type filter', async () => {
      const req = { user: societyUser, query: { type: 'audio' } };
      const res = mockRes();

      await resourceController.getResources(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid type filter' })
      );
    });

    it('returns paginated resources with default pagination', async () => {
      const req = { user: societyUser, query: {} };
      const res = mockRes();

      prisma.resourceItem.findMany.mockResolvedValue([{ id: 'r1' }]);
      prisma.resourceItem.count.mockResolvedValue(1);

      await resourceController.getResources(req, res);

      expect(prisma.resourceItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          skip: 0,
          take: 25,
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          resources: [{ id: 'r1' }],
          pagination: { total: 1, page: 1, limit: 25, pages: 1 },
        })
      );
    });

    it('applies search, sort, type filter, and pagination from the query string', async () => {
      const req = {
        user: societyUser,
        query: { type: 'document', search: 'budget', sort: 'title_asc', page: '2', limit: '10' },
      };
      const res = mockRes();

      prisma.resourceItem.findMany.mockResolvedValue([]);
      prisma.resourceItem.count.mockResolvedValue(0);

      await resourceController.getResources(req, res);

      expect(prisma.resourceItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            type: 'document',
            OR: expect.any(Array),
          }),
          orderBy: { title: 'asc' },
          skip: 10,
          take: 10,
        })
      );
    });
  });

  describe('getResourceById', () => {
    it('rejects non-society users', async () => {
      const req = { user: studentUser, params: { id: 'r1' } };
      const res = mockRes();

      await resourceController.getResourceById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 404 when the resource does not exist or is inactive', async () => {
      const req = { user: societyUser, params: { id: 'missing' } };
      const res = mockRes();

      prisma.resourceItem.findFirst.mockResolvedValue(null);

      await resourceController.getResourceById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Resource not found' })
      );
    });

    it('returns the resource when found', async () => {
      const req = { user: societyUser, params: { id: 'r1' } };
      const res = mockRes();

      prisma.resourceItem.findFirst.mockResolvedValue({ id: 'r1', title: 'Doc' });

      await resourceController.getResourceById(req, res);

      expect(prisma.resourceItem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'r1', isActive: true } })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, resource: { id: 'r1', title: 'Doc' } })
      );
    });
  });

  describe('updateResource', () => {
    const existing = {
      id: 'r1',
      title: 'Old Title',
      description: null,
      type: 'document',
      visibility: 'society_only',
      linkUrl: null,
      fileUrl: '/uploads/resources/old.pdf',
      fileName: 'old.pdf',
      mimeType: 'application/pdf',
      fileSize: 100,
      tags: [],
    };

    it('rejects non-society users', async () => {
      const req = { user: studentUser, params: { id: 'r1' }, body: {} };
      const res = mockRes();

      await resourceController.updateResource(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 404 when the resource does not exist or is inactive', async () => {
      const req = { user: societyUser, params: { id: 'missing' }, body: {} };
      const res = mockRes();

      prisma.resourceItem.findFirst.mockResolvedValue(null);

      await resourceController.updateResource(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prisma.resourceItem.update).not.toHaveBeenCalled();
    });

    it('rejects an invalid resource type', async () => {
      const req = { user: societyUser, params: { id: 'r1' }, body: { type: 'audio' } };
      const res = mockRes();

      prisma.resourceItem.findFirst.mockResolvedValue(existing);

      await resourceController.updateResource(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid resource type' })
      );
    });

    it('rejects an invalid visibility value', async () => {
      const req = { user: societyUser, params: { id: 'r1' }, body: { visibility: 'public' } };
      const res = mockRes();

      prisma.resourceItem.findFirst.mockResolvedValue(existing);

      await resourceController.updateResource(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid visibility value' })
      );
    });

    it('rejects clearing the title to empty', async () => {
      const req = { user: societyUser, params: { id: 'r1' }, body: { title: '   ' } };
      const res = mockRes();

      prisma.resourceItem.findFirst.mockResolvedValue(existing);

      await resourceController.updateResource(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'title is required' })
      );
    });

    it('rejects switching to policy_link without a valid linkUrl', async () => {
      const req = { user: societyUser, params: { id: 'r1' }, body: { type: 'policy_link' } };
      const res = mockRes();

      prisma.resourceItem.findFirst.mockResolvedValue(existing);

      await resourceController.updateResource(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'policy_link resources require a valid linkUrl' })
      );
    });

    it('updates the resource and writes an audit log on success', async () => {
      const req = {
        user: societyUser,
        ip: '127.0.0.1',
        params: { id: 'r1' },
        body: { title: 'New Title' },
      };
      const res = mockRes();

      prisma.resourceItem.findFirst.mockResolvedValue(existing);
      prisma.resourceItem.update.mockResolvedValue({
        ...existing,
        title: 'New Title',
      });

      await resourceController.updateResource(req, res);

      expect(prisma.resourceItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'r1' },
          data: expect.objectContaining({ title: 'New Title' }),
        })
      );
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'resource_updated', actorId: 'soc-1' })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Resource updated successfully' })
      );
    });
  });

  describe('deleteResource', () => {
    it('rejects non-society users', async () => {
      const req = { user: studentUser, params: { id: 'r1' } };
      const res = mockRes();

      await resourceController.deleteResource(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 404 when the resource does not exist or is inactive', async () => {
      const req = { user: societyUser, params: { id: 'missing' } };
      const res = mockRes();

      prisma.resourceItem.findFirst.mockResolvedValue(null);

      await resourceController.deleteResource(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prisma.resourceItem.update).not.toHaveBeenCalled();
    });

    it('soft-deletes the resource and writes an audit log', async () => {
      const req = { user: societyUser, ip: '127.0.0.1', params: { id: 'r1' } };
      const res = mockRes();

      prisma.resourceItem.findFirst.mockResolvedValue({ id: 'r1', title: 'Doc' });
      prisma.resourceItem.update.mockResolvedValue({ id: 'r1', title: 'Doc', isActive: false });

      await resourceController.deleteResource(req, res);

      expect(prisma.resourceItem.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { isActive: false },
      });
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'resource_deleted', actorId: 'soc-1' })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Resource deleted successfully' })
      );
    });
  });
});
