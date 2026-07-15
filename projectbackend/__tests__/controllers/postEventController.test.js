const path = require('path');

jest.mock('../../config/prisma', () => ({
  event: {
    findUnique: jest.fn(),
  },
  eventReport: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  eventReportMedia: {
    create: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
  voucher: {
    findMany: jest.fn(),
  },
  societyApplication: {
    findMany: jest.fn(),
  },
}));

jest.mock('fs', () => ({
  unlink: jest.fn((filePath, cb) => {
    if (cb) cb();
  }),
}));

// pdfkit / exceljs write directly to a real writable stream. Since our mock
// `res` objects are plain objects (not real streams), we replace both
// libraries with a generic chainable no-op mock so the controller's report
// generation code can run end-to-end without touching real file/stream I/O.
// See instructions: keep PDF/Excel-generating tests light and avoid
// asserting on binary output.
function mockChainable() {
  const store = {};
  const fn = function (...args) {
    return proxy;
  };
  const proxy = new Proxy(fn, {
    get(target, prop) {
      if (prop === 'then' || typeof prop === 'symbol') return undefined;
      if (!(prop in store)) {
        store[prop] = mockChainable();
      }
      return store[prop];
    },
    set(target, prop, value) {
      store[prop] = value;
      return true;
    },
    apply() {
      return proxy;
    },
  });
  return proxy;
}

jest.mock('pdfkit', () => jest.fn().mockImplementation(() => mockChainable()));
jest.mock('exceljs', () => ({
  Workbook: jest.fn().mockImplementation(() => mockChainable()),
}));

const prisma = require('../../config/prisma');
const fs = require('fs');
const ExcelJS = require('exceljs');
const postEventController = require('../../controllers/postEventController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  res.headersSent = false;
  return res;
};

describe('controllers/postEventController', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  const sampleEvent = {
    id: 'event-1',
    title: 'Tech Fest',
    eventDate: new Date('2026-01-10'),
    organizerName: 'CSE Society',
    venue: 'Auditorium',
  };

  const societyUser = { id: 'u1', name: 'Society User', roles: ['society'] };
  const adminUser = { id: 'admin-1', name: 'Admin User', roles: ['admin'] };
  const studentUser = { id: 'stu-1', name: 'Student User', roles: ['student'] };

  describe('getAllReports', () => {
    it('scopes results to the current user for non society/admin users', async () => {
      const req = { query: {}, user: studentUser };
      const res = mockRes();

      prisma.eventReport.findMany.mockResolvedValue([]);

      await postEventController.getAllReports(req, res);

      expect(prisma.eventReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { createdById: 'stu-1' } })
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, reports: [] }));
    });

    it('returns all reports for society/admin users and applies a valid status filter', async () => {
      const req = { query: { status: 'approved' }, user: adminUser };
      const res = mockRes();

      prisma.eventReport.findMany.mockResolvedValue([{ id: 'r1' }]);

      await postEventController.getAllReports(req, res);

      expect(prisma.eventReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'approved' } })
      );
    });

    it('ignores an invalid status filter', async () => {
      const req = { query: { status: 'bogus' }, user: adminUser };
      const res = mockRes();

      prisma.eventReport.findMany.mockResolvedValue([]);

      await postEventController.getAllReports(req, res);

      expect(prisma.eventReport.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });

    it('returns 500 on a database error', async () => {
      const req = { query: {}, user: adminUser };
      const res = mockRes();

      prisma.eventReport.findMany.mockRejectedValue(new Error('db down'));

      await postEventController.getAllReports(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('downloadGenericTemplate', () => {
    it('streams the generic Excel template', async () => {
      const req = { params: {} };
      const res = mockRes();

      await postEventController.downloadGenericTemplate(req, res);

      expect(ExcelJS.Workbook).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="post-event-template.xlsx"'
      );
      expect(res.end).toHaveBeenCalled();
    });

    it('returns 500 when workbook generation fails', async () => {
      const req = { params: {} };
      const res = mockRes();

      ExcelJS.Workbook.mockImplementationOnce(() => {
        throw new Error('boom');
      });

      await postEventController.downloadGenericTemplate(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getReports', () => {
    it('returns 404 when the event does not exist', async () => {
      const req = { params: { eventId: 'missing' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(null);

      await postEventController.getReports(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prisma.eventReport.findMany).not.toHaveBeenCalled();
    });

    it('returns reports scoped to the event', async () => {
      const req = { params: { eventId: 'event-1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findMany.mockResolvedValue([{ id: 'r1' }]);

      await postEventController.getReports(req, res);

      expect(prisma.eventReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { eventId: 'event-1' } })
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, reports: [{ id: 'r1' }] });
    });
  });

  describe('createReport', () => {
    it('rejects non society/admin users', async () => {
      const req = { params: { eventId: 'event-1' }, user: studentUser, body: {} };
      const res = mockRes();

      await postEventController.createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.event.findUnique).not.toHaveBeenCalled();
    });

    it('returns 404 when the event does not exist', async () => {
      const req = { params: { eventId: 'missing' }, user: societyUser, body: {} };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(null);

      await postEventController.createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 409 when an active report already exists', async () => {
      const req = { params: { eventId: 'event-1' }, user: societyUser, body: {} };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue({ id: 'existing-1', status: 'draft' });

      await postEventController.createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, existingReportId: 'existing-1' })
      );
      expect(prisma.eventReport.create).not.toHaveBeenCalled();
    });

    it('creates a draft report on success', async () => {
      const req = {
        params: { eventId: 'event-1' },
        user: societyUser,
        body: { budgetApplicationId: 'app-1' },
      };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue(null);
      prisma.eventReport.create.mockResolvedValue({ id: 'r1', eventId: 'event-1', status: 'draft' });

      await postEventController.createReport(req, res);

      expect(prisma.eventReport.create).toHaveBeenCalledWith({
        data: {
          eventId: 'event-1',
          status: 'draft',
          createdById: 'u1',
          createdByName: 'Society User',
          budgetApplicationId: 'app-1',
        },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, report: { id: 'r1', eventId: 'event-1', status: 'draft' } })
      );
    });
  });

  describe('getReport', () => {
    it('returns 404 when the event does not exist', async () => {
      const req = { params: { eventId: 'missing', reportId: 'r1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(null);

      await postEventController.getReport(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 404 when the report does not exist for the event', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'missing' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue(null);

      await postEventController.getReport(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns the report and event on success', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'r1' } };
      const res = mockRes();

      const report = { id: 'r1', status: 'draft', media: [] };
      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue(report);

      await postEventController.getReport(req, res);

      expect(res.json).toHaveBeenCalledWith({ success: true, report, event: sampleEvent });
    });
  });

  describe('downloadReportPdf', () => {
    it('returns 404 when the event does not exist', async () => {
      const req = { params: { eventId: 'missing', reportId: 'r1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(null);

      await postEventController.downloadReportPdf(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 404 when the report does not exist', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'missing' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue(null);

      await postEventController.downloadReportPdf(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('streams a PDF for an existing report', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'r1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue({
        id: 'r1',
        status: 'approved',
        media: [],
        attendanceRecord: {},
        eventInsights: {},
      });

      await postEventController.downloadReportPdf(req, res);

      expect(prisma.eventReport.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'r1', eventId: 'event-1' } })
      );
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    });
  });

  describe('downloadReportExcel', () => {
    it('returns 404 when the event does not exist', async () => {
      const req = { params: { eventId: 'missing', reportId: 'r1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(null);

      await postEventController.downloadReportExcel(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 404 when the report does not exist', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'missing' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue(null);

      await postEventController.downloadReportExcel(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('streams an Excel workbook for an existing report', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'r1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue({
        id: 'r1',
        status: 'approved',
        media: [],
        attendanceRecord: {},
        eventInsights: {},
      });

      await postEventController.downloadReportExcel(req, res);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(res.end).toHaveBeenCalled();
    });
  });

  describe('updateReport', () => {
    it('rejects non society/admin users', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'r1' }, user: studentUser, body: {} };
      const res = mockRes();

      await postEventController.updateReport(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 404 when the event does not exist', async () => {
      const req = { params: { eventId: 'missing', reportId: 'r1' }, user: societyUser, body: {} };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(null);

      await postEventController.updateReport(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 404 when the report does not exist', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'missing' }, user: societyUser, body: {} };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue(null);

      await postEventController.updateReport(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 409 when the report status is not editable', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'r1' }, user: societyUser, body: {} };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue({ id: 'r1', status: 'approved', media: [] });

      await postEventController.updateReport(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(prisma.eventReport.update).not.toHaveBeenCalled();
    });

    it('sanitizes and persists the updated fields on success', async () => {
      const req = {
        params: { eventId: 'event-1', reportId: 'r1' },
        user: societyUser,
        body: {
          attendanceRecord: { totalRegistered: '50', totalAttended: '40', attendeeList: [{ name: 'A' }] },
          eventInsights: {
            keyHighlights: 'great',
            challengesFaced: 'none',
            improvementsSuggested: 'more food',
            overallAssessment: 'good',
            budgetPlannedTotal: '1000',
            budgetActualTotal: '900',
          },
          expenseNotes: '  spent wisely  ',
          budgetApplicationId: 'app-1',
        },
      };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue({ id: 'r1', status: 'draft', media: [] });
      prisma.eventReport.update.mockResolvedValue({ id: 'r1', status: 'draft' });

      await postEventController.updateReport(req, res);

      expect(prisma.eventReport.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: {
          attendanceRecord: { totalRegistered: 50, totalAttended: 40, attendeeList: [{ name: 'A' }] },
          eventInsights: {
            keyHighlights: 'great',
            challengesFaced: 'none',
            improvementsSuggested: 'more food',
            overallAssessment: 'good',
            budgetPlannedTotal: 1000,
            budgetActualTotal: 900,
          },
          expenseNotes: 'spent wisely',
          budgetApplicationId: 'app-1',
        },
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, report: { id: 'r1', status: 'draft' } })
      );
    });
  });

  describe('submitReport', () => {
    it('rejects non society/admin users', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'r1' }, user: studentUser };
      const res = mockRes();

      await postEventController.submitReport(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 404 when the report does not exist', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'missing' }, user: societyUser };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue(null);

      await postEventController.submitReport(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 409 when the report is already in a non-editable status', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'r1' }, user: societyUser };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue({ id: 'r1', status: 'approved', media: [] });

      await postEventController.submitReport(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(prisma.eventReport.update).not.toHaveBeenCalled();
    });

    it('submits an editable report', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'r1' }, user: societyUser };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue({ id: 'r1', status: 'draft', media: [] });
      prisma.eventReport.update.mockResolvedValue({ id: 'r1', status: 'submitted' });

      await postEventController.submitReport(req, res);

      expect(prisma.eventReport.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: 'submitted', submittedAt: expect.any(Date) },
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Report submitted for review' })
      );
    });
  });

  describe('reviewReport', () => {
    it('rejects non-admin users', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'r1' }, user: societyUser, body: {} };
      const res = mockRes();

      await postEventController.reviewReport(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 404 when the report does not exist', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'missing' }, user: adminUser, body: {} };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue(null);

      await postEventController.reviewReport(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 409 when the report is not submitted or under review', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'r1' }, user: adminUser, body: { action: 'approve' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue({ id: 'r1', status: 'draft', media: [] });

      await postEventController.reviewReport(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('returns 400 for an invalid action', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'r1' }, user: adminUser, body: { action: 'nope' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue({ id: 'r1', status: 'submitted', media: [] });

      await postEventController.reviewReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(prisma.eventReport.update).not.toHaveBeenCalled();
    });

    it('returns 400 when returning a report without adminNotes', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'r1' }, user: adminUser, body: { action: 'return' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue({ id: 'r1', status: 'submitted', media: [] });

      await postEventController.reviewReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'adminNotes required when returning a report' })
      );
    });

    it('approves a submitted report', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'r1' }, user: adminUser, body: { action: 'approve' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue({ id: 'r1', status: 'submitted', media: [] });
      prisma.eventReport.update.mockResolvedValue({ id: 'r1', status: 'approved' });

      await postEventController.reviewReport(req, res);

      expect(prisma.eventReport.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: {
          status: 'approved',
          adminNotes: null,
          reviewedById: 'admin-1',
          reviewedByName: 'Admin User',
          reviewedAt: expect.any(Date),
        },
      });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: 'Report approved' }));
    });

    it('returns a report for revision with adminNotes', async () => {
      const req = {
        params: { eventId: 'event-1', reportId: 'r1' },
        user: adminUser,
        body: { action: 'return', adminNotes: 'Please add more detail' },
      };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue({ id: 'r1', status: 'under_review', media: [] });
      prisma.eventReport.update.mockResolvedValue({ id: 'r1', status: 'returned' });

      await postEventController.reviewReport(req, res);

      expect(prisma.eventReport.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'returned', adminNotes: 'Please add more detail' }) })
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Report returned for revision' }));
    });

    it('marks a report as under review', async () => {
      const req = {
        params: { eventId: 'event-1', reportId: 'r1' },
        user: adminUser,
        body: { action: 'start_review' },
      };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue({ id: 'r1', status: 'submitted', media: [] });
      prisma.eventReport.update.mockResolvedValue({ id: 'r1', status: 'under_review' });

      await postEventController.reviewReport(req, res);

      expect(prisma.eventReport.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'under_review' }) })
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Report marked as under review' }));
    });
  });

  describe('uploadMedia', () => {
    it('rejects non society/admin users', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'r1' }, user: studentUser, body: {} };
      const res = mockRes();

      await postEventController.uploadMedia(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 404 when the report does not exist', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'missing' }, user: societyUser, body: {} };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue(null);

      await postEventController.uploadMedia(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 409 and cleans up the file when the report is not editable', async () => {
      const req = {
        params: { eventId: 'event-1', reportId: 'r1' },
        user: societyUser,
        body: {},
        file: { path: '/tmp/upload1.png' },
      };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue({ id: 'r1', status: 'approved', media: [] });

      await postEventController.uploadMedia(req, res);

      expect(fs.unlink).toHaveBeenCalledWith('/tmp/upload1.png', expect.any(Function));
      expect(res.status).toHaveBeenCalledWith(409);
      expect(prisma.eventReportMedia.create).not.toHaveBeenCalled();
    });

    it('returns 400 when no file is provided', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'r1' }, user: societyUser, body: {} };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue({ id: 'r1', status: 'draft', media: [] });

      await postEventController.uploadMedia(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'No file provided' }));
    });

    it('rejects a disallowed mime type and cleans up the file', async () => {
      const req = {
        params: { eventId: 'event-1', reportId: 'r1' },
        user: societyUser,
        body: { mediaType: 'photos' },
        file: { path: '/tmp/upload2.exe', mimetype: 'application/x-msdownload' },
      };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue({ id: 'r1', status: 'draft', media: [] });

      await postEventController.uploadMedia(req, res);

      expect(fs.unlink).toHaveBeenCalledWith('/tmp/upload2.exe', expect.any(Function));
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'File type not allowed' }));
    });

    it('rejects an invalid mediaType and cleans up the file', async () => {
      const req = {
        params: { eventId: 'event-1', reportId: 'r1' },
        user: societyUser,
        body: { mediaType: 'sound' },
        file: { path: '/tmp/upload3.png', mimetype: 'image/png' },
      };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue({ id: 'r1', status: 'draft', media: [] });

      await postEventController.uploadMedia(req, res);

      expect(fs.unlink).toHaveBeenCalledWith('/tmp/upload3.png', expect.any(Function));
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'mediaType must be photos, video, or document' })
      );
    });

    it('creates a media record on success', async () => {
      const req = {
        params: { eventId: 'event-1', reportId: 'r1' },
        user: societyUser,
        body: { mediaType: 'photos', description: 'Group photo' },
        file: {
          path: '/tmp/upload4.png',
          filename: 'upload4.png',
          originalname: 'group-photo.png',
          mimetype: 'image/png',
          size: 2048,
        },
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:5000'),
      };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue({ id: 'r1', status: 'draft', media: [] });
      prisma.eventReportMedia.create.mockResolvedValue({ id: 'media-1' });

      await postEventController.uploadMedia(req, res);

      expect(prisma.eventReportMedia.create).toHaveBeenCalledWith({
        data: {
          reportId: 'r1',
          fileUrl: 'http://localhost:5000/uploads/report-media/upload4.png',
          fileName: 'group-photo.png',
          mimeType: 'image/png',
          fileSize: 2048,
          mediaType: 'photos',
          description: 'Group photo',
          uploadedById: 'u1',
          uploadedByName: 'Society User',
        },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, media: { id: 'media-1' } }));
    });
  });

  describe('deleteMedia', () => {
    it('rejects non society/admin users', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'r1', mediaId: 'm1' }, user: studentUser };
      const res = mockRes();

      await postEventController.deleteMedia(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 404 when the report does not exist', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'missing', mediaId: 'm1' }, user: societyUser };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue(null);

      await postEventController.deleteMedia(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 409 when the report is not editable', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'r1', mediaId: 'm1' }, user: societyUser };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue({ id: 'r1', status: 'approved', media: [] });

      await postEventController.deleteMedia(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(prisma.eventReportMedia.findFirst).not.toHaveBeenCalled();
    });

    it('returns 404 when the media does not exist', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'r1', mediaId: 'missing' }, user: societyUser };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue({ id: 'r1', status: 'draft', media: [] });
      prisma.eventReportMedia.findFirst.mockResolvedValue(null);

      await postEventController.deleteMedia(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prisma.eventReportMedia.delete).not.toHaveBeenCalled();
    });

    it('deletes the media file and record on success', async () => {
      const req = { params: { eventId: 'event-1', reportId: 'r1', mediaId: 'm1' }, user: societyUser };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.eventReport.findFirst.mockResolvedValue({ id: 'r1', status: 'draft', media: [] });
      prisma.eventReportMedia.findFirst.mockResolvedValue({
        id: 'm1',
        fileUrl: 'http://localhost:5000/uploads/report-media/file123.png',
      });
      prisma.eventReportMedia.delete.mockResolvedValue({ id: 'm1' });

      await postEventController.deleteMedia(req, res);

      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining(path.join('report-media', 'file123.png')),
        expect.any(Function)
      );
      expect(prisma.eventReportMedia.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Media deleted' });
    });
  });

  describe('getBudgetComparison', () => {
    it('returns 404 when the event does not exist', async () => {
      const req = { params: { eventId: 'missing' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(null);

      await postEventController.getBudgetComparison(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('prefers manually entered budget totals over computed ones', async () => {
      const req = { params: { eventId: 'event-1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.voucher.findMany.mockResolvedValue([{ id: 'v1', amount: 100, status: 'approved' }]);
      prisma.societyApplication.findMany.mockResolvedValue([]);
      prisma.eventReport.findFirst.mockResolvedValue({
        eventInsights: { budgetPlannedTotal: 5000, budgetActualTotal: 4500 },
      });

      await postEventController.getBudgetComparison(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        budgetComparison: expect.objectContaining({
          planned: expect.objectContaining({ total: 5000 }),
          actual: expect.objectContaining({ total: 4500 }),
          variance: -500,
          variancePercent: '-10.00',
          summary: 'Under budget',
        }),
      });
    });

    it('falls back to the budget application and voucher totals when no manual totals exist', async () => {
      const req = { params: { eventId: 'event-1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);
      prisma.voucher.findMany.mockResolvedValue([
        { id: 'v1', amount: 1000, status: 'approved' },
        { id: 'v2', amount: 500, status: 'pending' },
      ]);
      prisma.societyApplication.findMany.mockResolvedValue([
        {
          id: 'ba1',
          subject: 'Budget',
          status: 'approved',
          content: { totalAmount: 2000, sections: [{ title: 'Venue', amount: 2000, purpose: 'venue' }] },
        },
      ]);
      prisma.eventReport.findFirst.mockResolvedValue(null);

      await postEventController.getBudgetComparison(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        budgetComparison: expect.objectContaining({
          planned: expect.objectContaining({ total: 2000 }),
          actual: expect.objectContaining({ total: 1500, approvedTotal: 1000 }),
          variance: -500,
          variancePercent: '-25.00',
          summary: 'Under budget',
        }),
      });
    });
  });

  describe('downloadTemplate', () => {
    it('returns 404 when the event does not exist', async () => {
      const req = { params: { eventId: 'missing' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(null);

      await postEventController.downloadTemplate(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(ExcelJS.Workbook).not.toHaveBeenCalled();
    });

    it('streams a per-event Excel template on success', async () => {
      const req = { params: { eventId: 'event-1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(sampleEvent);

      await postEventController.downloadTemplate(req, res);

      expect(ExcelJS.Workbook).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(res.end).toHaveBeenCalled();
    });
  });
});
