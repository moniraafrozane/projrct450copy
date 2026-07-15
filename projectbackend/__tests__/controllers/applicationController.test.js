jest.mock('../../config/prisma', () => ({
  event: {
    findUnique: jest.fn(),
  },
  societyApplication: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}));
jest.mock('../../controllers/auditLogController', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

const prisma = require('../../config/prisma');
const { createAuditLog } = require('../../controllers/auditLogController');
const applicationController = require('../../controllers/applicationController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('controllers/applicationController', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('createBudgetBreakdown', () => {
    const validSections = [{ title: 'Venue', amount: 1000 }];

    it('rejects non-society users', async () => {
      const req = { user: { roles: ['student'] }, body: {} };
      const res = mockRes();

      await applicationController.createBudgetBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Only society members can create budget breakdowns' })
      );
      expect(prisma.societyApplication.create).not.toHaveBeenCalled();
    });

    it('rejects when eventId is missing', async () => {
      const req = { user: { roles: ['society'] }, body: { sections: validSections, calculatedTotal: 1000, totalAmount: 1000 } };
      const res = mockRes();

      await applicationController.createBudgetBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'eventId is required' })
      );
    });

    it('rejects invalid budget sections', async () => {
      const req = {
        user: { roles: ['society'] },
        body: { eventId: 'e1', sections: [], calculatedTotal: 1000, totalAmount: 1000 },
      };
      const res = mockRes();

      await applicationController.createBudgetBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'At least one budget section is required' })
      );
    });

    it('rejects a negative calculatedTotal', async () => {
      const req = {
        user: { roles: ['society'] },
        body: { eventId: 'e1', sections: validSections, calculatedTotal: -5, totalAmount: 1000 },
      };
      const res = mockRes();

      await applicationController.createBudgetBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'calculatedTotal must be a non-negative number' })
      );
    });

    it('rejects a zero or invalid totalAmount', async () => {
      const req = {
        user: { roles: ['society'] },
        body: { eventId: 'e1', sections: validSections, calculatedTotal: 1000, totalAmount: 0 },
      };
      const res = mockRes();

      await applicationController.createBudgetBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'totalAmount must be greater than 0' })
      );
    });

    it('rejects an invalid overrideAmount when provided', async () => {
      const req = {
        user: { roles: ['society'] },
        body: { eventId: 'e1', sections: validSections, calculatedTotal: 1000, totalAmount: 1000, overrideAmount: -1 },
      };
      const res = mockRes();

      await applicationController.createBudgetBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'overrideAmount must be greater than 0 when provided' })
      );
    });

    it('returns 404 when the event does not exist', async () => {
      const req = {
        user: { roles: ['society'] },
        body: { eventId: 'e1', sections: validSections, calculatedTotal: 1000, totalAmount: 1000 },
      };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(null);

      await applicationController.createBudgetBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Event not found' })
      );
    });

    it('rejects when the event is not upcoming', async () => {
      const req = {
        user: { roles: ['society'] },
        body: { eventId: 'e1', sections: validSections, calculatedTotal: 1000, totalAmount: 1000 },
      };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({
        id: 'e1',
        title: 'Old Event',
        eventDate: new Date('2000-01-01'),
        startTime: '10:00',
        venue: 'Hall',
        organizerName: 'Org',
      });

      await applicationController.createBudgetBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Budget breakdown can only be created for upcoming events' })
      );
    });

    it('creates a budget breakdown draft on success', async () => {
      const req = {
        user: { roles: ['society'], id: 'u1', name: 'Society User' },
        body: { eventId: 'e1', sections: validSections, calculatedTotal: 1000, totalAmount: 1000, overrideAmount: null },
      };
      const res = mockRes();

      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
      prisma.event.findUnique.mockResolvedValue({
        id: 'e1',
        title: 'Future Event',
        eventDate: futureDate,
        startTime: '10:00',
        venue: 'Hall',
        organizerName: 'Org',
      });
      prisma.societyApplication.create.mockResolvedValue({ id: 'app-1', type: 'budget_breakdown', status: 'draft' });

      await applicationController.createBudgetBreakdown(req, res);

      expect(prisma.societyApplication.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'budget_breakdown',
          createdById: 'u1',
          createdByName: 'Society User',
          status: 'draft',
          content: expect.objectContaining({
            eventId: 'e1',
            eventTitle: 'Future Event',
            sections: validSections,
            calculatedTotal: 1000,
            totalAmount: 1000,
          }),
        }),
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, application: { id: 'app-1', type: 'budget_breakdown', status: 'draft' } })
      );
    });
  });

  describe('getBudgetBreakdowns', () => {
    it('rejects users who are neither society nor admin', async () => {
      const req = { user: { roles: ['student'] } };
      const res = mockRes();

      await applicationController.getBudgetBreakdowns(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.societyApplication.findMany).not.toHaveBeenCalled();
    });

    it('returns only applications that have a sections array', async () => {
      const req = { user: { roles: ['admin'] } };
      const res = mockRes();

      prisma.societyApplication.findMany.mockResolvedValue([
        { id: 'a1', content: { sections: [{ title: 'X', amount: 1 }] } },
        { id: 'a2', content: { foo: 'bar' } },
        { id: 'a3', content: null },
      ]);

      await applicationController.getBudgetBreakdowns(req, res);

      expect(prisma.societyApplication.findMany).toHaveBeenCalledWith({
        where: { type: 'budget_breakdown' },
        orderBy: { createdAt: 'desc' },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        applications: [{ id: 'a1', content: { sections: [{ title: 'X', amount: 1 }] } }],
      });
    });
  });

  describe('createApplication', () => {
    it('rejects when type or subject is missing', async () => {
      const req = { user: { roles: ['society'] }, body: { type: '' } };
      const res = mockRes();

      await applicationController.createApplication(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Application type and subject are required' })
      );
    });

    it('rejects non-society users', async () => {
      const req = { user: { roles: ['admin'] }, body: { type: 'event_approval', subject: 'Subject' } };
      const res = mockRes();

      await applicationController.createApplication(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Only society members can create applications' })
      );
    });

    it('creates a draft application on success', async () => {
      const req = {
        user: { roles: ['society'], id: 'u1', name: 'Soc User' },
        body: { type: 'event_approval', subject: 'Subject', content: { eventTitle: 'Fest' } },
      };
      const res = mockRes();

      prisma.societyApplication.create.mockResolvedValue({ id: 'app-1', status: 'draft' });

      await applicationController.createApplication(req, res);

      expect(prisma.societyApplication.create).toHaveBeenCalledWith({
        data: {
          type: 'event_approval',
          subject: 'Subject',
          content: { eventTitle: 'Fest' },
          createdById: 'u1',
          createdByName: 'Soc User',
          status: 'draft',
        },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, application: { id: 'app-1', status: 'draft' } })
      );
    });
  });

  describe('getApplications', () => {
    it('rejects unauthorized users', async () => {
      const req = { user: { roles: ['student'] }, query: {} };
      const res = mockRes();

      await applicationController.getApplications(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('applies type and status filters from the query string', async () => {
      const req = { user: { roles: ['admin'] }, query: { type: 'event_approval', status: 'submitted' } };
      const res = mockRes();

      prisma.societyApplication.findMany.mockResolvedValue([{ id: 'a1' }]);

      await applicationController.getApplications(req, res);

      expect(prisma.societyApplication.findMany).toHaveBeenCalledWith({
        where: { type: 'event_approval', status: 'submitted' },
        orderBy: { createdAt: 'desc' },
      });
      expect(res.json).toHaveBeenCalledWith({ success: true, applications: [{ id: 'a1' }] });
    });
  });

  describe('forwardToAdmin', () => {
    it('returns 404 when the application does not exist', async () => {
      const req = { params: { id: 'a1' }, user: { roles: ['society'] } };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue(null);

      await applicationController.forwardToAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects unauthorized users', async () => {
      const req = { params: { id: 'a1' }, user: { roles: ['student'] } };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue({ id: 'a1', status: 'draft' });

      await applicationController.forwardToAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('rejects forwarding an application not in draft or submitted status', async () => {
      const req = { params: { id: 'a1' }, user: { roles: ['society'] } };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue({ id: 'a1', status: 'approved' });

      await applicationController.forwardToAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Applications can only be forwarded from draft or submitted status' })
      );
    });

    it('forwards a draft application to under_review', async () => {
      const req = { params: { id: 'a1' }, user: { roles: ['society'] } };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue({ id: 'a1', status: 'draft', forwardedAt: null });
      prisma.societyApplication.update.mockResolvedValue({ id: 'a1', status: 'under_review' });

      await applicationController.forwardToAdmin(req, res);

      expect(prisma.societyApplication.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { status: 'under_review', forwardedAt: expect.any(Date) },
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Budget forwarded to admin for review' })
      );
    });
  });

  describe('approveApplication', () => {
    it('returns 404 when the application does not exist', async () => {
      const req = { params: { id: 'a1' }, body: {}, user: { roles: ['admin'] } };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue(null);

      await applicationController.approveApplication(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects non-admin users', async () => {
      const req = { params: { id: 'a1' }, body: {}, user: { roles: ['society'] } };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue({ id: 'a1', status: 'submitted' });

      await applicationController.approveApplication(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Only admin can approve applications' })
      );
    });

    it('rejects approving an application that is not submitted or under review', async () => {
      const req = { params: { id: 'a1' }, body: {}, user: { roles: ['admin'] } };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue({ id: 'a1', status: 'draft' });

      await applicationController.approveApplication(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Only submitted or under review applications can be approved' })
      );
    });

    it('approves a submitted application and writes an audit log', async () => {
      const req = {
        params: { id: 'a1' },
        body: { adminNotes: '  looks good  ' },
        user: { roles: ['admin'], id: 'admin-1', email: 'admin@b.com', name: 'Admin' },
      };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue({ id: 'a1', status: 'submitted', societyId: 'soc-1' });
      prisma.societyApplication.update.mockResolvedValue({ id: 'a1', status: 'approved' });

      await applicationController.approveApplication(req, res);

      expect(prisma.societyApplication.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { status: 'approved', adminNotes: 'looks good' },
      });
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'application_approved', actorId: 'admin-1', newValue: 'approved' })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Application approved' })
      );
    });
  });

  describe('returnApplication', () => {
    it('rejects when adminNotes is missing', async () => {
      const req = { params: { id: 'a1' }, body: {}, user: { roles: ['admin'] } };
      const res = mockRes();

      await applicationController.returnApplication(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Admin note is required to return an application' })
      );
      expect(prisma.societyApplication.findUnique).not.toHaveBeenCalled();
    });

    it('returns 404 when the application does not exist', async () => {
      const req = { params: { id: 'a1' }, body: { adminNotes: 'fix this' }, user: { roles: ['admin'] } };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue(null);

      await applicationController.returnApplication(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects non-admin users', async () => {
      const req = { params: { id: 'a1' }, body: { adminNotes: 'fix this' }, user: { roles: ['society'] } };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue({ id: 'a1', status: 'submitted' });

      await applicationController.returnApplication(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('rejects returning an application that is not submitted or under review', async () => {
      const req = { params: { id: 'a1' }, body: { adminNotes: 'fix this' }, user: { roles: ['admin'] } };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue({ id: 'a1', status: 'approved' });

      await applicationController.returnApplication(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Only submitted or under review applications can be returned' })
      );
    });

    it('returns the application to the society member and writes an audit log', async () => {
      const req = {
        params: { id: 'a1' },
        body: { adminNotes: '  please revise  ' },
        user: { roles: ['admin'], id: 'admin-1', email: 'admin@b.com', name: 'Admin' },
      };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue({ id: 'a1', status: 'under_review', societyId: 'soc-1' });
      prisma.societyApplication.update.mockResolvedValue({ id: 'a1', status: 'returned' });

      await applicationController.returnApplication(req, res);

      expect(prisma.societyApplication.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { status: 'returned', adminNotes: 'please revise' },
      });
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'application_returned', actorId: 'admin-1', newValue: 'returned' })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Application returned to society member' })
      );
    });
  });

  describe('getApplicationById', () => {
    it('returns 404 when the application does not exist', async () => {
      const req = { params: { id: 'a1' }, user: { roles: ['admin'] } };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue(null);

      await applicationController.getApplicationById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects unauthorized users', async () => {
      const req = { params: { id: 'a1' }, user: { roles: ['student'] } };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue({ id: 'a1' });

      await applicationController.getApplicationById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns the application for an authorized user', async () => {
      const req = { params: { id: 'a1' }, user: { roles: ['society'] } };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue({ id: 'a1', subject: 'Subj' });

      await applicationController.getApplicationById(req, res);

      expect(res.json).toHaveBeenCalledWith({ success: true, application: { id: 'a1', subject: 'Subj' } });
    });
  });

  describe('exportApplicationPdf', () => {
    it('rejects unauthorized users', async () => {
      const req = { params: { id: 'a1' }, user: { roles: ['student'] }, query: {} };
      const res = mockRes();

      await applicationController.exportApplicationPdf(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.societyApplication.findUnique).not.toHaveBeenCalled();
    });

    it('returns 404 when the application does not exist', async () => {
      const req = { params: { id: 'a1' }, user: { roles: ['admin'] }, query: {} };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue(null);

      await applicationController.exportApplicationPdf(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('printApplicationPdf', () => {
    it('rejects unauthorized users', async () => {
      const req = { params: { id: 'a1' }, user: { roles: ['student'] } };
      const res = mockRes();

      await applicationController.printApplicationPdf(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.societyApplication.findUnique).not.toHaveBeenCalled();
    });

    it('returns 404 when the application does not exist', async () => {
      const req = { params: { id: 'a1' }, user: { roles: ['society'] } };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue(null);

      await applicationController.printApplicationPdf(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateApplication', () => {
    it('returns 404 when the application does not exist', async () => {
      const req = { params: { id: 'a1' }, body: {}, user: { roles: ['society'] } };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue(null);

      await applicationController.updateApplication(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects unauthorized users', async () => {
      const req = { params: { id: 'a1' }, body: {}, user: { roles: ['student'] } };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue({ id: 'a1', type: 'event_approval' });

      await applicationController.updateApplication(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('validates budget sections when updating a budget_breakdown application', async () => {
      const req = {
        params: { id: 'a1' },
        body: { content: { sections: [], totalAmount: 100 } },
        user: { roles: ['society'] },
      };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue({ id: 'a1', type: 'budget_breakdown' });

      await applicationController.updateApplication(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'At least one budget section is required' })
      );
      expect(prisma.societyApplication.update).not.toHaveBeenCalled();
    });

    it('validates totalAmount when updating a budget_breakdown application', async () => {
      const req = {
        params: { id: 'a1' },
        body: { content: { sections: [{ title: 'X', amount: 10 }], totalAmount: 0 } },
        user: { roles: ['society'] },
      };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue({ id: 'a1', type: 'budget_breakdown' });

      await applicationController.updateApplication(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'totalAmount must be greater than 0' })
      );
    });

    it('updates the application on success', async () => {
      const req = {
        params: { id: 'a1' },
        body: { subject: 'New Subject' },
        user: { roles: ['society'] },
      };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue({ id: 'a1', type: 'event_approval' });
      prisma.societyApplication.update.mockResolvedValue({ id: 'a1', subject: 'New Subject' });

      await applicationController.updateApplication(req, res);

      expect(prisma.societyApplication.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { subject: 'New Subject' },
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Application updated' })
      );
    });

    it('resets a budget_breakdown application to draft status on a valid content update', async () => {
      const req = {
        params: { id: 'a1' },
        body: { content: { sections: [{ title: 'X', amount: 10 }], totalAmount: 500 } },
        user: { roles: ['admin'] },
      };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue({ id: 'a1', type: 'budget_breakdown' });
      prisma.societyApplication.update.mockResolvedValue({ id: 'a1', status: 'draft' });

      await applicationController.updateApplication(req, res);

      expect(prisma.societyApplication.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: {
          content: { sections: [{ title: 'X', amount: 10 }], totalAmount: 500 },
          status: 'draft',
        },
      });
      expect(res.status).not.toHaveBeenCalledWith(400);
    });
  });

  describe('submitApplication', () => {
    it('returns 404 when the application does not exist', async () => {
      const req = { params: { id: 'a1' }, user: { roles: ['society'] } };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue(null);

      await applicationController.submitApplication(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects unauthorized users', async () => {
      const req = { params: { id: 'a1' }, user: { roles: ['student'] } };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue({ id: 'a1', status: 'draft' });

      await applicationController.submitApplication(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('rejects submitting an application that is not a draft', async () => {
      const req = { params: { id: 'a1' }, user: { roles: ['society'] } };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue({ id: 'a1', status: 'submitted' });

      await applicationController.submitApplication(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Application has already been submitted' })
      );
    });

    it('submits a draft application to admin', async () => {
      const req = { params: { id: 'a1' }, user: { roles: ['society'] } };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue({ id: 'a1', status: 'draft', forwardedAt: null });
      prisma.societyApplication.update.mockResolvedValue({ id: 'a1', status: 'submitted' });

      await applicationController.submitApplication(req, res);

      expect(prisma.societyApplication.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { status: 'submitted', forwardedAt: expect.any(Date) },
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Application submitted to admin' })
      );
    });
  });

  describe('addNote', () => {
    it('rejects when text is missing', async () => {
      const req = { params: { id: 'a1' }, body: { text: '   ' }, user: { roles: ['society'] } };
      const res = mockRes();

      await applicationController.addNote(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Note text is required' })
      );
      expect(prisma.societyApplication.findUnique).not.toHaveBeenCalled();
    });

    it('returns 404 when the application does not exist', async () => {
      const req = { params: { id: 'a1' }, body: { text: 'a note' }, user: { roles: ['society'] } };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue(null);

      await applicationController.addNote(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects unauthorized users', async () => {
      const req = { params: { id: 'a1' }, body: { text: 'a note' }, user: { roles: ['student'] } };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue({ id: 'a1', memberNotes: [] });

      await applicationController.addNote(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('appends a new note to an application with no existing notes', async () => {
      const req = {
        params: { id: 'a1' },
        body: { text: '  Please review soon  ' },
        user: { roles: ['society'], id: 'u1', name: 'Soc User' },
      };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue({ id: 'a1', memberNotes: null });
      prisma.societyApplication.update.mockResolvedValue({
        id: 'a1',
        memberNotes: [{ authorId: 'u1', authorName: 'Soc User', text: 'Please review soon' }],
      });

      await applicationController.addNote(req, res);

      expect(prisma.societyApplication.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: {
          memberNotes: [
            expect.objectContaining({ authorId: 'u1', authorName: 'Soc User', text: 'Please review soon' }),
          ],
        },
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Note added' })
      );
    });

    it('appends a new note to an application that already has notes', async () => {
      const existingNote = { authorId: 'u2', authorName: 'Other', text: 'Old note', createdAt: '2020-01-01T00:00:00.000Z' };
      const req = {
        params: { id: 'a1' },
        body: { text: 'New note' },
        user: { roles: ['admin'], id: 'admin-1', name: 'Admin' },
      };
      const res = mockRes();

      prisma.societyApplication.findUnique.mockResolvedValue({ id: 'a1', memberNotes: [existingNote] });
      prisma.societyApplication.update.mockResolvedValue({ id: 'a1', memberNotes: [existingNote, {}] });

      await applicationController.addNote(req, res);

      expect(prisma.societyApplication.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: {
          memberNotes: [
            existingNote,
            expect.objectContaining({ authorId: 'admin-1', authorName: 'Admin', text: 'New note' }),
          ],
        },
      });
    });
  });
});
