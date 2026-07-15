jest.mock('../../config/prisma', () => ({
  voucher: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  event: {
    findUnique: jest.fn(),
  },
  societyApplication: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
}));

const prisma = require('../../config/prisma');
const voucherController = require('../../controllers/voucherController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const adminUser = { id: 'admin-1', roles: ['admin'] };
const societyUser = { id: 'society-1', roles: ['society'] };
const studentUser = { id: 'student-1', roles: ['student'] };

describe('controllers/voucherController', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('downloadVoucherSummaryExcel', () => {
    it('rejects users who are neither admin nor society', async () => {
      const req = { user: studentUser, query: {} };
      const res = mockRes();

      await voucherController.downloadVoucherSummaryExcel(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Not authorized to download voucher summaries' })
      );
      expect(prisma.voucher.findMany).not.toHaveBeenCalled();
    });

    it('returns 404 when no vouchers match the criteria', async () => {
      const req = { user: adminUser, query: { eventId: 'e1' } };
      const res = mockRes();

      prisma.voucher.findMany.mockResolvedValue([]);

      await voucherController.downloadVoucherSummaryExcel(req, res);

      expect(prisma.voucher.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { eventId: 'e1' } })
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'No vouchers found for the specified criteria' })
      );
    });
  });

  describe('createVoucher', () => {
    const validBody = {
      title: 'Catering',
      description: 'Food for event',
      eventId: 'event-1',
      amount: 500,
      receiptFileUrl: '/uploads/receipts/receipt.pdf',
      receiptFileName: 'receipt.pdf',
      receiptMimeType: 'application/pdf',
    };

    it('rejects users who are neither admin nor society', async () => {
      const req = { user: studentUser, body: validBody };
      const res = mockRes();

      await voucherController.createVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Only admin and society members can create vouchers' })
      );
      expect(prisma.voucher.create).not.toHaveBeenCalled();
    });

    it('rejects when required fields are missing', async () => {
      const req = { user: societyUser, body: { title: '', eventId: '', amount: null } };
      const res = mockRes();

      await voucherController.createVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'title, eventId, amount, receiptFileUrl, receiptFileName and receiptMimeType are required',
        })
      );
    });

    it('rejects an unsupported receipt mime type', async () => {
      const req = {
        user: societyUser,
        body: { ...validBody, receiptMimeType: 'application/zip' },
      };
      const res = mockRes();

      await voucherController.createVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Unsupported receipt file type. Allowed: PDF, JPG, PNG' })
      );
    });

    it('rejects a receipt URL not from uploaded receipts storage', async () => {
      const req = {
        user: societyUser,
        body: { ...validBody, receiptFileUrl: '/uploads/other/receipt.pdf' },
      };
      const res = mockRes();

      await voucherController.createVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Receipt URL must be from uploaded receipts storage' })
      );
    });

    it('returns 404 when the event does not exist', async () => {
      const req = { user: societyUser, body: validBody };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(null);

      await voucherController.createVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Event not found' })
      );
      expect(prisma.voucher.create).not.toHaveBeenCalled();
    });

    it('returns 400 when the linked budget application is not found', async () => {
      const req = {
        user: societyUser,
        body: { ...validBody, budgetApplicationId: 'budget-1' },
      };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({ id: 'event-1', title: 'Event 1' });
      prisma.societyApplication.findUnique.mockResolvedValue(null);

      await voucherController.createVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Linked budget application not found' })
      );
      expect(prisma.voucher.create).not.toHaveBeenCalled();
    });

    it('creates a voucher in draft status on success', async () => {
      const req = { user: societyUser, body: validBody };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({ id: 'event-1', title: 'Event 1' });
      prisma.voucher.create.mockResolvedValue({
        id: 'voucher-1',
        ...validBody,
        status: 'draft',
        createdById: 'society-1',
      });

      await voucherController.createVoucher(req, res);

      expect(prisma.voucher.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Catering',
          amount: 500,
          eventId: 'event-1',
          budgetApplicationId: null,
          status: 'draft',
          createdById: 'society-1',
        }),
        include: expect.any(Object),
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Voucher created successfully' })
      );
    });
  });

  describe('getVouchers', () => {
    it('rejects users who are neither admin nor society', async () => {
      const req = { user: studentUser, query: {} };
      const res = mockRes();

      await voucherController.getVouchers(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.voucher.findMany).not.toHaveBeenCalled();
    });

    it('returns 400 for an invalid fromDate', async () => {
      const req = { user: adminUser, query: { fromDate: 'not-a-date' } };
      const res = mockRes();

      await voucherController.getVouchers(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid fromDate' })
      );
    });

    it('returns 400 for an invalid toDate', async () => {
      const req = { user: adminUser, query: { toDate: 'not-a-date' } };
      const res = mockRes();

      await voucherController.getVouchers(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid toDate' })
      );
    });

    it('applies filters for an admin including createdById', async () => {
      const req = {
        user: adminUser,
        query: { status: 'submitted', eventId: 'event-1', createdById: 'society-1' },
      };
      const res = mockRes();

      prisma.voucher.findMany.mockResolvedValue([{ id: 'voucher-1' }]);

      await voucherController.getVouchers(req, res);

      expect(prisma.voucher.findMany).toHaveBeenCalledWith({
        where: { status: 'submitted', eventId: 'event-1', createdById: 'society-1' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
      expect(res.json).toHaveBeenCalledWith({ success: true, vouchers: [{ id: 'voucher-1' }] });
    });

    it('ignores createdById filter for a society user', async () => {
      const req = { user: societyUser, query: { createdById: 'someone-else' } };
      const res = mockRes();

      prisma.voucher.findMany.mockResolvedValue([]);

      await voucherController.getVouchers(req, res);

      expect(prisma.voucher.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} })
      );
    });
  });

  describe('getVoucherById', () => {
    it('returns 404 when the voucher does not exist', async () => {
      const req = { params: { id: 'voucher-1' }, user: adminUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue(null);

      await voucherController.getVoucherById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Voucher not found' })
      );
    });

    it('rejects users who are neither admin nor society', async () => {
      const req = { params: { id: 'voucher-1' }, user: studentUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'draft' });

      await voucherController.getVoucherById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Not authorized to view this voucher' })
      );
    });

    it('returns the voucher on success', async () => {
      const req = { params: { id: 'voucher-1' }, user: adminUser };
      const res = mockRes();

      const voucher = { id: 'voucher-1', status: 'draft' };
      prisma.voucher.findUnique.mockResolvedValue(voucher);

      await voucherController.getVoucherById(req, res);

      expect(res.json).toHaveBeenCalledWith({ success: true, voucher });
    });
  });

  describe('updateVoucher', () => {
    it('returns 404 when the voucher does not exist', async () => {
      const req = { params: { id: 'voucher-1' }, body: {}, user: societyUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue(null);

      await voucherController.updateVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prisma.voucher.update).not.toHaveBeenCalled();
    });

    it('rejects a society member updating a voucher that is not draft/submitted', async () => {
      const req = { params: { id: 'voucher-1' }, body: { title: 'New title' }, user: societyUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'approved', eventId: 'event-1' });

      await voucherController.updateVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Not authorized to update this voucher in its current state' })
      );
      expect(prisma.voucher.update).not.toHaveBeenCalled();
    });

    it('rejects an empty title', async () => {
      const req = { params: { id: 'voucher-1' }, body: { title: '   ' }, user: societyUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'draft', eventId: 'event-1' });

      await voucherController.updateVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'title cannot be empty' })
      );
    });

    it('rejects a non-positive amount', async () => {
      const req = { params: { id: 'voucher-1' }, body: { amount: -5 }, user: societyUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'draft', eventId: 'event-1' });

      await voucherController.updateVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'amount must be a positive number' })
      );
    });

    it('rejects an empty eventId', async () => {
      const req = { params: { id: 'voucher-1' }, body: { eventId: '   ' }, user: societyUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'draft', eventId: 'event-1' });

      await voucherController.updateVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'eventId cannot be empty' })
      );
    });

    it('returns 404 when updating to a non-existent event', async () => {
      const req = { params: { id: 'voucher-1' }, body: { eventId: 'event-2' }, user: societyUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'draft', eventId: 'event-1' });
      prisma.event.findUnique.mockResolvedValue(null);

      await voucherController.updateVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Event not found' })
      );
    });

    it('rejects incomplete receipt fields', async () => {
      const req = {
        params: { id: 'voucher-1' },
        body: { receiptFileUrl: '/uploads/receipts/new.pdf' },
        user: societyUser,
      };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'draft', eventId: 'event-1' });

      await voucherController.updateVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'receiptFileUrl, receiptFileName and receiptMimeType are required together' })
      );
    });

    it('rejects an unsupported receipt mime type on update', async () => {
      const req = {
        params: { id: 'voucher-1' },
        body: {
          receiptFileUrl: '/uploads/receipts/new.zip',
          receiptFileName: 'new.zip',
          receiptMimeType: 'application/zip',
        },
        user: societyUser,
      };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'draft', eventId: 'event-1' });

      await voucherController.updateVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Unsupported receipt file type. Allowed: PDF, JPG, PNG' })
      );
    });

    it('rejects a receipt URL not from uploads storage on update', async () => {
      const req = {
        params: { id: 'voucher-1' },
        body: {
          receiptFileUrl: '/uploads/other/new.pdf',
          receiptFileName: 'new.pdf',
          receiptMimeType: 'application/pdf',
        },
        user: societyUser,
      };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'draft', eventId: 'event-1' });

      await voucherController.updateVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Receipt URL must be from uploaded receipts storage' })
      );
    });

    it('returns 400 when the new budget application link is invalid', async () => {
      const req = {
        params: { id: 'voucher-1' },
        body: { budgetApplicationId: 'budget-1' },
        user: societyUser,
      };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'draft', eventId: 'event-1' });
      prisma.societyApplication.findUnique.mockResolvedValue(null);

      await voucherController.updateVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Linked budget application not found' })
      );
    });

    it('updates a draft voucher and returns the updated record', async () => {
      const req = {
        params: { id: 'voucher-1' },
        body: { title: 'Updated title', amount: 750 },
        user: societyUser,
      };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'draft', eventId: 'event-1', budgetApplicationId: null });
      prisma.voucher.update.mockResolvedValue({ id: 'voucher-1', title: 'Updated title', amount: 750 });

      await voucherController.updateVoucher(req, res);

      expect(prisma.voucher.update).toHaveBeenCalledWith({
        where: { id: 'voucher-1' },
        data: { title: 'Updated title', amount: 750 },
        include: expect.any(Object),
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Voucher updated successfully' })
      );
    });

    it('allows an admin to update a voucher regardless of status', async () => {
      const req = {
        params: { id: 'voucher-1' },
        body: { title: 'Admin edit' },
        user: adminUser,
      };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'approved', eventId: 'event-1', budgetApplicationId: null });
      prisma.voucher.update.mockResolvedValue({ id: 'voucher-1', title: 'Admin edit' });

      await voucherController.updateVoucher(req, res);

      expect(prisma.voucher.update).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(403);
    });
  });

  describe('deleteVoucher', () => {
    it('returns 404 when the voucher does not exist', async () => {
      const req = { params: { id: 'voucher-1' }, user: societyUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue(null);

      await voucherController.deleteVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prisma.voucher.delete).not.toHaveBeenCalled();
    });

    it('rejects deleting a voucher that is not draft/submitted for society users', async () => {
      const req = { params: { id: 'voucher-1' }, user: societyUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'under_review' });

      await voucherController.deleteVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.voucher.delete).not.toHaveBeenCalled();
    });

    it('deletes a draft voucher successfully', async () => {
      const req = { params: { id: 'voucher-1' }, user: societyUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'draft' });
      prisma.voucher.delete.mockResolvedValue({ id: 'voucher-1' });

      await voucherController.deleteVoucher(req, res);

      expect(prisma.voucher.delete).toHaveBeenCalledWith({ where: { id: 'voucher-1' } });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Voucher deleted successfully' })
      );
    });
  });

  describe('submitVoucher', () => {
    it('returns 404 when the voucher does not exist', async () => {
      const req = { params: { id: 'voucher-1' }, user: societyUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue(null);

      await voucherController.submitVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects users who are neither admin nor society', async () => {
      const req = { params: { id: 'voucher-1' }, user: studentUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'draft' });

      await voucherController.submitVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('rejects submitting a voucher that is not in draft status', async () => {
      const req = { params: { id: 'voucher-1' }, user: societyUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'submitted' });

      await voucherController.submitVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Only draft vouchers can be submitted' })
      );
      expect(prisma.voucher.update).not.toHaveBeenCalled();
    });

    it('submits a draft voucher successfully', async () => {
      const req = { params: { id: 'voucher-1' }, user: societyUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'draft' });
      prisma.voucher.update.mockResolvedValue({ id: 'voucher-1', status: 'submitted' });

      await voucherController.submitVoucher(req, res);

      expect(prisma.voucher.update).toHaveBeenCalledWith({
        where: { id: 'voucher-1' },
        data: { status: 'submitted' },
        include: expect.any(Object),
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Voucher submitted successfully' })
      );
    });
  });

  describe('forwardVoucher', () => {
    it('returns 404 when the voucher does not exist', async () => {
      const req = { params: { id: 'voucher-1' }, user: adminUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue(null);

      await voucherController.forwardVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects users who are neither admin nor society', async () => {
      const req = { params: { id: 'voucher-1' }, user: studentUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'submitted' });

      await voucherController.forwardVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('rejects forwarding a voucher that is not submitted', async () => {
      const req = { params: { id: 'voucher-1' }, user: adminUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'draft' });

      await voucherController.forwardVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Only submitted vouchers can be forwarded to review' })
      );
    });

    it('forwards a submitted voucher to under_review', async () => {
      const req = { params: { id: 'voucher-1' }, user: adminUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'submitted' });
      prisma.voucher.update.mockResolvedValue({ id: 'voucher-1', status: 'under_review' });

      await voucherController.forwardVoucher(req, res);

      expect(prisma.voucher.update).toHaveBeenCalledWith({
        where: { id: 'voucher-1' },
        data: { status: 'under_review' },
        include: expect.any(Object),
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Voucher moved to review queue' })
      );
    });
  });

  describe('approveVoucher', () => {
    it('rejects non-admin users', async () => {
      const req = { params: { id: 'voucher-1' }, body: {}, user: societyUser };
      const res = mockRes();

      await voucherController.approveVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.voucher.findUnique).not.toHaveBeenCalled();
    });

    it('returns 404 when the voucher does not exist', async () => {
      const req = { params: { id: 'voucher-1' }, body: {}, user: adminUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue(null);

      await voucherController.approveVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects approving a voucher that is not submitted/under_review', async () => {
      const req = { params: { id: 'voucher-1' }, body: {}, user: adminUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'draft' });

      await voucherController.approveVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Only submitted or under-review vouchers can be approved' })
      );
    });

    it('approves an under_review voucher and records the reviewer', async () => {
      const req = {
        params: { id: 'voucher-1' },
        body: { adminDecisionNote: 'Looks good' },
        user: adminUser,
      };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'under_review' });
      prisma.voucher.update.mockResolvedValue({ id: 'voucher-1', status: 'approved' });

      await voucherController.approveVoucher(req, res);

      expect(prisma.voucher.update).toHaveBeenCalledWith({
        where: { id: 'voucher-1' },
        data: {
          status: 'approved',
          reviewedById: 'admin-1',
          reviewedAt: expect.any(Date),
          adminDecisionNote: 'Looks good',
        },
        include: expect.any(Object),
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Voucher approved' })
      );
    });
  });

  describe('rejectVoucher', () => {
    it('rejects non-admin users', async () => {
      const req = { params: { id: 'voucher-1' }, body: { adminDecisionNote: 'no' }, user: societyUser };
      const res = mockRes();

      await voucherController.rejectVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.voucher.findUnique).not.toHaveBeenCalled();
    });

    it('requires an adminDecisionNote', async () => {
      const req = { params: { id: 'voucher-1' }, body: {}, user: adminUser };
      const res = mockRes();

      await voucherController.rejectVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'adminDecisionNote is required for rejection' })
      );
      expect(prisma.voucher.findUnique).not.toHaveBeenCalled();
    });

    it('returns 404 when the voucher does not exist', async () => {
      const req = { params: { id: 'voucher-1' }, body: { adminDecisionNote: 'no' }, user: adminUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue(null);

      await voucherController.rejectVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects rejecting a voucher that is not submitted/under_review', async () => {
      const req = { params: { id: 'voucher-1' }, body: { adminDecisionNote: 'no' }, user: adminUser };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'approved' });

      await voucherController.rejectVoucher(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Only submitted or under-review vouchers can be rejected' })
      );
    });

    it('rejects a submitted voucher and records the reviewer', async () => {
      const req = {
        params: { id: 'voucher-1' },
        body: { adminDecisionNote: 'Missing receipt details' },
        user: adminUser,
      };
      const res = mockRes();

      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'submitted' });
      prisma.voucher.update.mockResolvedValue({ id: 'voucher-1', status: 'rejected' });

      await voucherController.rejectVoucher(req, res);

      expect(prisma.voucher.update).toHaveBeenCalledWith({
        where: { id: 'voucher-1' },
        data: {
          status: 'rejected',
          reviewedById: 'admin-1',
          reviewedAt: expect.any(Date),
          adminDecisionNote: 'Missing receipt details',
        },
        include: expect.any(Object),
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Voucher rejected' })
      );
    });
  });

  describe('getVoucherSummary', () => {
    it('rejects users who are neither admin nor society', async () => {
      const req = { user: studentUser, query: {} };
      const res = mockRes();

      await voucherController.getVoucherSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.voucher.findMany).not.toHaveBeenCalled();
    });

    it('returns an empty summary when there are no vouchers', async () => {
      const req = { user: adminUser, query: {} };
      const res = mockRes();

      prisma.voucher.findMany.mockResolvedValue([]);

      await voucherController.getVoucherSummary(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        summary: {
          totals: {
            vouchers: 0,
            totalBudget: 0,
            totalExpenses: 0,
            pendingExpenses: 0,
            remainingBudget: 0,
            utilizationPercent: 0,
          },
          events: [],
        },
      });
    });

    it('aggregates approved and pending expenses per event with linked budget totals', async () => {
      const req = { user: adminUser, query: {} };
      const res = mockRes();

      prisma.voucher.findMany.mockResolvedValue([
        {
          id: 'v1',
          amount: 200,
          status: 'approved',
          eventId: 'event-1',
          budgetApplicationId: 'budget-1',
          event: { id: 'event-1', title: 'Event 1', eventDate: new Date('2026-01-01') },
        },
        {
          id: 'v2',
          amount: 100,
          status: 'submitted',
          eventId: 'event-1',
          budgetApplicationId: 'budget-1',
          event: { id: 'event-1', title: 'Event 1', eventDate: new Date('2026-01-01') },
        },
      ]);
      prisma.societyApplication.findMany
        .mockResolvedValueOnce([
          { id: 'budget-1', status: 'approved', content: { totalAmount: 1000, eventId: 'event-1' } },
        ])
        .mockResolvedValueOnce([
          { id: 'budget-1', status: 'approved', createdAt: new Date(), content: { totalAmount: 1000, eventId: 'event-1' } },
        ]);

      await voucherController.getVoucherSummary(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        summary: {
          totals: {
            vouchers: 2,
            totalBudget: 1000,
            totalExpenses: 200,
            pendingExpenses: 100,
            remainingBudget: 800,
            utilizationPercent: 20,
          },
          events: [
            expect.objectContaining({
              eventId: 'event-1',
              eventTitle: 'Event 1',
              voucherCount: 2,
              totalBudget: 1000,
              totalExpenses: 200,
              pendingExpenses: 100,
              remainingBudget: 800,
              utilizationPercent: 20,
            }),
          ],
        },
      });
    });
  });
});
