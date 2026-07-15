jest.mock('../../config/prisma', () => ({
  user: {
    findUnique: jest.fn(),
  },
}));
jest.mock('jsonwebtoken');

const jwt = require('jsonwebtoken');
const prisma = require('../../config/prisma');
const { protect, authorize } = require('../../middleware/auth');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('middleware/auth', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, JWT_SECRET: 'test-secret' };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe('protect', () => {
    it('rejects requests with no authorization header', async () => {
      const req = { headers: {} };
      const res = mockRes();
      const next = jest.fn();

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects requests with a malformed authorization header (no Bearer prefix)', async () => {
      const req = { headers: { authorization: 'Token abc123' } };
      const res = mockRes();
      const next = jest.fn();

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects requests with an invalid/expired token', async () => {
      const req = { headers: { authorization: 'Bearer badtoken' } };
      const res = mockRes();
      const next = jest.fn();

      jwt.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Invalid token') })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects when the decoded user no longer exists', async () => {
      const req = { headers: { authorization: 'Bearer validtoken' } };
      const res = mockRes();
      const next = jest.fn();

      jwt.verify.mockReturnValue({ id: 'user-1', iat: 1000 });
      prisma.user.findUnique.mockResolvedValue(null);

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'User not found' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects when the user account has been deactivated', async () => {
      const req = { headers: { authorization: 'Bearer validtoken' } };
      const res = mockRes();
      const next = jest.fn();

      jwt.verify.mockReturnValue({ id: 'user-1', iat: 1000 });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: false });

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Your account has been deactivated' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects when the password was changed after the token was issued', async () => {
      const req = { headers: { authorization: 'Bearer validtoken' } };
      const res = mockRes();
      const next = jest.fn();

      // Token issued at t=1000 (seconds); password changed later.
      jwt.verify.mockReturnValue({ id: 'user-1', iat: 1000 });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isActive: true,
        passwordChangedAt: new Date(2000 * 1000),
      });

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('recently changed') })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next() and attaches req.user for a valid, active user', async () => {
      const req = { headers: { authorization: 'Bearer validtoken' } };
      const res = mockRes();
      const next = jest.fn();

      const user = { id: 'user-1', isActive: true, passwordChangedAt: null, roles: ['student'] };
      jwt.verify.mockReturnValue({ id: 'user-1', iat: 1000 });
      prisma.user.findUnique.mockResolvedValue(user);

      await protect(req, res, next);

      expect(req.user).toBe(user);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    it('allows access when the user has one of the required roles', () => {
      const req = { user: { roles: ['admin'] } };
      const res = mockRes();
      const next = jest.fn();

      authorize('admin', 'society')(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('denies access when the user lacks the required role', () => {
      const req = { user: { roles: ['student'] } };
      const res = mockRes();
      const next = jest.fn();

      authorize('admin', 'society')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('denies access when the user has no roles array', () => {
      const req = { user: {} };
      const res = mockRes();
      const next = jest.fn();

      authorize('admin')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
