jest.mock('../../config/prisma', () => ({
  event: {
    findMany: jest.fn(),
  },
  voucher: {
    findMany: jest.fn(),
  },
  eventRegistration: {
    findMany: jest.fn(),
  },
  societyApplication: {
    findMany: jest.fn(),
  },
  analyticsReport: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('../../controllers/auditLogController', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('exceljs', () => {
  const worksheet = {
    columns: null,
    mergeCells: jest.fn(),
    getCell: jest.fn(() => ({ value: null, font: null, alignment: null })),
    addRow: jest.fn(),
    getRow: jest.fn(() => ({ font: null })),
  };
  const workbook = {
    creator: null,
    created: null,
    addWorksheet: jest.fn(() => worksheet),
    xlsx: { write: jest.fn().mockResolvedValue(undefined) },
  };
  return { Workbook: jest.fn(() => workbook) };
});

jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => ({
    pipe: jest.fn(),
    font: jest.fn().mockReturnThis(),
    fontSize: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    moveDown: jest.fn().mockReturnThis(),
    end: jest.fn(),
  }));
});

const prisma = require('../../config/prisma');
const { createAuditLog } = require('../../controllers/auditLogController');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const analyticsReportController = require('../../controllers/analyticsReportController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res;
};

const adminUser = { id: 'admin-1', name: 'Admin', email: 'admin@b.com', roles: ['admin'] };
const studentUser = { id: 'stu-1', name: 'Stu', email: 'stu@b.com', roles: ['student'] };

describe('controllers/analyticsReportController', () => {
  describe('getMetricOptions', () => {
    it('rejects non-admin users', async () => {
      const req = { user: studentUser };
      const res = mockRes();

      await analyticsReportController.getMetricOptions(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Only admins can access analytics reports' })
      );
    });

    it('returns the metric definitions and default year for admins', async () => {
      const req = { user: adminUser };
      const res = mockRes();

      await analyticsReportController.getMetricOptions(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          metrics: expect.any(Array),
          defaultYear: new Date().getFullYear(),
        })
      );
    });
  });

  describe('getMonthlyBudgetEvents', () => {
    it('rejects non-admin users', async () => {
      const req = { user: studentUser };
      const res = mockRes();

      await analyticsReportController.getMonthlyBudgetEvents(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.event.findMany).not.toHaveBeenCalled();
    });

    it('returns an empty list and skips the budget application lookup when there are no past events', async () => {
      const req = { user: adminUser };
      const res = mockRes();

      prisma.event.findMany.mockResolvedValue([]);

      await analyticsReportController.getMonthlyBudgetEvents(req, res);

      expect(prisma.societyApplication.findMany).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, events: [], totalBudget: 0, eventCount: 0 })
      );
    });

    it('computes past-event budgets from approved vouchers', async () => {
      const req = { user: adminUser };
      const res = mockRes();

      prisma.event.findMany.mockResolvedValue([
        {
          id: 'e1',
          title: 'Past Event',
          eventDate: new Date('2026-01-01'),
          vouchers: [
            { amount: 1000, status: 'approved' },
            { amount: 500, status: 'rejected' },
          ],
        },
      ]);
      prisma.societyApplication.findMany.mockResolvedValue([]);

      await analyticsReportController.getMonthlyBudgetEvents(req, res);

      expect(prisma.societyApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ type: 'budget_breakdown' }) })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          events: [expect.objectContaining({ name: 'Past Event', budget: 1000 })],
          totalBudget: 1000,
          eventCount: 1,
        })
      );
    });
  });

  describe('listReports', () => {
    it('rejects non-admin users', async () => {
      const req = { user: studentUser };
      const res = mockRes();

      await analyticsReportController.listReports(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.analyticsReport.findMany).not.toHaveBeenCalled();
    });

    it('returns serialized reports for admins', async () => {
      const req = { user: adminUser };
      const res = mockRes();

      prisma.analyticsReport.findMany.mockResolvedValue([
        {
          id: 'r1',
          title: 'Report 1',
          reportYear: 2026,
          notes: null,
          metricKeys: ['total_events_per_year'],
          metricValues: [],
          filters: { year: 2026 },
          createdById: 'admin-1',
          createdByName: 'Admin',
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
      ]);

      await analyticsReportController.listReports(req, res);

      expect(prisma.analyticsReport.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          reports: [expect.objectContaining({ id: 'r1', title: 'Report 1' })],
        })
      );
    });
  });

  describe('getReport', () => {
    it('rejects non-admin users', async () => {
      const req = { user: studentUser, params: { reportId: 'r1' } };
      const res = mockRes();

      await analyticsReportController.getReport(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 404 when the report does not exist', async () => {
      const req = { user: adminUser, params: { reportId: 'missing' } };
      const res = mockRes();

      prisma.analyticsReport.findUnique.mockResolvedValue(null);

      await analyticsReportController.getReport(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Analytics report not found' })
      );
    });

    it('returns the serialized report on success', async () => {
      const req = { user: adminUser, params: { reportId: 'r1' } };
      const res = mockRes();

      const report = {
        id: 'r1',
        title: 'Report 1',
        reportYear: 2026,
        notes: 'note',
        metricKeys: [],
        metricValues: [],
        filters: {},
        createdById: 'admin-1',
        createdByName: 'Admin',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      };
      prisma.analyticsReport.findUnique.mockResolvedValue(report);

      await analyticsReportController.getReport(req, res);

      expect(prisma.analyticsReport.findUnique).toHaveBeenCalledWith({ where: { id: 'r1' } });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, report: expect.objectContaining({ id: 'r1' }) })
      );
    });
  });

  describe('createReport', () => {
    beforeEach(() => {
      prisma.event.findMany.mockResolvedValue([{ id: 'e1' }]);
      prisma.voucher.findMany.mockResolvedValue([{ amount: 1000 }]);
      prisma.eventRegistration.findMany.mockResolvedValue([{ id: 'reg1' }, { id: 'reg2' }]);
    });

    it('rejects non-admin users', async () => {
      const req = { user: studentUser, body: { title: 'R', year: 2026 } };
      const res = mockRes();

      await analyticsReportController.createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.analyticsReport.create).not.toHaveBeenCalled();
    });

    it('rejects when title is missing', async () => {
      const req = { user: adminUser, body: { title: '  ', year: 2026 } };
      const res = mockRes();

      await analyticsReportController.createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Report title is required' })
      );
    });

    it('rejects a non-integer year', async () => {
      const req = { user: adminUser, body: { title: 'Report', year: 'abc' } };
      const res = mockRes();

      await analyticsReportController.createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Report year must be a valid integer' })
      );
    });

    it('rejects invalid metric keys', async () => {
      const req = {
        user: adminUser,
        body: { title: 'Report', year: 2026, metricKeys: ['not_a_real_metric'] },
      };
      const res = mockRes();

      await analyticsReportController.createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Invalid metric selection') })
      );
    });

    it('rejects a non-numeric manual metric value', async () => {
      const req = {
        user: adminUser,
        body: {
          title: 'Report',
          year: 2026,
          metricKeys: ['total_events_per_year'],
          metricValues: { total_events_per_year: 'not-a-number' },
        },
      };
      const res = mockRes();

      await analyticsReportController.createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid value for total_events_per_year' })
      );
    });

    it('creates the report, computes auto metrics, and writes an audit log', async () => {
      const req = {
        user: adminUser,
        body: { title: 'Report', year: 2026, metricKeys: ['total_events_per_year'] },
      };
      const res = mockRes();

      prisma.analyticsReport.create.mockResolvedValue({
        id: 'r1',
        title: 'Report',
        reportYear: 2026,
        notes: null,
        metricKeys: ['total_events_per_year'],
        metricValues: [{ key: 'total_events_per_year', value: 1 }],
        filters: { year: 2026 },
        createdById: 'admin-1',
        createdByName: 'Admin',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      });

      await analyticsReportController.createReport(req, res);

      expect(prisma.analyticsReport.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Report',
          reportYear: 2026,
          metricKeys: ['total_events_per_year'],
          createdById: 'admin-1',
          createdByName: 'Admin',
        }),
      });
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'analytics_report_generated', actorId: 'admin-1' })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Analytics report generated successfully' })
      );
    });
  });

  describe('exportReport', () => {
    it('rejects non-admin users', async () => {
      const req = { user: studentUser, params: { reportId: 'r1' }, query: {} };
      const res = mockRes();

      await analyticsReportController.exportReport(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.analyticsReport.findUnique).not.toHaveBeenCalled();
    });

    it('returns 404 when the report does not exist', async () => {
      const req = { user: adminUser, params: { reportId: 'missing' }, query: {} };
      const res = mockRes();

      prisma.analyticsReport.findUnique.mockResolvedValue(null);

      await analyticsReportController.exportReport(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Analytics report not found' })
      );
    });

    it('streams a PDF by default and writes an audit log', async () => {
      const req = { user: adminUser, params: { reportId: 'r1' }, query: {} };
      const res = mockRes();

      const report = {
        id: 'r1',
        title: 'Report 1',
        reportYear: 2026,
        notes: null,
        createdByName: 'Admin',
        createdAt: new Date('2026-01-01'),
        metricValues: [],
      };
      prisma.analyticsReport.findUnique.mockResolvedValue(report);

      await analyticsReportController.exportReport(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'analytics_report_exported', metadata: expect.objectContaining({ format: 'pdf' }) })
      );

      const docInstance = PDFDocument.mock.results[PDFDocument.mock.results.length - 1].value;
      expect(docInstance.pipe).toHaveBeenCalledWith(res);
      expect(docInstance.end).toHaveBeenCalled();
    });

    it('streams an Excel workbook when format=xlsx is requested', async () => {
      const req = { user: adminUser, params: { reportId: 'r1' }, query: { format: 'xlsx' } };
      const res = mockRes();

      const report = {
        id: 'r1',
        title: 'Report 1',
        reportYear: 2026,
        notes: null,
        createdByName: 'Admin',
        createdAt: new Date('2026-01-01'),
        metricValues: [],
      };
      prisma.analyticsReport.findUnique.mockResolvedValue(report);

      await analyticsReportController.exportReport(req, res);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: expect.objectContaining({ format: 'xlsx' }) })
      );

      const workbookInstance = ExcelJS.Workbook.mock.results[ExcelJS.Workbook.mock.results.length - 1].value;
      expect(workbookInstance.xlsx.write).toHaveBeenCalledWith(res);
      expect(res.end).toHaveBeenCalled();
    });
  });
});
