const { hashPassword, comparePassword } = require('../../utils/password');

describe('utils/password', () => {
  describe('hashPassword', () => {
    it('returns a bcrypt hash different from the plain text password', async () => {
      const hash = await hashPassword('SuperSecret123');

      expect(hash).toEqual(expect.any(String));
      expect(hash).not.toBe('SuperSecret123');
      expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it('produces a different hash each time (random salt)', async () => {
      const [hash1, hash2] = await Promise.all([
        hashPassword('SamePassword'),
        hashPassword('SamePassword'),
      ]);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('resolves true when the candidate matches the hash', async () => {
      const hash = await hashPassword('CorrectHorseBatteryStaple');

      await expect(comparePassword('CorrectHorseBatteryStaple', hash)).resolves.toBe(true);
    });

    it('resolves false when the candidate does not match the hash', async () => {
      const hash = await hashPassword('CorrectHorseBatteryStaple');

      await expect(comparePassword('WrongPassword', hash)).resolves.toBe(false);
    });

    it('resolves false when compared against an empty hash', async () => {
      await expect(comparePassword('anything', '')).resolves.toBe(false);
    });
  });
});
