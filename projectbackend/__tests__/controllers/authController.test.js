jest.mock('../../config/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  committeeMember: {
    findFirst: jest.fn(),
  },
}));
jest.mock('../../controllers/auditLogController', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../utils/password', () => ({
  hashPassword: jest.fn(),
  comparePassword: jest.fn(),
}));
jest.mock('jsonwebtoken');

const jwt = require('jsonwebtoken');
const prisma = require('../../config/prisma');
const { createAuditLog } = require('../../controllers/auditLogController');
const { hashPassword, comparePassword } = require('../../utils/password');
const authController = require('../../controllers/authController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('controllers/authController', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, JWT_SECRET: 'test-secret', JWT_EXPIRE: '7d' };
    jwt.sign.mockReturnValue('signed.jwt.token');
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe('register', () => {
    it('rejects when email or password is missing', async () => {
      const req = { body: { email: '', password: '' } };
      const res = mockRes();

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Email and password are required' })
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid role', async () => {
      const req = { body: { email: 'a@b.com', password: 'pw123456', role: 'superadmin', name: 'A' } };
      const res = mockRes();

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Valid role') })
      );
    });

    it('rejects student signup missing studentId/phone', async () => {
      const req = {
        body: { email: 'stu@b.com', password: 'pw123456', role: 'student', name: 'Stu' },
      };
      const res = mockRes();

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Registration number and phone number are required for student signup',
        })
      );
    });

    it('rejects when email already registered (non-society role)', async () => {
      const req = {
        body: {
          email: 'exists@b.com',
          password: 'pw123456',
          role: 'student',
          name: 'Stu',
          studentId: 'S1',
          phone: '0123',
        },
      };
      const res = mockRes();

      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'exists@b.com' });

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Email is already registered. Please log in.' })
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('creates a new student account and returns a token on success', async () => {
      const req = {
        body: {
          email: 'New.Student@B.com',
          password: 'pw123456',
          role: 'student',
          name: '  Stu Dent  ',
          studentId: ' S123 ',
          phone: ' 0123 ',
        },
      };
      const res = mockRes();

      prisma.user.findUnique
        .mockResolvedValueOnce(null) // no existing user by email
        .mockResolvedValueOnce(null); // no existing user by studentId
      hashPassword.mockResolvedValue('hashed-pw');
      prisma.user.create.mockResolvedValue({
        id: 'new-user-1',
        name: 'Stu Dent',
        email: 'new.student@b.com',
        phone: '0123',
        roles: ['student'],
        studentId: 'S123',
        isActive: true,
      });

      await authController.register(req, res);

      expect(hashPassword).toHaveBeenCalledWith('pw123456');
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Stu Dent',
          email: 'new.student@b.com',
          password: 'hashed-pw',
          phone: '0123',
          roles: ['student'],
          studentId: 'S123',
        }),
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, token: 'signed.jwt.token' })
      );
    });

    it('rejects society signup when no existing account matches the email', async () => {
      const req = { body: { email: 'nobody@b.com', password: 'pw123456', role: 'society' } };
      const res = mockRes();

      prisma.user.findUnique.mockResolvedValue(null);

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('already added as committee members'),
        })
      );
    });

    it('rejects society signup when the account is not an active committee member', async () => {
      const req = { body: { email: 'stu@b.com', password: 'pw123456', role: 'society' } };
      const res = mockRes();

      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        isActive: true,
        roles: ['student'],
        password: 'hashed',
      });
      comparePassword.mockResolvedValue(true);
      prisma.committeeMember.findFirst.mockResolvedValue(null);

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('active committee member'),
        })
      );
    });

    it('promotes an existing student to society role when they are an active committee member', async () => {
      const req = { body: { email: 'stu@b.com', password: 'correct-pw', role: 'society' } };
      const res = mockRes();

      const existingUser = {
        id: 'u1',
        isActive: true,
        roles: ['student'],
        password: 'hashed',
        societyName: null,
        societyRole: null,
      };
      prisma.user.findUnique.mockResolvedValue(existingUser);
      comparePassword.mockResolvedValue(true);
      prisma.committeeMember.findFirst.mockResolvedValue({
        role: 'GENERAL_SECRETARY',
        committee: { name: 'CS Society' },
      });
      prisma.user.update.mockResolvedValue({
        ...existingUser,
        roles: ['student', 'society'],
        societyName: 'CS Society',
        societyRole: 'General Secretary',
      });

      await authController.register(req, res);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: {
          roles: { push: 'society' },
          societyName: 'CS Society',
          societyRole: 'General Secretary',
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('login', () => {
    it('rejects when email or password is missing', async () => {
      const req = { body: {} };
      const res = mockRes();

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 401 when the user does not exist', async () => {
      const req = { body: { email: 'nobody@b.com', password: 'pw' } };
      const res = mockRes();

      prisma.user.findUnique.mockResolvedValue(null);

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid credentials' })
      );
    });

    it("returns 401 when the user does not have the requested role", async () => {
      const req = { body: { email: 'stu@b.com', password: 'pw', role: 'admin' } };
      const res = mockRes();

      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        roles: ['student'],
        isActive: true,
        password: 'hashed',
      });

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'You do not have a admin account' })
      );
    });

    it('returns 401 for a deactivated account', async () => {
      const req = { body: { email: 'stu@b.com', password: 'pw' } };
      const res = mockRes();

      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        roles: ['student'],
        isActive: false,
        password: 'hashed',
      });

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('deactivated') })
      );
    });

    it('returns 401 when the password does not match', async () => {
      const req = { body: { email: 'stu@b.com', password: 'wrong' } };
      const res = mockRes();

      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        roles: ['student'],
        isActive: true,
        password: 'hashed',
      });
      comparePassword.mockResolvedValue(false);

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid credentials' })
      );
    });

    it('logs in successfully, updates lastLogin, and returns a token', async () => {
      const req = { body: { email: 'Stu@B.com', password: 'correct-pw' } };
      const res = mockRes();

      const user = {
        id: 'u1',
        name: 'Stu',
        email: 'stu@b.com',
        roles: ['student'],
        isActive: true,
        password: 'hashed',
      };
      prisma.user.findUnique.mockResolvedValue(user);
      comparePassword.mockResolvedValue(true);
      prisma.user.update.mockResolvedValue({ ...user, lastLogin: new Date() });

      await authController.login(req, res);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { lastLogin: expect.any(Date) },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, token: 'signed.jwt.token' })
      );
    });

    it('still logs the user in even if the lastLogin update fails', async () => {
      const req = { body: { email: 'stu@b.com', password: 'correct-pw' } };
      const res = mockRes();

      const user = {
        id: 'u1',
        name: 'Stu',
        email: 'stu@b.com',
        roles: ['student'],
        isActive: true,
        password: 'hashed',
      };
      prisma.user.findUnique.mockResolvedValue(user);
      comparePassword.mockResolvedValue(true);
      prisma.user.update.mockRejectedValue(new Error('db timeout'));

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, token: 'signed.jwt.token' })
      );
    });
  });

  describe('updatePassword', () => {
    it('rejects when the current password does not match', async () => {
      const req = { user: { id: 'u1' }, body: { currentPassword: 'wrong', newPassword: 'new' } };
      const res = mockRes();

      prisma.user.findUnique.mockResolvedValue({ id: 'u1', password: 'hashed' });
      comparePassword.mockResolvedValue(false);

      await authController.updatePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Current password is incorrect' })
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('updates the password and returns a new token on success', async () => {
      const req = { user: { id: 'u1' }, body: { currentPassword: 'old', newPassword: 'newpw123' } };
      const res = mockRes();

      prisma.user.findUnique.mockResolvedValue({ id: 'u1', password: 'hashed-old' });
      comparePassword.mockResolvedValue(true);
      hashPassword.mockResolvedValue('hashed-new');
      prisma.user.update.mockResolvedValue({ id: 'u1', name: 'Stu', email: 'stu@b.com', roles: ['student'] });

      await authController.updatePassword(req, res);

      expect(hashPassword).toHaveBeenCalledWith('newpw123');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { password: 'hashed-new', passwordChangedAt: expect.any(Date) },
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('closeUserAccount', () => {
    it('rejects when no closure reason is provided', async () => {
      const req = { params: { id: 'target-1' }, body: {}, user: { id: 'admin-1' } };
      const res = mockRes();

      await authController.closeUserAccount(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Closure reason is required' })
      );
    });

    it('rejects an admin trying to close their own account', async () => {
      const req = {
        params: { id: 'admin-1' },
        body: { reason: 'test' },
        user: { id: 'admin-1' },
      };
      const res = mockRes();

      await authController.closeUserAccount(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Admin cannot close their own account' })
      );
    });

    it('returns 404 when the target user does not exist', async () => {
      const req = {
        params: { id: 'target-1' },
        body: { reason: 'violation' },
        user: { id: 'admin-1' },
      };
      const res = mockRes();

      prisma.user.findUnique.mockResolvedValue(null);

      await authController.closeUserAccount(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('closes an active account and writes an audit log', async () => {
      const req = {
        params: { id: 'target-1' },
        body: { reason: 'policy violation' },
        user: { id: 'admin-1', email: 'admin@b.com', name: 'Admin' },
      };
      const res = mockRes();

      prisma.user.findUnique.mockResolvedValue({
        id: 'target-1',
        name: 'Target',
        email: 'target@b.com',
        isActive: true,
      });
      prisma.user.update.mockResolvedValue({
        id: 'target-1',
        name: 'Target',
        email: 'target@b.com',
        isActive: false,
      });

      await authController.closeUserAccount(req, res);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'target-1' },
        data: { isActive: false },
        select: expect.any(Object),
      });
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user_account_closed', actorId: 'admin-1' })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('assignUserRole', () => {
    it('rejects an invalid role', async () => {
      const req = { params: { id: 'target-1' }, body: { role: 'student' }, user: { id: 'admin-1' } };
      const res = mockRes();

      await authController.assignUserRole(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Only admin or society roles can be assigned' })
      );
    });

    it('rejects promoting a non-student account', async () => {
      const req = { params: { id: 'target-1' }, body: { role: 'admin' }, user: { id: 'admin-1' } };
      const res = mockRes();

      prisma.user.findUnique.mockResolvedValue({
        id: 'target-1',
        isActive: true,
        roles: ['society'],
      });

      await authController.assignUserRole(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Only student accounts can be promoted' })
      );
    });

    it('assigns the admin role to an eligible student and writes an audit log', async () => {
      const req = {
        params: { id: 'target-1' },
        body: { role: 'admin' },
        user: { id: 'admin-1', email: 'admin@b.com', name: 'Admin' },
      };
      const res = mockRes();

      prisma.user.findUnique.mockResolvedValue({
        id: 'target-1',
        isActive: true,
        roles: ['student'],
        name: 'Target',
        email: 'target@b.com',
      });
      prisma.user.update.mockResolvedValue({
        id: 'target-1',
        roles: ['student', 'admin'],
      });

      await authController.assignUserRole(req, res);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'target-1' },
        data: { roles: { push: 'admin' } },
        select: expect.any(Object),
      });
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user_role_assigned' })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('logout', () => {
    it('returns a success response', async () => {
      const req = {};
      const res = mockRes();

      await authController.logout(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Logged out successfully' })
      );
    });
  });

  describe('getMe', () => {
    it('returns the current user profile', async () => {
      const req = { user: { id: 'u1' } };
      const res = mockRes();

      prisma.user.findUnique.mockResolvedValue({ id: 'u1', name: 'Stu' });

      await authController.getMe(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, user: { id: 'u1', name: 'Stu' } })
      );
    });
  });
});
