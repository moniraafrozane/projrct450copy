const prisma = require('../config/prisma');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { createAuditLog } = require('./auditLogController');

const METRIC_DEFINITIONS = [
  {
    key: 'total_events_per_year',
    label: 'Total events per year',
    description: 'Number of events scheduled in the selected year.',
    format: 'number',
  },
  {
    key: 'total_budget_per_year',
    label: 'Total budget per year',
    description: 'Approved voucher total for the selected year.',
    format: 'currency',
  },
  {
    key: 'average_budget_per_event',
    label: 'Average budget per event',
    description: 'Average approved budget across events in the selected year.',
    format: 'currency',
  },
  {
    key: 'total_student_participations',
    label: 'Total student participations',
    description: 'Count of attended registrations in the selected year.',
    format: 'number',
  },
];

function isAdminUser(user) {
  return Array.isArray(user?.roles) && user.roles.includes('admin');
}

function buildYearRange(year) {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  return { start, end };
}

function getStartOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function sumApprovedVoucherAmount(vouchers = []) {
  return vouchers
    .filter((voucher) => voucher.status === 'approved')
    .reduce((sum, voucher) => sum + Number(voucher.amount || 0), 0);
}

function sumNonRejectedVoucherAmount(vouchers = []) {
  return vouchers
    .filter((voucher) => voucher.status !== 'rejected')
    .reduce((sum, voucher) => sum + Number(voucher.amount || 0), 0);
}

function parsePositiveNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function getBudgetBreakdownTotal(application) {
  const content = application?.content;
  if (!content || typeof content !== 'object') {
    return null;
  }

  return parsePositiveNumber(content.totalAmount);
}

function sanitizeFilename(value) {
  return String(value || 'analytics-report')
    .replace(/[^a-z0-9\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-');
}

function formatMetricValue(metric) {
  if (metric.format === 'currency') {
    return `BDT ${Number(metric.value || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;
  }

  return Number(metric.value || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 });
}

function serializeReport(report) {
  return {
    id: report.id,
    title: report.title,
    reportYear: report.reportYear,
    notes: report.notes,
    metricKeys: report.metricKeys,
    metricValues: report.metricValues,
    filters: report.filters,
    createdById: report.createdById,
    createdByName: report.createdByName,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
}

async function computeMetricSource(year) {
  const { start, end } = buildYearRange(year);

  const [events, vouchers, registrations] = await Promise.all([
    prisma.event.findMany({
      where: { eventDate: { gte: start, lt: end } },
      select: { id: true },
    }),
    prisma.voucher.findMany({
      where: {
        status: 'approved',
        event: { eventDate: { gte: start, lt: end } },
      },
      select: { amount: true },
    }),
    prisma.eventRegistration.findMany({
      where: {
        attended: true,
        event: { eventDate: { gte: start, lt: end } },
      },
      select: { id: true },
    }),
  ]);

  const totalEvents = events.length;
  const totalBudget = vouchers.reduce((sum, voucher) => sum + Number(voucher.amount || 0), 0);
  const averageBudgetPerEvent = totalEvents > 0 ? totalBudget / totalEvents : 0;
  const totalStudentParticipations = registrations.length;

  return {
    total_events_per_year: totalEvents,
    total_budget_per_year: totalBudget,
    average_budget_per_event: averageBudgetPerEvent,
    total_student_participations: totalStudentParticipations,
  };
}

function normalizeMetricValue(metricKey, rawValue, fallbackValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { value: fallbackValue, source: 'auto' };
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid value for ${metricKey}`);
  }

  return { value: parsed, source: 'manual' };
}

function getSelectedMetricDefinitions(metricKeys) {
  const allowed = new Set(METRIC_DEFINITIONS.map((metric) => metric.key));
  const keys = Array.isArray(metricKeys) && metricKeys.length ? metricKeys : METRIC_DEFINITIONS.map((metric) => metric.key);

  const invalid = keys.filter((key) => !allowed.has(key));
  if (invalid.length) {
    throw new Error(`Invalid metric selection: ${invalid.join(', ')}`);
  }

  return METRIC_DEFINITIONS.filter((metric) => keys.includes(metric.key));
}

function buildMetricPayload(selectedMetrics, computedValues, manualValues = {}) {
  return selectedMetrics.map((metric) => {
    const normalized = normalizeMetricValue(metric.key, manualValues?.[metric.key], computedValues[metric.key]);

    return {
      key: metric.key,
      label: metric.label,
      description: metric.description,
      format: metric.format,
      value: normalized.value,
      autoValue: computedValues[metric.key],
      source: normalized.source,
    };
  });
}

function serializePastEventBudget(event, budgetApplicationByEventId) {
  const approvedBudget = sumApprovedVoucherAmount(event.vouchers);
  const fallbackBudget = sumNonRejectedVoucherAmount(event.vouchers);
  const budgetFromVouchers = parsePositiveNumber(approvedBudget) || parsePositiveNumber(fallbackBudget);
  const budgetBreakdown = getBudgetBreakdownTotal(budgetApplicationByEventId.get(event.id));

  return {
    name: event.title,
    date: event.eventDate,
    budget: budgetFromVouchers || budgetBreakdown || 0,
  };
}

function writeMetricRow(doc, label, value, format) {
  doc.font('Helvetica-Bold').text(label, { continued: true });
  const displayValue = format === 'currency'
    ? ` BDT ${Number(value || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`
    : ` ${Number(value || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;
  doc.font('Helvetica').text(displayValue);
}

async function renderPdf(res, report) {
  const filename = `${sanitizeFilename(report.title)}-${report.reportYear}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: report.title,
      Author: 'CSE Society System',
      Subject: 'Admin analytics report',
    },
  });

  doc.pipe(res);
  doc.font('Helvetica-Bold').fontSize(18).text(report.title, { align: 'center' });
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(10);
  doc.text(`Report year: ${report.reportYear}`);
  doc.text(`Created by: ${report.createdByName}`);
  doc.text(`Created at: ${new Date(report.createdAt).toLocaleString('en-GB')}`);

  if (report.notes) {
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('Notes');
    doc.font('Helvetica').text(report.notes);
  }

  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').fontSize(13).text('Metrics');
  doc.moveDown(0.3);
  (report.metricValues || []).forEach((metric) => {
    writeMetricRow(doc, metric.label, metric.value, metric.format);
    if (metric.autoValue !== undefined && metric.autoValue !== null && metric.source === 'manual') {
      const autoMetric = { ...metric, value: metric.autoValue };
      doc.font('Helvetica-Oblique').text(`Auto value: ${formatMetricValue(autoMetric)}`);
    }
  });

  doc.end();
}

