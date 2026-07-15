jest.mock('../../config/prisma', () => ({
  user: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  notification: {
    create: jest.fn(),
  },
  studentFeePayment: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  studentFeeReceipt: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
}));

const prisma = require('../../config/prisma');
const studentAffairsController = require('../../controllers/studentAffairsController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// Shared transaction-scoped mock ("tx") used by every prisma.$transaction callback.
const tx = {
  studentFeePayment: {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
  },
  studentFeeReceipt: {
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('controllers/studentAffairsController', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Sensible defaults so fire-and-forget notification helpers don't blow up.
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.notification.create.mockResolvedValue({ id: 'notif-1' });
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('createReceipt', () => {
    const validBody = {
      reference: ' REF123 ',
      paymentDate: '2024-01-15',
      amount: '500',
      semester: '1st',
      session: '2024-25',
      notes: ' some note ',
      fileUrl: 'http://x/file.pdf',
      fileName: 'file.pdf',
      mimeType: 'APPLICATION/PDF',
    };

    it('rejects non-student users', async () => {
      const req = { user: { id: 'u1', roles: ['society'] }, body: validBody };
      const res = mockRes();

      await studentAffairsController.createReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Only students can submit bank receipts' })
      );
      expect(prisma.studentFeePayment.findFirst).not.toHaveBeenCalled();
    });

    it('rejects when required fields are missing', async () => {
      const req = { user: { id: 'u1', roles: ['student'] }, body: { reference: 'REF' } };
      const res = mockRes();

      await studentAffairsController.createReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('are required'),
        })
      );
    });

    it('rejects an invalid semester', async () => {
      const req = {
        user: { id: 'u1', roles: ['student'] },
        body: { ...validBody, semester: 'invalid' },
      };
      const res = mockRes();

      await studentAffairsController.createReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Semester must be one of') })
      );
    });

    it('rejects a blank session', async () => {
      const req = {
        user: { id: 'u1', roles: ['student'] },
        body: { ...validBody, session: '   ' },
      };
      const res = mockRes();

      await studentAffairsController.createReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Session is required' })
      );
    });

    it('rejects when a payment already exists for the semester/session', async () => {
      const req = { user: { id: 'u1', roles: ['student'] }, body: validBody };
      const res = mockRes();

      prisma.studentFeePayment.findFirst.mockResolvedValue({ id: 'existing-1', status: 'pending' });

      await studentAffairsController.createReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a non-positive amount', async () => {
      const req = {
        user: { id: 'u1', roles: ['student'] },
        body: { ...validBody, amount: '-5' },
      };
      const res = mockRes();

      prisma.studentFeePayment.findFirst.mockResolvedValue(null);

      await studentAffairsController.createReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Amount must be a positive number' })
      );
    });

    it('rejects an invalid payment date', async () => {
      const req = {
        user: { id: 'u1', roles: ['student'] },
        body: { ...validBody, paymentDate: 'not-a-date' },
      };
      const res = mockRes();

      prisma.studentFeePayment.findFirst.mockResolvedValue(null);

      await studentAffairsController.createReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid payment date' })
      );
    });

    it('rejects an unsupported mime type', async () => {
      const req = {
        user: { id: 'u1', roles: ['student'] },
        body: { ...validBody, mimeType: 'application/zip' },
      };
      const res = mockRes();

      prisma.studentFeePayment.findFirst.mockResolvedValue(null);

      await studentAffairsController.createReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Unsupported receipt file type') })
      );
    });

    it('creates a pending payment and receipt on success', async () => {
      const req = { user: { id: 'student-1', roles: ['student'] }, body: validBody };
      const res = mockRes();

      prisma.studentFeePayment.findFirst.mockResolvedValue(null);
      const paymentRecord = { id: 'pay-1' };
      const receiptRecord = { id: 'rec-1', paymentId: 'pay-1' };
      tx.studentFeePayment.create.mockResolvedValue(paymentRecord);
      tx.studentFeeReceipt.create.mockResolvedValue(receiptRecord);

      await studentAffairsController.createReceipt(req, res);

      expect(tx.studentFeePayment.create).toHaveBeenCalledWith({
        data: {
          studentId: 'student-1',
          reference: 'REF123',
          paymentDate: expect.any(Date),
          amount: 500,
          semester: '1st',
          session: '2024-25',
          notes: 'some note',
          status: 'pending',
        },
      });
      expect(tx.studentFeeReceipt.create).toHaveBeenCalledWith({
        data: {
          paymentId: 'pay-1',
          studentId: 'student-1',
          fileUrl: 'http://x/file.pdf',
          fileName: 'file.pdf',
          mimeType: 'application/pdf',
          status: 'pending',
        },
        include: { payment: true },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, payment: paymentRecord, receipt: receiptRecord })
      );
    });
  });

  describe('getReceipts', () => {
    it('rejects users who are neither admin nor society', async () => {
      const req = { user: { id: 'u1', roles: ['student'] }, query: {} };
      const res = mockRes();

      await studentAffairsController.getReceipts(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.studentFeeReceipt.findMany).not.toHaveBeenCalled();
    });

    it('merges receipts with unreceipted paid payments when no status filter is set', async () => {
      const req = { user: { id: 'admin-1', roles: ['admin'] }, query: {} };
      const res = mockRes();

      prisma.studentFeeReceipt.findMany.mockResolvedValue([
        { id: 'r1', createdAt: new Date('2024-02-01') },
      ]);
      prisma.studentFeeReceipt.count.mockResolvedValue(2);
      prisma.studentFeePayment.findMany.mockResolvedValue([
        {
          id: 'p1',
          studentId: 'stu1',
          reference: 'REF-P1',
          paymentDate: new Date('2024-01-01'),
          amount: 100,
          semester: '1st',
          session: '2024-25',
          notes: null,
          status: 'paid',
          verifiedAt: new Date('2024-01-02'),
          verifiedById: 'admin-1',
          verifiedBy: { id: 'admin-1', name: 'Admin', email: 'a@b.com' },
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          student: { id: 'stu1', name: 'Stu', email: 'stu@b.com', studentId: '20230001' },
        },
      ]);

      await studentAffairsController.getReceipts(req, res);

      expect(prisma.studentFeePayment.findMany).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          receipts: expect.arrayContaining([
            expect.objectContaining({ id: 'r1' }),
            expect.objectContaining({ id: 'payment-p1', isManualEntry: true }),
          ]),
          pagination: expect.objectContaining({ page: 1, limit: 20, total: 2 }),
        })
      );
    });

    it('skips unreceipted payments when filtering by a status other than accepted', async () => {
      const req = { user: { id: 'admin-1', roles: ['admin'] }, query: { status: 'pending' } };
      const res = mockRes();

      prisma.studentFeeReceipt.findMany.mockResolvedValue([]);
      prisma.studentFeeReceipt.count.mockResolvedValue(0);

      await studentAffairsController.getReceipts(req, res);

      expect(prisma.studentFeePayment.findMany).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, receipts: [] })
      );
    });
  });

  describe('getReceiptsReport', () => {
    it('rejects users who are neither admin nor society', async () => {
      const req = { user: { id: 'u1', roles: ['student'] }, query: {} };
      const res = mockRes();

      await studentAffairsController.getReceiptsReport(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns a paginated fee report for admins', async () => {
      const req = { user: { id: 'admin-1', roles: ['admin'] }, query: {} };
      const res = mockRes();

      const rows = [{ id: 'pay-1', studentId: 'stu1' }];
      prisma.studentFeePayment.findMany
        .mockResolvedValueOnce(rows) // rows for the table
        .mockResolvedValueOnce([]); // matrix payments for the student list
      prisma.studentFeePayment.count.mockResolvedValue(1);
      prisma.studentFeePayment.groupBy.mockResolvedValue([{ studentId: 'stu1' }]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'stu1', name: 'Stu', email: 'stu@b.com', studentId: '20230001' },
      ]);

      await studentAffairsController.getReceiptsReport(req, res);

      expect(prisma.studentFeePayment.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ where: expect.objectContaining({ status: 'paid' }) })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          totals: expect.objectContaining({ totalPaidStudents: 1, totalResults: 1 }),
          rows,
        })
      );
    });
  });

  describe('getMyReceipts', () => {
    it('rejects non-student users', async () => {
      const req = { user: { id: 'u1', roles: ['admin'] } };
      const res = mockRes();

      await studentAffairsController.getMyReceipts(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("returns the student's own receipts", async () => {
      const req = { user: { id: 'student-1', roles: ['student'] } };
      const res = mockRes();

      prisma.studentFeeReceipt.findMany.mockResolvedValue([{ id: 'r1', studentId: 'student-1' }]);

      await studentAffairsController.getMyReceipts(req, res);

      expect(prisma.studentFeeReceipt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 'student-1' } })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, receipts: [{ id: 'r1', studentId: 'student-1' }] })
      );
    });
  });

  describe('getReceiptById', () => {
    it('returns 404 when the receipt does not exist', async () => {
      const req = { params: { id: 'rec-1' }, user: { id: 'u1', roles: ['student'] } };
      const res = mockRes();

      prisma.studentFeeReceipt.findUnique.mockResolvedValue(null);

      await studentAffairsController.getReceiptById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects a student viewing someone else\'s receipt', async () => {
      const req = { params: { id: 'rec-1' }, user: { id: 'student-2', roles: ['student'] } };
      const res = mockRes();

      prisma.studentFeeReceipt.findUnique.mockResolvedValue({ id: 'rec-1', studentId: 'student-1' });

      await studentAffairsController.getReceiptById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('allows an admin to view any receipt', async () => {
      const req = { params: { id: 'rec-1' }, user: { id: 'admin-1', roles: ['admin'] } };
      const res = mockRes();

      const receipt = { id: 'rec-1', studentId: 'student-1' };
      prisma.studentFeeReceipt.findUnique.mockResolvedValue(receipt);

      await studentAffairsController.getReceiptById(req, res);

      expect(res.json).toHaveBeenCalledWith({ success: true, receipt });
    });

    it('allows the owning student to view their receipt', async () => {
      const req = { params: { id: 'rec-1' }, user: { id: 'student-1', roles: ['student'] } };
      const res = mockRes();

      const receipt = { id: 'rec-1', studentId: 'student-1' };
      prisma.studentFeeReceipt.findUnique.mockResolvedValue(receipt);

      await studentAffairsController.getReceiptById(req, res);

      expect(res.json).toHaveBeenCalledWith({ success: true, receipt });
    });
  });

  describe('reviewReceipt', () => {
    it('rejects users who are neither admin nor society', async () => {
      const req = { params: { id: 'rec-1' }, body: { decision: 'accepted' }, user: { id: 'u1', roles: ['student'] } };
      const res = mockRes();

      await studentAffairsController.reviewReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('rejects an invalid decision', async () => {
      const req = {
        params: { id: 'rec-1' },
        body: { decision: 'maybe' },
        user: { id: 'admin-1', roles: ['admin'] },
      };
      const res = mockRes();

      await studentAffairsController.reviewReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Decision must be accepted or rejected' })
      );
    });

    it('requires a note when rejecting', async () => {
      const req = {
        params: { id: 'rec-1' },
        body: { decision: 'rejected' },
        user: { id: 'admin-1', roles: ['admin'] },
      };
      const res = mockRes();

      await studentAffairsController.reviewReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Note is required when rejecting a receipt' })
      );
    });

    it('returns 404 when the receipt does not exist', async () => {
      const req = {
        params: { id: 'rec-1' },
        body: { decision: 'accepted' },
        user: { id: 'admin-1', roles: ['admin'] },
      };
      const res = mockRes();

      prisma.studentFeeReceipt.findUnique.mockResolvedValue(null);

      await studentAffairsController.reviewReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects a society review when the receipt is not pending', async () => {
      const req = {
        params: { id: 'rec-1' },
        body: { decision: 'accepted' },
        user: { id: 'soc-1', roles: ['society'] },
      };
      const res = mockRes();

      prisma.studentFeeReceipt.findUnique.mockResolvedValue({ id: 'rec-1', status: 'accepted', payment: {} });

      await studentAffairsController.reviewReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Only pending receipts can be reviewed by society' })
      );
    });

    it('lets society approve a pending receipt (stays pending for admin)', async () => {
      const req = {
        params: { id: 'rec-1' },
        body: { decision: 'accepted' },
        user: { id: 'soc-1', roles: ['society'] },
      };
      const res = mockRes();

      prisma.studentFeeReceipt.findUnique.mockResolvedValue({ id: 'rec-1', status: 'pending', payment: {} });
      const updated = { id: 'rec-1', status: 'pending', reviewedById: 'soc-1' };
      prisma.studentFeeReceipt.update.mockResolvedValue(updated);

      await studentAffairsController.reviewReceipt(req, res);

      expect(prisma.studentFeeReceipt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rec-1' },
          data: expect.objectContaining({ reviewedById: 'soc-1', reviewedAt: expect.any(Date) }),
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, receipt: updated })
      );
    });

    it('lets society reject a pending receipt with a note', async () => {
      const req = {
        params: { id: 'rec-1' },
        body: { decision: 'rejected', adminNote: 'bad receipt' },
        user: { id: 'soc-1', roles: ['society'] },
      };
      const res = mockRes();

      prisma.studentFeeReceipt.findUnique.mockResolvedValue({ id: 'rec-1', status: 'pending', payment: {} });
      const updated = { id: 'rec-1', status: 'rejected' };
      prisma.studentFeeReceipt.update.mockResolvedValue(updated);

      await studentAffairsController.reviewReceipt(req, res);

      expect(prisma.studentFeeReceipt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'rejected', adminNote: 'bad receipt' }),
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Receipt rejected by society' })
      );
    });

    it('rejects an admin review when the receipt is already rejected', async () => {
      const req = {
        params: { id: 'rec-1' },
        body: { decision: 'accepted' },
        user: { id: 'admin-1', roles: ['admin'] },
      };
      const res = mockRes();

      prisma.studentFeeReceipt.findUnique.mockResolvedValue({ id: 'rec-1', status: 'rejected', payment: {} });

      await studentAffairsController.reviewReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Only pending or accepted receipts can be reviewed by admin' })
      );
    });

    it('returns 409 when admin accepts but a paid duplicate already exists', async () => {
      const req = {
        params: { id: 'rec-1' },
        body: { decision: 'accepted' },
        user: { id: 'admin-1', roles: ['admin'] },
      };
      const res = mockRes();

      prisma.studentFeeReceipt.findUnique.mockResolvedValue({
        id: 'rec-1',
        status: 'pending',
        studentId: 'student-1',
        paymentId: 'pay-1',
        payment: { semester: '1st', session: '2024-25' },
      });
      prisma.studentFeePayment.findFirst.mockResolvedValue({ id: 'other-pay' });

      await studentAffairsController.reviewReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('lets admin accept a receipt, marking the payment paid', async () => {
      const req = {
        params: { id: 'rec-1' },
        body: { decision: 'accepted', adminNote: 'looks good' },
        user: { id: 'admin-1', roles: ['admin'] },
      };
      const res = mockRes();

      prisma.studentFeeReceipt.findUnique.mockResolvedValue({
        id: 'rec-1',
        status: 'pending',
        studentId: 'student-1',
        paymentId: 'pay-1',
        payment: { semester: '1st', session: '2024-25' },
      });
      prisma.studentFeePayment.findFirst.mockResolvedValue(null);
      const updatedReceipt = { id: 'rec-1', status: 'accepted', paymentId: 'pay-1', payment: { reference: 'REF' } };
      tx.studentFeeReceipt.update.mockResolvedValue(updatedReceipt);

      await studentAffairsController.reviewReceipt(req, res);

      expect(tx.studentFeePayment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: {
          status: 'paid',
          verifiedById: 'admin-1',
          verifiedAt: expect.any(Date),
        },
      });
      expect(tx.studentFeeReceipt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rec-1' },
          data: expect.objectContaining({ status: 'accepted', adminNote: 'looks good' }),
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Receipt accepted by admin', receipt: updatedReceipt })
      );
    });

    it('lets admin reject a previously accepted receipt', async () => {
      const req = {
        params: { id: 'rec-1' },
        body: { decision: 'rejected', adminNote: 'invalid proof' },
        user: { id: 'admin-1', roles: ['admin'] },
      };
      const res = mockRes();

      prisma.studentFeeReceipt.findUnique.mockResolvedValue({
        id: 'rec-1',
        status: 'accepted',
        studentId: 'student-1',
        paymentId: 'pay-1',
        payment: { semester: '1st', session: '2024-25' },
      });
      const updatedReceipt = { id: 'rec-1', status: 'rejected' };
      tx.studentFeeReceipt.update.mockResolvedValue(updatedReceipt);

      await studentAffairsController.reviewReceipt(req, res);

      expect(tx.studentFeePayment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: {
          status: 'pending',
          verifiedById: null,
          verifiedAt: null,
        },
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Receipt rejected by admin' })
      );
    });
  });

  describe('forwardReceiptToAdmin', () => {
    it('rejects non-society users', async () => {
      const req = { params: { id: 'rec-1' }, body: { note: 'fwd' }, user: { id: 'u1', roles: ['admin'] } };
      const res = mockRes();

      await studentAffairsController.forwardReceiptToAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('requires a note', async () => {
      const req = { params: { id: 'rec-1' }, body: {}, user: { id: 'soc-1', roles: ['society'] } };
      const res = mockRes();

      await studentAffairsController.forwardReceiptToAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Note is required before forwarding to admin' })
      );
    });

    it('returns 404 when the receipt does not exist', async () => {
      const req = { params: { id: 'rec-1' }, body: { note: 'fwd' }, user: { id: 'soc-1', roles: ['society'] } };
      const res = mockRes();

      prisma.studentFeeReceipt.findUnique.mockResolvedValue(null);

      await studentAffairsController.forwardReceiptToAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects forwarding a receipt that is not pending', async () => {
      const req = { params: { id: 'rec-1' }, body: { note: 'fwd' }, user: { id: 'soc-1', roles: ['society'] } };
      const res = mockRes();

      prisma.studentFeeReceipt.findUnique.mockResolvedValue({ id: 'rec-1', status: 'accepted', reviewedById: 'soc-1' });

      await studentAffairsController.forwardReceiptToAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Receipt must be in pending status to be forwarded to admin' })
      );
    });

    it('rejects forwarding a receipt not yet reviewed by society', async () => {
      const req = { params: { id: 'rec-1' }, body: { note: 'fwd' }, user: { id: 'soc-1', roles: ['society'] } };
      const res = mockRes();

      prisma.studentFeeReceipt.findUnique.mockResolvedValue({ id: 'rec-1', status: 'pending', reviewedById: null });

      await studentAffairsController.forwardReceiptToAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Receipt must be approved by society before forwarding to admin' })
      );
    });

    it('forwards a reviewed pending receipt to admin', async () => {
      const req = {
        params: { id: 'rec-1' },
        body: { note: '  please check  ' },
        user: { id: 'soc-1', roles: ['society'], name: 'Soc Member' },
      };
      const res = mockRes();

      prisma.studentFeeReceipt.findUnique.mockResolvedValue({
        id: 'rec-1',
        status: 'pending',
        reviewedById: 'soc-1',
        payment: { reference: 'REF' },
      });
      const updated = { id: 'rec-1', forwardedToAdmin: true };
      prisma.studentFeeReceipt.update.mockResolvedValue(updated);

      await studentAffairsController.forwardReceiptToAdmin(req, res);

      expect(prisma.studentFeeReceipt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rec-1' },
          data: expect.objectContaining({
            adminNote: 'please check',
            forwardedToAdmin: true,
            forwardedById: 'soc-1',
          }),
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, receipt: updated })
      );
    });
  });

  describe('markFeePaymentPaid', () => {
    const validBody = {
      studentId: 'student-1',
      semester: '1st',
      session: '2024-25',
      amount: 500,
      paymentDate: '2024-01-15',
      reference: 'REF-1',
      notes: 'note',
    };

    it('rejects non-admin users', async () => {
      const req = { user: { id: 'u1', roles: ['society'] }, body: validBody };
      const res = mockRes();

      await studentAffairsController.markFeePaymentPaid(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('rejects when required fields are missing', async () => {
      const req = { user: { id: 'admin-1', roles: ['admin'] }, body: { studentId: 'student-1' } };
      const res = mockRes();

      await studentAffairsController.markFeePaymentPaid(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('are required') })
      );
    });

    it('rejects an invalid payment date', async () => {
      const req = {
        user: { id: 'admin-1', roles: ['admin'] },
        body: { ...validBody, paymentDate: 'not-a-date' },
      };
      const res = mockRes();

      await studentAffairsController.markFeePaymentPaid(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid payment date' })
      );
    });

    it('returns 404 when the student does not exist', async () => {
      const req = { user: { id: 'admin-1', roles: ['admin'] }, body: validBody };
      const res = mockRes();

      prisma.user.findFirst.mockResolvedValue(null);

      await studentAffairsController.markFeePaymentPaid(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 409 when a paid record already exists', async () => {
      const req = { user: { id: 'admin-1', roles: ['admin'] }, body: validBody };
      const res = mockRes();

      prisma.user.findFirst.mockResolvedValue({ id: 'student-1', name: 'Stu', studentId: '20230001' });
      prisma.studentFeePayment.findFirst.mockResolvedValue({ id: 'existing-paid' });

      await studentAffairsController.markFeePaymentPaid(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates a new paid payment when no pending record exists', async () => {
      const req = { user: { id: 'admin-1', roles: ['admin'] }, body: validBody };
      const res = mockRes();

      prisma.user.findFirst.mockResolvedValue({ id: 'student-1', name: 'Stu', studentId: '20230001' });
      prisma.studentFeePayment.findFirst.mockResolvedValue(null);
      tx.studentFeePayment.findFirst.mockResolvedValue(null);
      const created = { id: 'pay-new', status: 'paid' };
      tx.studentFeePayment.create.mockResolvedValue(created);

      await studentAffairsController.markFeePaymentPaid(req, res);

      expect(tx.studentFeePayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            studentId: 'student-1',
            semester: '1st',
            session: '2024-25',
            amount: 500,
            status: 'paid',
            verifiedById: 'admin-1',
            reference: 'REF-1',
          }),
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, payment: created })
      );
    });

    it('updates an existing pending payment to paid when one exists', async () => {
      const req = { user: { id: 'admin-1', roles: ['admin'] }, body: validBody };
      const res = mockRes();

      prisma.user.findFirst.mockResolvedValue({ id: 'student-1', name: 'Stu', studentId: '20230001' });
      prisma.studentFeePayment.findFirst.mockResolvedValue(null);
      const pendingPayment = { id: 'pending-1', reference: 'OLD-REF', notes: 'old note' };
      tx.studentFeePayment.findFirst.mockResolvedValue(pendingPayment);
      const updated = { id: 'pending-1', status: 'paid' };
      tx.studentFeePayment.update.mockResolvedValue(updated);

      await studentAffairsController.markFeePaymentPaid(req, res);

      expect(tx.studentFeePayment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pending-1' },
          data: expect.objectContaining({ status: 'paid', verifiedById: 'admin-1' }),
        })
      );
      expect(tx.studentFeePayment.create).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, payment: updated })
      );
    });
  });

  describe('getFeeStatusSummary', () => {
    it('rejects users who are neither admin nor society', async () => {
      const req = { user: { id: 'u1', roles: ['student'] } };
      const res = mockRes();

      await studentAffairsController.getFeeStatusSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('aggregates paid/unpaid counts per admission session', async () => {
      const req = { user: { id: 'admin-1', roles: ['admin'] } };
      const res = mockRes();

      prisma.user.findMany.mockResolvedValue([
        { id: 'stu1', studentId: '20230001' }, // batch 2023 -> '4th', session '2023-24'
        { id: 'stu2', studentId: '20240001' }, // batch 2024 -> '3rd', session '2024-25'
        { id: 'stu3', studentId: 'no-batch' }, // no recognizable batch year -> skipped
      ]);
      prisma.studentFeePayment.findMany.mockResolvedValue([
        { studentId: 'stu1', semester: '4th' },
      ]);

      await studentAffairsController.getFeeStatusSummary(req, res);

      expect(prisma.studentFeePayment.findMany).toHaveBeenCalledWith({
        where: {
          status: 'paid',
          OR: [
            { studentId: 'stu1', semester: '4th' },
            { studentId: 'stu2', semester: '3rd' },
          ],
        },
        select: { studentId: true, semester: true },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        overall: { paidCount: 1, unpaidCount: 1, total: 2 },
        bySession: [
          expect.objectContaining({ session: '2023-24', paidCount: 1, unpaidCount: 0, total: 1, paidPercentage: 100 }),
          expect.objectContaining({ session: '2024-25', paidCount: 0, unpaidCount: 1, total: 1, paidPercentage: 0 }),
        ],
      });
    });
  });
});
