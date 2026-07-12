jest.mock('../../config/prisma', () => ({
  position: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
}));

const prisma = require('../../config/prisma');
const positionController = require('../../controllers/positionController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  prisma.position.upsert.mockResolvedValue({});
});

describe('controllers/positionController', () => {
  describe('initializePositions', () => {
    it('reports already initialized when positions exist', async () => {
      const req = {};
      const res = mockRes();

      prisma.position.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);

      await positionController.initializePositions(req, res);

      expect(prisma.position.upsert).toHaveBeenCalledTimes(7);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Positions already initialized', count: 2 })
      );
      expect(prisma.position.create).not.toHaveBeenCalled();
    });

    it('creates all positions when none exist', async () => {
      const req = {};
      const res = mockRes();

      prisma.position.findMany.mockResolvedValue([]);
      prisma.position.create.mockResolvedValue({ id: 'p1' });

      await positionController.initializePositions(req, res);

      expect(prisma.position.create).toHaveBeenCalledTimes(7);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Positions initialized successfully', count: 7 })
      );
    });

    it('returns 500 on a database error', async () => {
      const req = {};
      const res = mockRes();

      prisma.position.upsert.mockRejectedValue(new Error('db down'));

      await positionController.initializePositions(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Error initializing positions' })
      );
    });
  });

  describe('getPositions', () => {
    it('returns all positions with included user info', async () => {
      const req = {};
      const res = mockRes();

      const positions = [{ id: 'p1', title: 'Vice President', user: null }];
      prisma.position.findMany.mockResolvedValue(positions);

      await positionController.getPositions(req, res);

      expect(prisma.position.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { title: 'asc' } })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, count: 1, positions })
      );
    });

    it('returns 500 on a database error', async () => {
      const req = {};
      const res = mockRes();

      prisma.position.findMany.mockRejectedValue(new Error('db down'));

      await positionController.getPositions(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getPositionById', () => {
    it('returns 404 when the position does not exist', async () => {
      const req = { params: { id: 'missing' } };
      const res = mockRes();

      prisma.position.findUnique.mockResolvedValue(null);

      await positionController.getPositionById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Position not found' })
      );
    });

    it('returns the position on success', async () => {
      const req = { params: { id: 'p1' } };
      const res = mockRes();

      const position = { id: 'p1', title: 'Vice President' };
      prisma.position.findUnique.mockResolvedValue(position);

      await positionController.getPositionById(req, res);

      expect(prisma.position.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'p1' } })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, position }));
    });
  });

  describe('assignPosition', () => {
    describe('role-based payload', () => {
      it('rejects an invalid role', async () => {
        const req = { body: { role: 'NOT_A_ROLE', email: 'a@b.com' } };
        const res = mockRes();

        await positionController.assignPosition(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Invalid role provided' })
        );
      });

      it('rejects when neither email nor studentId is provided', async () => {
        const req = { body: { role: 'VICE_PRESIDENT' } };
        const res = mockRes();

        await positionController.assignPosition(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Email or studentId is required for role-based assignment' })
        );
      });

      it('returns 404 when no matching user is found', async () => {
        const req = { body: { role: 'VICE_PRESIDENT', email: 'nobody@b.com' } };
        const res = mockRes();

        prisma.user.findFirst.mockResolvedValue(null);

        await positionController.assignPosition(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'User not found for provided email/studentId' })
        );
      });

      it('rejects when the provided name does not match the user record', async () => {
        const req = { body: { role: 'VICE_PRESIDENT', email: 'a@b.com', name: 'Wrong Name' } };
        const res = mockRes();

        prisma.user.findFirst.mockResolvedValue({ id: 'u1', name: 'Real Name' });

        await positionController.assignPosition(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Provided name does not match user record' })
        );
      });

      it('returns 404 when the mapped position does not exist', async () => {
        const req = { body: { role: 'VICE_PRESIDENT', email: 'a@b.com' } };
        const res = mockRes();

        prisma.user.findFirst.mockResolvedValue({ id: 'u1', name: 'Real Name' });
        prisma.position.findUnique.mockResolvedValue(null);

        await positionController.assignPosition(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Position not found' })
        );
      });

      it('rejects when a non-executive position is already assigned to someone else', async () => {
        const req = { body: { role: 'VICE_PRESIDENT', email: 'a@b.com' } };
        const res = mockRes();

        prisma.user.findFirst.mockResolvedValue({ id: 'u1', name: 'Real Name' });
        prisma.position.findUnique.mockResolvedValue({ id: 'pos1', userId: 'other-user' });

        await positionController.assignPosition(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'VICE_PRESIDENT already assigned' })
        );
        expect(prisma.position.update).not.toHaveBeenCalled();
      });

      it('assigns the mapped position to the user on success', async () => {
        const req = { body: { role: 'VICE_PRESIDENT', email: 'A@B.com' } };
        const res = mockRes();

        prisma.user.findFirst.mockResolvedValue({ id: 'u1', name: 'Real Name' });
        prisma.position.findUnique.mockResolvedValue({ id: 'pos1', userId: null });
        prisma.position.update.mockResolvedValue({
          id: 'pos1',
          title: 'Vice President',
          updatedAt: new Date('2026-01-01'),
          user: { id: 'u1', name: 'Real Name', studentId: 'S1', email: 'a@b.com' },
        });

        await positionController.assignPosition(req, res);

        expect(prisma.user.findFirst).toHaveBeenCalledWith({
          where: { OR: [{ email: 'a@b.com' }] },
        });
        expect(prisma.position.update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: 'pos1' }, data: { userId: 'u1' } })
        );
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: 'Position assigned successfully',
            data: expect.objectContaining({ name: 'Real Name', role: 'VICE_PRESIDENT' }),
          })
        );
      });

      it('allows re-assigning an already-assigned executive member position', async () => {
        const req = { body: { role: 'EXECUTIVE_MEMBER', email: 'a@b.com' } };
        const res = mockRes();

        prisma.user.findFirst.mockResolvedValue({ id: 'u1', name: 'Real Name' });
        prisma.position.findUnique.mockResolvedValue({ id: 'pos-exec', userId: 'someone-else' });
        prisma.position.update.mockResolvedValue({
          id: 'pos-exec',
          title: 'Executive Member',
          updatedAt: new Date('2026-01-01'),
          user: { id: 'u1', name: 'Real Name' },
        });

        await positionController.assignPosition(req, res);

        expect(prisma.position.update).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(201);
      });
    });

    describe('id-based payload', () => {
      it('rejects when positionId or userId is missing', async () => {
        const req = { body: { positionId: 'pos1' } };
        const res = mockRes();

        await positionController.assignPosition(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Position ID and User ID are required (or provide name, studentId/email, and role)',
          })
        );
      });

      it('returns 404 when the position does not exist', async () => {
        const req = { body: { positionId: 'pos1', userId: 'u1' } };
        const res = mockRes();

        prisma.position.findUnique.mockResolvedValue(null);

        await positionController.assignPosition(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Position not found' })
        );
      });

      it('returns 404 when the user does not exist', async () => {
        const req = { body: { positionId: 'pos1', userId: 'u1' } };
        const res = mockRes();

        prisma.position.findUnique.mockResolvedValue({ id: 'pos1' });
        prisma.user.findUnique.mockResolvedValue(null);

        await positionController.assignPosition(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'User not found' })
        );
      });

      it('rejects when the position is already assigned to a different user', async () => {
        const req = { body: { positionId: 'pos1', userId: 'u1' } };
        const res = mockRes();

        prisma.position.findUnique.mockResolvedValue({ id: 'pos1' });
        prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
        prisma.position.findFirst.mockResolvedValue({ id: 'pos1', userId: 'other-user' });

        await positionController.assignPosition(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Position already assigned to other-user. Please unassign first.',
          })
        );
        expect(prisma.position.update).not.toHaveBeenCalled();
      });

      it('assigns the position to the user on success', async () => {
        const req = { body: { positionId: 'pos1', userId: 'u1' } };
        const res = mockRes();

        prisma.position.findUnique.mockResolvedValue({ id: 'pos1' });
        prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
        prisma.position.findFirst.mockResolvedValue(null);
        prisma.position.update.mockResolvedValue({
          id: 'pos1',
          userId: 'u1',
          user: { id: 'u1', name: 'Real Name' },
        });

        await positionController.assignPosition(req, res);

        expect(prisma.position.update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: 'pos1' }, data: { userId: 'u1' } })
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ success: true, message: 'Position assigned successfully' })
        );
      });
    });
  });

  describe('assignPositionByTitle', () => {
    it('rejects when positionTitle or userId is missing', async () => {
      const req = { body: { positionTitle: 'Vice President' } };
      const res = mockRes();

      await positionController.assignPositionByTitle(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Position title and User ID are required' })
      );
    });

    it('rejects an invalid position title', async () => {
      const req = { body: { positionTitle: 'Not A Position', userId: 'u1' } };
      const res = mockRes();

      await positionController.assignPositionByTitle(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Invalid position title') })
      );
    });

    it('returns 404 when the position does not exist', async () => {
      const req = { body: { positionTitle: 'Vice President', userId: 'u1' } };
      const res = mockRes();

      prisma.position.findUnique.mockResolvedValue(null);

      await positionController.assignPositionByTitle(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Position not found' })
      );
    });

    it('returns 404 when the user does not exist', async () => {
      const req = { body: { positionTitle: 'Vice President', userId: 'u1' } };
      const res = mockRes();

      prisma.position.findUnique.mockResolvedValue({ id: 'pos1', userId: null });
      prisma.user.findUnique.mockResolvedValue(null);

      await positionController.assignPositionByTitle(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'User not found' })
      );
    });

    it('rejects when the position is already assigned to another user', async () => {
      const req = { body: { positionTitle: 'Vice President', userId: 'u1' } };
      const res = mockRes();

      prisma.position.findUnique.mockResolvedValue({ id: 'pos1', userId: 'other-user' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });

      await positionController.assignPositionByTitle(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Position "Vice President" already assigned to another user. Please unassign first.',
        })
      );
      expect(prisma.position.update).not.toHaveBeenCalled();
    });

    it('assigns the position to the user on success', async () => {
      const req = { body: { positionTitle: 'Vice President', userId: 'u1' } };
      const res = mockRes();

      prisma.position.findUnique.mockResolvedValue({ id: 'pos1', userId: null });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.position.update.mockResolvedValue({
        id: 'pos1',
        title: 'Vice President',
        userId: 'u1',
        user: { id: 'u1', name: 'Real Name' },
      });

      await positionController.assignPositionByTitle(req, res);

      expect(prisma.position.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'pos1' }, data: { userId: 'u1' } })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Vice President assigned successfully' })
      );
    });
  });

  describe('unassignPosition', () => {
    it('returns 404 when the position does not exist', async () => {
      const req = { params: { id: 'missing' } };
      const res = mockRes();

      prisma.position.findUnique.mockResolvedValue(null);

      await positionController.unassignPosition(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Position not found' })
      );
    });

    it('unassigns the position on success', async () => {
      const req = { params: { id: 'pos1' } };
      const res = mockRes();

      prisma.position.findUnique.mockResolvedValue({ id: 'pos1', userId: 'u1' });
      prisma.position.update.mockResolvedValue({ id: 'pos1', userId: null, user: null });

      await positionController.unassignPosition(req, res);

      expect(prisma.position.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'pos1' }, data: { userId: null } })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Position unassigned successfully' })
      );
    });
  });

  describe('getAvailablePositions', () => {
    it('returns positions without an assigned user', async () => {
      const req = {};
      const res = mockRes();

      const positions = [{ id: 'pos1', userId: null }];
      prisma.position.findMany.mockResolvedValue(positions);

      await positionController.getAvailablePositions(req, res);

      expect(prisma.position.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: null } })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, count: 1, positions })
      );
    });
  });

  describe('getUserPositions', () => {
    it("returns the given user's positions", async () => {
      const req = { params: { userId: 'u1' } };
      const res = mockRes();

      const positions = [{ id: 'pos1', userId: 'u1' }];
      prisma.position.findMany.mockResolvedValue(positions);

      await positionController.getUserPositions(req, res);

      expect(prisma.position.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' } })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, count: 1, positions })
      );
    });

    it('returns 500 on a database error', async () => {
      const req = { params: { userId: 'u1' } };
      const res = mockRes();

      prisma.position.findMany.mockRejectedValue(new Error('db down'));

      await positionController.getUserPositions(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