async function renderExcel(res, report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CSE Society System';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Analytics Report');
  ws.columns = [
    { width: 30 },
    { width: 22 },
    { width: 18 },
    { width: 18 },
  ];

  ws.mergeCells('A1:D1');
  ws.getCell('A1').value = report.title;
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A1').alignment = { horizontal: 'center' };

  ws.addRow(['Report year', report.reportYear]);
  ws.addRow(['Created by', report.createdByName]);
  ws.addRow(['Created at', new Date(report.createdAt).toLocaleString('en-GB')]);
  ws.addRow([]);
  ws.addRow(['Metric', 'Value', 'Auto value', 'Source']);

  const headerRow = ws.getRow(5);
  headerRow.font = { bold: true };

  (report.metricValues || []).forEach((metric) => {
    ws.addRow([
      metric.label,
      metric.format === 'currency' ? `BDT ${Number(metric.value || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 })}` : Number(metric.value || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 }),
      metric.format === 'currency' ? `BDT ${Number(metric.autoValue || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 })}` : Number(metric.autoValue || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 }),
      metric.source,
    ]);
  });

  if (report.notes) {
    ws.addRow([]);
    ws.addRow(['Notes', report.notes]);
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(report.title)}-${report.reportYear}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

exports.getMetricOptions = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ success: false, message: 'Only admins can access analytics reports' });
    }

    return res.json({
      success: true,
      metrics: METRIC_DEFINITIONS,
      defaultYear: new Date().getFullYear(),
    });
  } catch (error) {
    console.error('getMetricOptions error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getMonthlyBudgetEvents = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ success: false, message: 'Only admins can access analytics reports' });
    }

    const startOfToday = getStartOfToday();

    const events = await prisma.event.findMany({
      where: {
        eventDate: { lt: startOfToday },
      },
      select: {
        id: true,
        title: true,
        eventDate: true,
        vouchers: {
          select: {
            amount: true,
            status: true,
          },
        },
      },
      orderBy: { eventDate: 'asc' },
    });

    const eventIds = events.map((event) => event.id);
    let budgetApplications = [];

    if (eventIds.length) {
      budgetApplications = await prisma.societyApplication.findMany({
        where: {
          type: 'budget_breakdown',
          OR: eventIds.map((eventId) => ({
            content: {
              path: ['eventId'],
              equals: eventId,
            },
          })),
        },
        select: {
          content: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    const budgetApplicationByEventId = new Map();
    budgetApplications.forEach((application) => {
      const content = application?.content;
      const eventId = content && typeof content === 'object' ? content.eventId : null;
      if (typeof eventId === 'string' && !budgetApplicationByEventId.has(eventId)) {
        budgetApplicationByEventId.set(eventId, application);
      }
    });

    const pastEvents = events.map((event) => serializePastEventBudget(event, budgetApplicationByEventId));
    const totalBudget = pastEvents.reduce((sum, event) => sum + Number(event.budget || 0), 0);

    return res.json({
      success: true,
      events: pastEvents,
      totalBudget,
      eventCount: pastEvents.length,
    });
  } catch (error) {
    console.error('getMonthlyBudgetEvents error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.listReports = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ success: false, message: 'Only admins can access analytics reports' });
    }

    const reports = await prisma.analyticsReport.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      reports: reports.map(serializeReport),
    });
  } catch (error) {
    console.error('listReports error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getReport = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ success: false, message: 'Only admins can access analytics reports' });
    }

    const { reportId } = req.params;
    const report = await prisma.analyticsReport.findUnique({ where: { id: reportId } });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Analytics report not found' });
    }

    return res.json({ success: true, report: serializeReport(report) });
  } catch (error) {
    console.error('getReport error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createReport = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ success: false, message: 'Only admins can create analytics reports' });
    }

    const title = String(req.body?.title || '').trim();
    const notes = String(req.body?.notes || '').trim();
    const year = Number(req.body?.year);
    const metricKeys = req.body?.metricKeys;
    const metricValues = req.body?.metricValues || {};

    if (!title) {
      return res.status(400).json({ success: false, message: 'Report title is required' });
    }

    if (!Number.isInteger(year)) {
      return res.status(400).json({ success: false, message: 'Report year must be a valid integer' });
    }

    let selectedMetrics;
    try {
      selectedMetrics = getSelectedMetricDefinitions(metricKeys);
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    const computedValues = await computeMetricSource(year);

    let payload;
    try {
      payload = buildMetricPayload(selectedMetrics, computedValues, metricValues);
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    const report = await prisma.analyticsReport.create({
      data: {
        title,
        reportYear: year,
        notes: notes || null,
        metricKeys: selectedMetrics.map((metric) => metric.key),
        metricValues: payload,
        filters: {
          year,
        },
        createdById: req.user.id,
        createdByName: req.user.name || 'Admin',
      },
    });

    createAuditLog({
      action: 'analytics_report_generated',
      module: 'analytics',
      description: `Generated analytics report "${title}" for ${year}`,
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorName: req.user.name,
      actorRole: 'admin',
      resourceId: report.id,
      resourceType: 'AnalyticsReport',
      resourceName: title,
      metadata: {
        year,
        metricKeys: report.metricKeys,
      },
    }).catch((error) => console.error('Analytics audit log error:', error));

    return res.status(201).json({
      success: true,
      message: 'Analytics report generated successfully',
      report: serializeReport(report),
    });
  } catch (error) {
    console.error('createReport error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.exportReport = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ success: false, message: 'Only admins can export analytics reports' });
    }

    const { reportId } = req.params;
    const format = String(req.query.format || 'pdf').toLowerCase();
    const report = await prisma.analyticsReport.findUnique({ where: { id: reportId } });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Analytics report not found' });
    }

    createAuditLog({
      action: 'analytics_report_exported',
      module: 'analytics',
      description: `Exported analytics report "${report.title}" as ${format.toUpperCase()}`,
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorName: req.user.name,
      actorRole: 'admin',
      resourceId: report.id,
      resourceType: 'AnalyticsReport',
      resourceName: report.title,
      metadata: {
        format,
        year: report.reportYear,
      },
    }).catch((error) => console.error('Analytics export audit log error:', error));

    if (format === 'xlsx' || format === 'excel') {
      return renderExcel(res, report);
    }

    return renderPdf(res, report);
  } catch (error) {
    console.error('exportReport error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};