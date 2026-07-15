jest.mock('../../config/prisma', () => ({
  committee: {
    updateMany: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  committeeMember: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  },
}));
jest.mock('../../controllers/auditLogController', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

const prisma = require('../../config/prisma');
const { createAuditLog } = require('../../controllers/auditLogController');
const committeeController = require('../../controllers/committeeController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const actor = { id: 'admin-1', email: 'admin@b.com', name: 'Admin' };

describe('controllers/committeeController', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCommittee', () => {
    it('rejects when name, termStart, or termEnd is missing', async () => {
      const req = { body: { name: 'Committee A' }, user: actor };
      const res = mockRes();

      await committeeController.createCommittee(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Name, termStart, and termEnd are required' })
      );
      expect(prisma.committee.create).not.toHaveBeenCalled();
    });

    it('rejects when termEnd is not after termStart', async () => {
      const req = {
        body: { name: 'Committee A', termStart: '2026-06-01', termEnd: '2026-01-01' },
        user: actor,
      };
      const res = mockRes();

      await committeeController.createCommittee(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'termEnd must be after termStart' })
      );
      expect(prisma.committee.create).not.toHaveBeenCalled();
    });

    it('deactivates existing active committees, creates the new one, and writes an audit log', async () => {
      const req = {
        body: { name: 'Committee A', termStart: '2026-01-01', termEnd: '2026-12-31' },
        user: actor,
        ip: '127.0.0.1',
      };
      const res = mockRes();

      prisma.committee.updateMany.mockResolvedValue({ count: 1 });
      prisma.committee.create.mockResolvedValue({
        id: 'c1',
        name: 'Committee A',
        termStart: new Date('2026-01-01'),
        termEnd: new Date('2026-12-31'),
        isActive: true,
        members: [],
      });

      await committeeController.createCommittee(req, res);

      expect(prisma.committee.updateMany).toHaveBeenCalledWith({
        where: { isActive: true },
        data: { isActive: false },
      });
      expect(prisma.committee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Committee A', isActive: true }),
        })
      );
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'committee_created', actorId: 'admin-1' })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, committee: expect.objectContaining({ id: 'c1' }) })
      );
    });
  });

  describe('getCommittees', () => {
    it('returns the list of committees', async () => {
      const req = {};
      const res = mockRes();

      prisma.committee.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);

      await committeeController.getCommittees(req, res);

      expect(prisma.committee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { termStart: 'desc' } })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, committees: [{ id: 'c1' }, { id: 'c2' }] })
      );
    });
  });

  describe('getActiveCommittee', () => {
    it('returns the active committee, which may be null', async () => {
      const req = {};
      const res = mockRes();

      prisma.committee.findFirst.mockResolvedValue(null);

      await committeeController.getActiveCommittee(req, res);

      expect(prisma.committee.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } })
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, committee: null });
    });
  });

  describe('getCommitteeById', () => {
    it('returns 404 when the committee does not exist', async () => {
      const req = { params: { id: 'missing' } };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue(null);

      await committeeController.getCommitteeById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Committee not found' })
      );
    });

    it('returns the committee when found', async () => {
      const req = { params: { id: 'c1' } };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue({ id: 'c1', name: 'Committee A' });

      await committeeController.getCommitteeById(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, committee: { id: 'c1', name: 'Committee A' } })
      );
    });
  });

  describe('updateCommittee', () => {
    it('returns 404 when the committee does not exist', async () => {
      const req = { params: { id: 'missing' }, body: {}, user: actor };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue(null);

      await committeeController.updateCommittee(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prisma.committee.update).not.toHaveBeenCalled();
    });

    it('rejects an empty committee name', async () => {
      const req = {
        params: { id: 'c1' },
        body: { name: '   ' },
        user: actor,
      };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Old Name',
        termStart: new Date('2026-01-01'),
        termEnd: new Date('2026-12-31'),
      });

      await committeeController.updateCommittee(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Committee name cannot be empty' })
      );
    });

    it('rejects invalid termStart/termEnd dates', async () => {
      const req = {
        params: { id: 'c1' },
        body: { termStart: 'not-a-date' },
        user: actor,
      };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Committee A',
        termStart: new Date('2026-01-01'),
        termEnd: new Date('2026-12-31'),
      });

      await committeeController.updateCommittee(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid termStart or termEnd date' })
      );
    });

    it('rejects when the resulting termEnd is not after termStart', async () => {
      const req = {
        params: { id: 'c1' },
        body: { termStart: '2026-12-31', termEnd: '2026-01-01' },
        user: actor,
      };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Committee A',
        termStart: new Date('2026-01-01'),
        termEnd: new Date('2026-12-31'),
      });

      await committeeController.updateCommittee(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'termEnd must be after termStart' })
      );
    });

    it('updates the committee and writes an audit log', async () => {
      const req = {
        params: { id: 'c1' },
        body: { name: 'New Name' },
        user: actor,
        ip: '127.0.0.1',
      };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Old Name',
        termStart: new Date('2026-01-01'),
        termEnd: new Date('2026-12-31'),
      });
      prisma.committee.update.mockResolvedValue({
        id: 'c1',
        name: 'New Name',
        termStart: new Date('2026-01-01'),
        termEnd: new Date('2026-12-31'),
        members: [],
      });

      await committeeController.updateCommittee(req, res);

      expect(prisma.committee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1' },
          data: { name: 'New Name' },
        })
      );
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'committee_updated' })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Committee updated' })
      );
    });
  });

  describe('deleteCommittee', () => {
    it('returns 404 when the committee does not exist', async () => {
      const req = { params: { id: 'missing' }, user: actor };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue(null);

      await committeeController.deleteCommittee(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prisma.committee.delete).not.toHaveBeenCalled();
    });

    it('deletes the committee and writes an audit log', async () => {
      const req = { params: { id: 'c1' }, user: actor, ip: '127.0.0.1' };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Committee A',
        isActive: true,
        termStart: new Date('2026-01-01'),
        termEnd: new Date('2026-12-31'),
        _count: { members: 3 },
      });
      prisma.committee.delete.mockResolvedValue({ id: 'c1' });

      await committeeController.deleteCommittee(req, res);

      expect(prisma.committee.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'committee_deleted' })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Committee deleted successfully' })
      );
    });
  });

  describe('addMember', () => {
    it('rejects when userId or role is missing', async () => {
      const req = { params: { id: 'c1' }, body: {}, user: actor };
      const res = mockRes();

      await committeeController.addMember(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'userId and role are required' })
      );
    });

    it('returns 404 when the committee does not exist', async () => {
      const req = { params: { id: 'missing' }, body: { userId: 'u1', role: 'EXECUTIVE_MEMBER' }, user: actor };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue(null);

      await committeeController.addMember(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Committee not found' })
      );
    });

    it('rejects modifying an inactive committee', async () => {
      const req = { params: { id: 'c1' }, body: { userId: 'u1', role: 'EXECUTIVE_MEMBER' }, user: actor };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue({ id: 'c1', isActive: false });

      await committeeController.addMember(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Cannot modify an inactive committee' })
      );
    });

    it('returns 404 when the user does not exist', async () => {
      const req = { params: { id: 'c1' }, body: { userId: 'missing-user', role: 'EXECUTIVE_MEMBER' }, user: actor };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue({ id: 'c1', isActive: true, name: 'Committee A' });
      prisma.user.findUnique.mockResolvedValue(null);

      await committeeController.addMember(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'User not found' })
      );
    });

    it('rejects a singleton role that is already assigned', async () => {
      const req = { params: { id: 'c1' }, body: { userId: 'u1', role: 'GENERAL_SECRETARY' }, user: actor };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue({ id: 'c1', isActive: true, name: 'Committee A' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', name: 'User One' });
      prisma.committeeMember.findFirst.mockResolvedValueOnce({ id: 'existing-member' });

      await committeeController.addMember(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'The role General Secretary is already assigned in this committee',
        })
      );
      expect(prisma.committeeMember.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate user+role assignment', async () => {
      const req = { params: { id: 'c1' }, body: { userId: 'u1', role: 'EXECUTIVE_MEMBER' }, user: actor };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue({ id: 'c1', isActive: true, name: 'Committee A' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', name: 'User One' });
      prisma.committeeMember.findFirst.mockResolvedValueOnce({ id: 'existing-member' });

      await committeeController.addMember(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'This user already holds this role in the committee' })
      );
      expect(prisma.committeeMember.create).not.toHaveBeenCalled();
    });

    it('adds the member and writes an audit log on success', async () => {
      const req = {
        params: { id: 'c1' },
        body: { userId: 'u1', role: 'EXECUTIVE_MEMBER' },
        user: actor,
        ip: '127.0.0.1',
      };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue({ id: 'c1', isActive: true, name: 'Committee A' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', name: 'User One' });
      prisma.committeeMember.findFirst.mockResolvedValue(null);
      prisma.committeeMember.create.mockResolvedValue({
        id: 'm1',
        committeeId: 'c1',
        userId: 'u1',
        role: 'EXECUTIVE_MEMBER',
        user: { id: 'u1', name: 'User One' },
      });

      await committeeController.addMember(req, res);

      expect(prisma.committeeMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { committeeId: 'c1', userId: 'u1', role: 'EXECUTIVE_MEMBER' },
        })
      );
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'committee_member_added' })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Member added to committee' })
      );
    });
  });

  describe('removeMember', () => {
    it('returns 404 when the committee does not exist', async () => {
      const req = { params: { id: 'missing', memberId: 'm1' } };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue(null);

      await committeeController.removeMember(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Committee not found' })
      );
    });

    it('rejects modifying an inactive committee', async () => {
      const req = { params: { id: 'c1', memberId: 'm1' } };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue({ id: 'c1', isActive: false });

      await committeeController.removeMember(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Cannot modify an inactive committee' })
      );
    });

    it('returns 404 when the member does not belong to this committee', async () => {
      const req = { params: { id: 'c1', memberId: 'm1' } };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue({ id: 'c1', isActive: true });
      prisma.committeeMember.findUnique.mockResolvedValue({ id: 'm1', committeeId: 'other-committee' });

      await committeeController.removeMember(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Member not found in this committee' })
      );
      expect(prisma.committeeMember.delete).not.toHaveBeenCalled();
    });

    it('removes the member on success', async () => {
      const req = { params: { id: 'c1', memberId: 'm1' } };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue({ id: 'c1', isActive: true });
      prisma.committeeMember.findUnique.mockResolvedValue({ id: 'm1', committeeId: 'c1' });
      prisma.committeeMember.delete.mockResolvedValue({ id: 'm1' });

      await committeeController.removeMember(req, res);

      expect(prisma.committeeMember.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Member removed from committee' })
      );
    });
  });

  describe('updateMemberRole', () => {
    it('rejects when role is missing', async () => {
      const req = { params: { id: 'c1', memberId: 'm1' }, body: {} };
      const res = mockRes();

      await committeeController.updateMemberRole(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'role is required' })
      );
    });

    it('rejects when the committee does not exist or is inactive', async () => {
      const req = { params: { id: 'c1', memberId: 'm1' }, body: { role: 'EXECUTIVE_MEMBER' } };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue({ id: 'c1', isActive: false });

      await committeeController.updateMemberRole(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Committee not found or inactive' })
      );
    });

    it('returns 404 when the member does not belong to this committee', async () => {
      const req = { params: { id: 'c1', memberId: 'm1' }, body: { role: 'EXECUTIVE_MEMBER' } };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue({ id: 'c1', isActive: true });
      prisma.committeeMember.findUnique.mockResolvedValue({ id: 'm1', committeeId: 'other-committee' });

      await committeeController.updateMemberRole(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Member not found in this committee' })
      );
    });

    it('rejects a singleton role already held by another member', async () => {
      const req = { params: { id: 'c1', memberId: 'm1' }, body: { role: 'SPORTS_SECRETARY' } };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue({ id: 'c1', isActive: true });
      prisma.committeeMember.findUnique.mockResolvedValue({ id: 'm1', committeeId: 'c1' });
      prisma.committeeMember.findFirst.mockResolvedValue({ id: 'other-member' });

      await committeeController.updateMemberRole(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'The role Sports Secretary is already assigned' })
      );
      expect(prisma.committeeMember.update).not.toHaveBeenCalled();
    });

    it('updates the member role on success', async () => {
      const req = { params: { id: 'c1', memberId: 'm1' }, body: { role: 'EXECUTIVE_MEMBER' } };
      const res = mockRes();

      prisma.committee.findUnique.mockResolvedValue({ id: 'c1', isActive: true });
      prisma.committeeMember.findUnique.mockResolvedValue({ id: 'm1', committeeId: 'c1' });
      prisma.committeeMember.update.mockResolvedValue({
        id: 'm1',
        role: 'EXECUTIVE_MEMBER',
        user: { id: 'u1', name: 'User One' },
      });

      await committeeController.updateMemberRole(req, res);

      expect(prisma.committeeMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'm1' },
          data: { role: 'EXECUTIVE_MEMBER' },
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Member role updated' })
      );
    });
  });

  describe('deactivateCommittee', () => {
    it('deactivates the committee', async () => {
      const req = { params: { id: 'c1' } };
      const res = mockRes();

      prisma.committee.update.mockResolvedValue({ id: 'c1', isActive: false });

      await committeeController.deactivateCommittee(req, res);

      expect(prisma.committee.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { isActive: false },
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Committee deactivated' })
      );
    });
  });
});
