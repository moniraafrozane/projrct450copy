/**
 * Post-Event Reporting Controller
 * Endpoints mounted under /api/events/:eventId/post-event-reports
 * Plus  /api/events/:eventId/post-event-template   (template download)
 *       /api/events/:eventId/budget-comparison      (planned vs actual)
 */

const prisma = require('../config/prisma');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// ── Constants ─────────────────────────────────────────────────────────────────

const REPORT_STATUS = {
  draft:      'draft',
  submitted:  'submitted',
  underReview:'under_review',
  approved:   'approved',
  returned:   'returned',
};

const EDITABLE_STATUSES = new Set([REPORT_STATUS.draft, REPORT_STATUS.returned]);

const MEDIA_TYPES = new Set(['photos', 'video', 'document']);

const ALLOWED_MEDIA_MIME = [
  // Images
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  // Videos
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// ── Guards ────────────────────────────────────────────────────────────────────

function isSocietyUser(user) {
  return Array.isArray(user?.roles) && user.roles.includes('society');
}

function isAdminUser(user) {
  return Array.isArray(user?.roles) && user.roles.includes('admin');
}

function isSocietyOrAdmin(user) {
  return isSocietyUser(user) || isAdminUser(user);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function ensureEvent(eventId, res) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, eventDate: true, organizerName: true, venue: true },
  });
  if (!event) {
    res.status(404).json({ success: false, message: 'Event not found' });
    return null;
  }
  return event;
}

async function ensureReport(reportId, eventId, res) {
  const report = await prisma.eventReport.findFirst({
    where: { id: reportId, eventId },
    include: { media: { orderBy: { createdAt: 'asc' } } },
  });
  if (!report) {
    res.status(404).json({ success: false, message: 'Post-event report not found' });
    return null;
  }
  return report;
}

function sanitizeAttendanceRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const totalRegistered = Number(raw.totalRegistered) || 0;
  const totalAttended   = Number(raw.totalAttended)   || 0;
  const attendeeList    = Array.isArray(raw.attendeeList) ? raw.attendeeList : [];
  return { totalRegistered, totalAttended, attendeeList };
}

function sanitizeInsights(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const parsedPlanned = raw.budgetPlannedTotal === null || raw.budgetPlannedTotal === undefined || raw.budgetPlannedTotal === ''
    ? null
    : Number(raw.budgetPlannedTotal);
  const parsedActual = raw.budgetActualTotal === null || raw.budgetActualTotal === undefined || raw.budgetActualTotal === ''
    ? null
    : Number(raw.budgetActualTotal);
  return {
    keyHighlights:           String(raw.keyHighlights           || ''),
    challengesFaced:         String(raw.challengesFaced         || ''),
    improvementsSuggested:   String(raw.improvementsSuggested   || ''),
    overallAssessment:       String(raw.overallAssessment       || ''),
    budgetPlannedTotal: Number.isFinite(parsedPlanned) ? parsedPlanned : null,
    budgetActualTotal: Number.isFinite(parsedActual) ? parsedActual : null,
  };
}

function buildReportPdfFilename(eventTitle, reportId) {
  const safeTitle = String(eventTitle || 'post-event-report')
    .replace(/[^a-z0-9\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-');
  const shortId = String(reportId || '').slice(0, 8) || 'report';
  return `${safeTitle || 'post-event-report'}-${shortId}.pdf`;
}

function writeLabelValue(doc, label, value) {
  doc.font('Helvetica-Bold').text(label, { continued: true });
  doc.font('Helvetica').text(value ?? 'N/A');
}

function writeSectionHeading(doc, title) {
  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').fontSize(13).text(title);
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10);
}

function writeMultilineField(doc, label, value) {
  doc.font('Helvetica-Bold').text(label);
  doc.font('Helvetica').text(value || 'N/A');
  doc.moveDown(0.5);
}

function streamReportPdf(res, event, report) {
  const filename = buildReportPdfFilename(event?.title, report?.id);
  const attendance = report?.attendanceRecord || {};
  const insights = report?.eventInsights || {};
  const media = Array.isArray(report?.media) ? report.media : [];
  const planned = typeof insights.budgetPlannedTotal === 'number' ? insights.budgetPlannedTotal : null;
  const actual = typeof insights.budgetActualTotal === 'number' ? insights.budgetActualTotal : null;
  const variance = planned !== null && actual !== null ? actual - planned : null;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: `${event?.title || 'Post-event report'} report`,
      Author: 'CSE Society System',
      Subject: 'Post-event report export',
    },
  });

  doc.on('error', (error) => {
    console.error('Post-event report PDF generation error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Error generating report PDF' });
    }
  });

  doc.pipe(res);

  doc.font('Helvetica-Bold').fontSize(18).text('Post-Event Report', { align: 'center' });
  doc.moveDown(1);
  doc.fontSize(10);

  writeLabelValue(doc, 'Event: ', event?.title || 'N/A');
  writeLabelValue(doc, 'Venue: ', event?.venue || 'N/A');
  writeLabelValue(
    doc,
    'Event Date: ',
    event?.eventDate ? new Date(event.eventDate).toLocaleString('en-GB') : 'N/A'
  );
  writeLabelValue(doc, 'Report Status: ', report?.status || 'N/A');
  writeLabelValue(doc, 'Created By: ', report?.createdByName || 'N/A');
  writeLabelValue(
    doc,
    'Submitted At: ',
    report?.submittedAt ? new Date(report.submittedAt).toLocaleString('en-GB') : 'N/A'
  );

  writeSectionHeading(doc, 'Attendance');
  writeLabelValue(doc, 'Total Registered: ', String(attendance.totalRegistered ?? 'N/A'));
  writeLabelValue(doc, 'Total Attended: ', String(attendance.totalAttended ?? 'N/A'));

  const attendeeList = Array.isArray(attendance.attendeeList) ? attendance.attendeeList : [];
  if (attendeeList.length) {
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('Attendee List');
    doc.font('Helvetica');
    attendeeList.forEach((entry, index) => {
      const attendanceLabel = entry?.attended ? 'Attended' : 'Not attended';
      const remarks = entry?.remarks ? ` | Remarks: ${entry.remarks}` : '';
      doc.text(`${index + 1}. ${entry?.name || 'Unnamed'} | ${entry?.email || 'No email'} | ${attendanceLabel}${remarks}`);
    });
  }

  writeSectionHeading(doc, 'Insights');
  writeMultilineField(doc, 'Key Highlights', insights.keyHighlights);
  writeMultilineField(doc, 'Challenges Faced', insights.challengesFaced);
  writeMultilineField(doc, 'Improvements Suggested', insights.improvementsSuggested);
  writeMultilineField(doc, 'Overall Assessment', insights.overallAssessment);

  writeSectionHeading(doc, 'Financial Summary');
  writeLabelValue(doc, 'Planned Total: ', planned !== null ? `BDT ${planned.toLocaleString()}` : 'N/A');
  writeLabelValue(doc, 'Actual Total: ', actual !== null ? `BDT ${actual.toLocaleString()}` : 'N/A');
  writeLabelValue(doc, 'Variance: ', variance !== null ? `BDT ${variance.toLocaleString()}` : 'N/A');
  writeMultilineField(doc, 'Expense Notes', report?.expenseNotes);

  writeSectionHeading(doc, 'Admin Review');
  writeLabelValue(doc, 'Reviewed By: ', report?.reviewedByName || 'N/A');
  writeLabelValue(
    doc,
    'Reviewed At: ',
    report?.reviewedAt ? new Date(report.reviewedAt).toLocaleString('en-GB') : 'N/A'
  );
  writeMultilineField(doc, 'Admin Notes', report?.adminNotes);

  writeSectionHeading(doc, 'Media Attachments');
  if (!media.length) {
    doc.text('No media attachments uploaded.');
  } else {
    media.forEach((item, index) => {
      doc.text(`${index + 1}. ${item.fileName || 'File'} (${item.mediaType || 'unknown'})`);
      doc.text(`   URL: ${item.fileUrl || 'N/A'}`);
    });
  }

  doc.end();
}

// ── 1. GET /api/events/:eventId/post-event-reports ───────────────────────────
// ── 0. GET /api/post-event-reports  (all reports, no eventId) ────────────────

exports.getAllReports = async (req, res) => {
  try {
    const { status } = req.query || {};
    const where = isSocietyOrAdmin(req.user) ? {} : { createdById: req.user.id };
    if (status && Object.values(REPORT_STATUS).includes(status)) {
      where.status = status;
    }

    const reports = await prisma.eventReport.findMany({
      where,
      include: {
        event: { select: { id: true, title: true, eventDate: true, venue: true } },
        media: { select: { id: true, mediaType: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, reports });
  } catch (err) {
    console.error('getAllReports error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── 0b. GET /api/post-event-reports/template  (generic Excel template) ────────

exports.downloadGenericTemplate = async (req, res) => {
  try {
    // Re-use the same Excel builder with generic placeholder data
    req.params.eventId = '__generic__';
    // Create a mock event object
    const mockEvent = {
      id: 'template',
      title: 'Your Event Name',
      eventDate: new Date(),
      venue: 'Your Venue',
      organizerName: 'Society Name',
    };

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator  = 'CSE Society System';
    workbook.created  = new Date();

    const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
    const HEADER_FONT = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
    const INSTRUCTION_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
    const NOTE_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };

    function styleHeaderRow(ws, rowNumber) {
      const row = ws.getRow(rowNumber);
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = HEADER_FILL;
        cell.font = HEADER_FONT;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top:{ style:'thin' }, bottom:{ style:'thin' }, left:{ style:'thin' }, right:{ style:'thin' } };
      });
      row.height = 26;
    }

    function addInstructionRow(ws, text) {
      const row = ws.addRow([text]);
      row.getCell(1).fill = INSTRUCTION_FILL;
      row.getCell(1).font = { italic: true, size: 10, color: { argb: 'FF856404' } };
      const cols = ws.columnCount || 8;
      if (cols > 1) ws.mergeCells(row.number, 1, row.number, cols);
      return row;
    }

    // Sheet 1: Attendance Record
    {
      const ws = workbook.addWorksheet('Attendance Record');
      ws.mergeCells('A1:H1');
      const t = ws.getCell('A1'); t.value = 'POST-EVENT ATTENDANCE RECORD'; t.font={bold:true,size:14,color:{argb:'FF1D4ED8'}}; t.alignment={horizontal:'center'};
      ws.getRow(1).height = 30;
      ws.getRow(2).values = ['Event:', '[Fill in event name]', '', 'Date:', '[Fill in date]', '', 'Venue:', '[Fill in venue]'];
      ws.getRow(3).values = ['Total Registered:', '', 'Total Attended:', '', 'Attendance Rate %:', '', '', '']; ws.getRow(3).font={bold:true};
      ws.getRow(4).values = [];
      ws.getRow(5).values = ['#','Full Name','Student ID / Reg No','Email','Department','Phone','Attended (Yes/No)','Remarks'];
      styleHeaderRow(ws, 5);
      ws.columns = [{width:5},{width:28},{width:20},{width:30},{width:22},{width:16},{width:18},{width:30}];
      for (let i=1;i<=30;i++) { const r=ws.addRow([i,'','','','','','','']); r.eachCell({includeEmpty:true},(c,col)=>{ c.border={top:{style:'thin',color:{argb:'FFD1D5DB'}},bottom:{style:'thin',color:{argb:'FFD1D5DB'}},left:{style:'thin',color:{argb:'FFD1D5DB'}},right:{style:'thin',color:{argb:'FFD1D5DB'}}}; if(col===7) c.dataValidation={type:'list',allowBlank:true,formulae:['"Yes,No"']}; }); }
    }

    // Sheet 2: Expense Summary
    {
      const ws = workbook.addWorksheet('Expense Summary');
      ws.mergeCells('A1:I1');
      const t=ws.getCell('A1'); t.value='POST-EVENT EXPENSE SUMMARY'; t.font={bold:true,size:14,color:{argb:'FF1D4ED8'}}; t.alignment={horizontal:'center'}; ws.getRow(1).height=30;
      addInstructionRow(ws,'ⓘ Fill actual spending. Variance = Actual − Planned.');
      ws.getRow(3).values=[];
      ws.getRow(4).values=['#','Expense Title','Category','Description / Vendor','Planned Amount (BDT)','Actual Amount (BDT)','Variance','Receipt / Ref No','Remarks'];
      styleHeaderRow(ws,4);
      ws.columns=[{width:5},{width:28},{width:20},{width:30},{width:22},{width:22},{width:18},{width:18},{width:28}];
      for (let i=1;i<=20;i++) { const ri=4+i; const r=ws.addRow([i,'','','','','',[{formula:`F${ri}-E${ri}`}],'','']); r.eachCell({includeEmpty:true},(c,col)=>{ c.border={top:{style:'thin',color:{argb:'FFD1D5DB'}},bottom:{style:'thin',color:{argb:'FFD1D5DB'}},left:{style:'thin',color:{argb:'FFD1D5DB'}},right:{style:'thin',color:{argb:'FFD1D5DB'}}}; if(col>=5&&col<=7) c.numFmt='#,##0.00'; }); }
      const tot=ws.addRow(['','TOTAL','','',{formula:'SUM(E5:E24)'},{formula:'SUM(F5:F24)'},{formula:'SUM(G5:G24)'},'','']); tot.font={bold:true}; tot.eachCell({includeEmpty:true},(c,col)=>{ c.fill=NOTE_FILL; if(col>=5&&col<=7) c.numFmt='#,##0.00'; });
    }

    // Sheet 3: Event Report / Insights
    {
      const ws = workbook.addWorksheet('Event Report Insights');
      ws.mergeCells('A1:D1'); const t=ws.getCell('A1'); t.value='POST-EVENT REPORT / INSIGHTS'; t.font={bold:true,size:14,color:{argb:'FF1D4ED8'}}; t.alignment={horizontal:'center'}; ws.getRow(1).height=30;
      ws.columns=[{width:32},{width:55},{width:20},{width:20}];
      ws.addRow([]);
      [['Event Title','[Fill in]'],['Event Date','[Fill in]'],['Venue','[Fill in]'],['Organizer','[Fill in]'],['Total Registered',''],['Total Attended',''],['Attendance Rate (%)',''],['Key Highlights',''],['Challenges Faced',''],['Improvements Suggested',''],['Overall Assessment',''],['Additional Notes','']].forEach(([label,value])=>{ const row=ws.addRow([label,value]); row.getCell(1).fill=HEADER_FILL; row.getCell(1).font={bold:true,color:{argb:'FFFFFFFF'}}; row.getCell(1).border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}}; row.getCell(2).alignment={wrapText:true,vertical:'top'}; row.getCell(2).border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}}; row.height=36; });
    }

    // Sheet 4: Media Archive Index
    {
      const ws = workbook.addWorksheet('Media Archive Index');
      ws.mergeCells('A1:F1'); const t=ws.getCell('A1'); t.value='MEDIA ARCHIVE INDEX'; t.font={bold:true,size:14,color:{argb:'FF1D4ED8'}}; t.alignment={horizontal:'center'}; ws.getRow(1).height=30;
      addInstructionRow(ws,'ⓘ List all photos, videos, and documents. Upload actual files via the Post-Event portal.');
      ws.getRow(3).values=[];
      ws.getRow(4).values=['#','File Name','Media Type','Description','File Size','Uploaded By'];
      styleHeaderRow(ws,4);
      ws.columns=[{width:5},{width:40},{width:18},{width:38},{width:14},{width:24}];
      for (let i=1;i<=20;i++) { const r=ws.addRow([i,'','','','','']); r.eachCell({includeEmpty:true},(c,col)=>{ c.border={top:{style:'thin',color:{argb:'FFD1D5DB'}},bottom:{style:'thin',color:{argb:'FFD1D5DB'}},left:{style:'thin',color:{argb:'FFD1D5DB'}},right:{style:'thin',color:{argb:'FFD1D5DB'}}}; if(col===3) c.dataValidation={type:'list',allowBlank:true,formulae:['"Photos,Video,Document"']}; }); }
    }

    // Sheet 5: Budget Comparison
    {
      const ws = workbook.addWorksheet('Budget Comparison');
      ws.mergeCells('A1:F1'); const t=ws.getCell('A1'); t.value='BUDGET COMPARISON (PLANNED vs ACTUAL)'; t.font={bold:true,size:14,color:{argb:'FF1D4ED8'}}; t.alignment={horizontal:'center'}; ws.getRow(1).height=30;
      addInstructionRow(ws,'ⓘ Variance = Actual − Planned. Positive = over budget.');
      ws.getRow(3).values=[];
      ws.getRow(4).values=['#','Budget Category / Item','Planned Amount (BDT)','Actual Amount (BDT)','Variance (BDT)','Notes'];
      styleHeaderRow(ws,4);
      ws.columns=[{width:5},{width:36},{width:24},{width:24},{width:20},{width:32}];
      for (let i=1;i<=15;i++) { const ri=4+i; const r=ws.addRow([i,'','','',{formula:`D${ri}-C${ri}`},'']); r.eachCell({includeEmpty:true},(c,col)=>{ c.border={top:{style:'thin',color:{argb:'FFD1D5DB'}},bottom:{style:'thin',color:{argb:'FFD1D5DB'}},left:{style:'thin',color:{argb:'FFD1D5DB'}},right:{style:'thin',color:{argb:'FFD1D5DB'}}}; if(col>=3&&col<=5) { c.numFmt='#,##0.00'; } if(col===5) c.font={color:{argb:'FFDC2626'}}; }); }
      const tot=ws.addRow(['','TOTAL',{formula:'SUM(C5:C19)'},{formula:'SUM(D5:D19)'},{formula:'SUM(E5:E19)'},'']); tot.font={bold:true}; tot.eachCell({includeEmpty:true},(c,col)=>{ c.fill=NOTE_FILL; if(col>=3&&col<=5) c.numFmt='#,##0.00'; });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="post-event-template.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('downloadGenericTemplate error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Failed to generate template' });
  }
};


exports.getReports = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await ensureEvent(eventId, res);
    if (!event) return;

    const reports = await prisma.eventReport.findMany({
      where: { eventId },
      include: { media: { select: { id: true, mediaType: true, fileName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, reports });
  } catch (err) {
    console.error('getReports error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── 2. POST /api/events/:eventId/post-event-reports ──────────────────────────

exports.createReport = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!isSocietyOrAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Only society members or admins can create reports' });
    }

    const event = await ensureEvent(eventId, res);
    if (!event) return;

    // Check for existing active report
    const existing = await prisma.eventReport.findFirst({
      where: { eventId, status: { not: REPORT_STATUS.returned } },
      select: { id: true, status: true },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A report already exists for this event (status: ${existing.status})`,
        existingReportId: existing.id,
      });
    }

    const { budgetApplicationId = null } = req.body || {};

    const report = await prisma.eventReport.create({
      data: {
        eventId,
        status: REPORT_STATUS.draft,
        createdById:   req.user.id,
        createdByName: req.user.name,
        budgetApplicationId: budgetApplicationId || null,
      },
    });

    return res.status(201).json({ success: true, report });
  } catch (err) {
    console.error('createReport error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── 3. GET /api/events/:eventId/post-event-reports/:reportId ─────────────────

exports.getReport = async (req, res) => {
  try {
    const { eventId, reportId } = req.params;
    const event  = await ensureEvent(eventId, res);
    if (!event) return;
    const report = await ensureReport(reportId, eventId, res);
    if (!report) return;

    return res.json({ success: true, report, event });
  } catch (err) {
    console.error('getReport error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── 3b. GET /api/events/:eventId/post-event-reports/:reportId/pdf ───────────

exports.downloadReportPdf = async (req, res) => {
  try {
    const { eventId, reportId } = req.params;
    const event = await ensureEvent(eventId, res);
    if (!event) return;

    const report = await prisma.eventReport.findFirst({
      where: { id: reportId, eventId },
      include: {
        media: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!report) {
      return res.status(404).json({ success: false, message: 'Post-event report not found' });
    }

    return streamReportPdf(res, event, report);
  } catch (err) {
    console.error('downloadReportPdf error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to generate report PDF' });
    }
  }
};

// ── 4. PUT /api/events/:eventId/post-event-reports/:reportId ─────────────────

exports.updateReport = async (req, res) => {
  try {
    const { eventId, reportId } = req.params;

    if (!isSocietyOrAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const event  = await ensureEvent(eventId, res);
    if (!event) return;
    const report = await ensureReport(reportId, eventId, res);
    if (!report) return;

    if (!EDITABLE_STATUSES.has(report.status)) {
      return res.status(409).json({
        success: false,
        message: `Report cannot be edited in status: ${report.status}`,
      });
    }

    const { attendanceRecord, eventInsights, expenseNotes, budgetApplicationId } = req.body || {};

    const updateData = {};
    if (attendanceRecord !== undefined) {
      updateData.attendanceRecord = sanitizeAttendanceRecord(attendanceRecord);
    }
    if (eventInsights !== undefined) {
      updateData.eventInsights = sanitizeInsights(eventInsights);
    }
    if (expenseNotes !== undefined) {
      updateData.expenseNotes = expenseNotes ? String(expenseNotes).trim() : null;
    }
    if (budgetApplicationId !== undefined) {
      updateData.budgetApplicationId = budgetApplicationId || null;
    }

    const updated = await prisma.eventReport.update({
      where: { id: reportId },
      data: updateData,
    });

    return res.json({ success: true, report: updated });
  } catch (err) {
    console.error('updateReport error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── 5. POST /api/events/:eventId/post-event-reports/:reportId/submit ─────────

exports.submitReport = async (req, res) => {
  try {
    const { eventId, reportId } = req.params;

    if (!isSocietyOrAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const event  = await ensureEvent(eventId, res);
    if (!event) return;
    const report = await ensureReport(reportId, eventId, res);
    if (!report) return;

    if (!EDITABLE_STATUSES.has(report.status)) {
      return res.status(409).json({
        success: false,
        message: `Report is already ${report.status} and cannot be submitted`,
      });
    }

    const updated = await prisma.eventReport.update({
      where: { id: reportId },
      data: {
        status:      REPORT_STATUS.submitted,
        submittedAt: new Date(),
      },
    });

    return res.json({ success: true, message: 'Report submitted for review', report: updated });
  } catch (err) {
    console.error('submitReport error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── 6. POST /api/events/:eventId/post-event-reports/:reportId/review ─────────

exports.reviewReport = async (req, res) => {
  try {
    const { eventId, reportId } = req.params;

    if (!isAdminUser(req.user)) {
      return res.status(403).json({ success: false, message: 'Only admins can review reports' });
    }

    const event  = await ensureEvent(eventId, res);
    if (!event) return;
    const report = await ensureReport(reportId, eventId, res);
    if (!report) return;

    const reviewableStatuses = new Set([REPORT_STATUS.submitted, REPORT_STATUS.underReview]);
    if (!reviewableStatuses.has(report.status)) {
      return res.status(409).json({
        success: false,
        message: `Report must be submitted or under review to perform a review action`,
      });
    }

    const action = String(req.body?.action || '').toLowerCase(); // 'approve' | 'return' | 'start_review'
    const adminNotes = req.body?.adminNotes ? String(req.body.adminNotes).trim() : null;

    let newStatus;
    let message;
    if (action === 'approve') {
      newStatus = REPORT_STATUS.approved;
      message   = 'Report approved';
    } else if (action === 'return') {
      if (!adminNotes) {
        return res.status(400).json({ success: false, message: 'adminNotes required when returning a report' });
      }
      newStatus = REPORT_STATUS.returned;
      message   = 'Report returned for revision';
    } else if (action === 'start_review') {
      newStatus = REPORT_STATUS.underReview;
      message   = 'Report marked as under review';
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action. Use approve, return, or start_review' });
    }

    const updated = await prisma.eventReport.update({
      where: { id: reportId },
      data: {
        status:          newStatus,
        adminNotes:      adminNotes,
        reviewedById:    req.user.id,
        reviewedByName:  req.user.name,
        reviewedAt:      new Date(),
      },
    });

    return res.json({ success: true, message, report: updated });
  } catch (err) {
    console.error('reviewReport error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── 7. POST /api/events/:eventId/post-event-reports/:reportId/media ───────────

exports.uploadMedia = async (req, res) => {
  try {
    const { eventId, reportId } = req.params;

    if (!isSocietyOrAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const event  = await ensureEvent(eventId, res);
    if (!event) return;
    const report = await ensureReport(reportId, eventId, res);
    if (!report) return;

    if (!EDITABLE_STATUSES.has(report.status)) {
      // clean up uploaded file
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(409).json({
        success: false,
        message: `Cannot upload media; report is ${report.status}`,
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    const mimeType = String(req.file.mimetype || '').toLowerCase();
    if (!ALLOWED_MEDIA_MIME.includes(mimeType)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ success: false, message: 'File type not allowed' });
    }

    const mediaType = String(req.body?.mediaType || '').toLowerCase();
    if (!MEDIA_TYPES.has(mediaType)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ success: false, message: 'mediaType must be photos, video, or document' });
    }

    const description = req.body?.description ? String(req.body.description).trim() : null;
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/report-media/${req.file.filename}`;

    const media = await prisma.eventReportMedia.create({
      data: {
        reportId,
        fileUrl,
        fileName:      req.file.originalname,
        mimeType,
        fileSize:      req.file.size,
        mediaType,
        description,
        uploadedById:  req.user.id,
        uploadedByName: req.user.name,
      },
    });

    return res.status(201).json({ success: true, media });
  } catch (err) {
    console.error('uploadMedia error:', err);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── 8. DELETE /api/events/:eventId/post-event-reports/:reportId/media/:mediaId

exports.deleteMedia = async (req, res) => {
  try {
    const { eventId, reportId, mediaId } = req.params;

    if (!isSocietyOrAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const event  = await ensureEvent(eventId, res);
    if (!event) return;
    const report = await ensureReport(reportId, eventId, res);
    if (!report) return;

    if (!EDITABLE_STATUSES.has(report.status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete media; report is ${report.status}`,
      });
    }

    const media = await prisma.eventReportMedia.findFirst({
      where: { id: mediaId, reportId },
    });
    if (!media) {
      return res.status(404).json({ success: false, message: 'Media not found' });
    }

    // Delete physical file
    const filePath = path.join(__dirname, '../uploads/report-media', path.basename(media.fileUrl));
    fs.unlink(filePath, () => {}); // best-effort
    await prisma.eventReportMedia.delete({ where: { id: mediaId } });

    return res.json({ success: true, message: 'Media deleted' });
  } catch (err) {
    console.error('deleteMedia error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── 9. GET /api/events/:eventId/budget-comparison ─────────────────────────────

exports.getBudgetComparison = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await ensureEvent(eventId, res);
    if (!event) return;

    // Get all approved/under_review vouchers for this event as actual expenses
    const vouchers = await prisma.voucher.findMany({
      where: { eventId },
      select: {
        id: true, title: true, description: true, amount: true, status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Get planned budget from the report's linked budget application (if any)
    // Also check any budget_breakdown application linked to the event
    const budgetApps = await prisma.societyApplication.findMany({
      where: {
        type: 'budget_breakdown',
        content: { path: ['eventId'], equals: eventId },
      },
      select: { id: true, subject: true, status: true, content: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    const budgetApp = budgetApps[0] || null;

    // Optional manual budget totals entered in post-event report insights.
    const latestReport = await prisma.eventReport.findFirst({
      where: { eventId },
      select: { eventInsights: true },
      orderBy: { createdAt: 'desc' },
    });
    const manualInsights = latestReport?.eventInsights && typeof latestReport.eventInsights === 'object'
      ? latestReport.eventInsights
      : null;
    const manualPlanned = manualInsights?.budgetPlannedTotal;
    const manualActual = manualInsights?.budgetActualTotal;
    const hasManualPlanned = manualPlanned !== null && manualPlanned !== undefined && manualPlanned !== '' && Number.isFinite(Number(manualPlanned));
    const hasManualActual = manualActual !== null && manualActual !== undefined && manualActual !== '' && Number.isFinite(Number(manualActual));

    // Parse planned amounts from budget application sections
    let plannedTotal = 0;
    let plannedSections = [];
    if (budgetApp?.content && typeof budgetApp.content === 'object') {
      const content = budgetApp.content;
      plannedTotal = Number(content.totalAmount) || 0;
      if (Array.isArray(content.sections)) {
        plannedSections = content.sections.map((s) => ({
          title:   s.title   || 'Untitled',
          amount:  Number(s.amount) || 0,
          purpose: s.purpose || '',
        }));
      }
    }

    // Calculate actual totals
    const actualTotal = vouchers.reduce((sum, v) => sum + (v.amount || 0), 0);
    const approvedTotal = vouchers
      .filter((v) => v.status === 'approved')
      .reduce((sum, v) => sum + (v.amount || 0), 0);

    const finalPlannedTotal = hasManualPlanned ? Number(manualPlanned) : plannedTotal;
    const finalActualTotal = hasManualActual ? Number(manualActual) : actualTotal;

    const variance = finalActualTotal - finalPlannedTotal;

    return res.json({
      success: true,
      budgetComparison: {
        event: { id: event.id, title: event.title },
        planned: { total: finalPlannedTotal, sections: plannedSections, source: budgetApp ? { id: budgetApp.id, subject: budgetApp.subject, status: budgetApp.status } : null },
        actual:  { total: finalActualTotal, approvedTotal, vouchers },
        variance,
        variancePercent: finalPlannedTotal > 0 ? ((variance / finalPlannedTotal) * 100).toFixed(2) : null,
        summary: variance > 0 ? 'Over budget' : variance < 0 ? 'Under budget' : 'On budget',
      },
    });
  } catch (err) {
    console.error('getBudgetComparison error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── 10. GET /api/events/:eventId/post-event-template ──────────────────────────

exports.downloadTemplate = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await ensureEvent(eventId, res);
    if (!event) return;

    const workbook = new ExcelJS.Workbook();
    workbook.creator  = 'CSE Society System';
    workbook.created  = new Date();
    workbook.modified = new Date();

    const eventTitle = event.title || 'Event';
    const safeTitle  = eventTitle.replace(/[\\/:*?"<>|]/g, '');

    const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
    const HEADER_FONT = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
    const INSTRUCTION_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
    const NOTE_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };

    function styleHeaderRow(ws, rowNumber, columns) {
      const row = ws.getRow(rowNumber);
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = HEADER_FILL;
        cell.font = HEADER_FONT;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top:    { style: 'thin', color: { argb: 'FF93C5FD' } },
          bottom: { style: 'thin', color: { argb: 'FF93C5FD' } },
          left:   { style: 'thin', color: { argb: 'FF93C5FD' } },
          right:  { style: 'thin', color: { argb: 'FF93C5FD' } },
        };
      });
      row.height = 26;
    }

    function addInstructionRow(ws, text) {
      const row = ws.addRow([text]);
      row.getCell(1).fill = INSTRUCTION_FILL;
      row.getCell(1).font = { italic: true, size: 10, color: { argb: 'FF856404' } };
      ws.mergeCells(row.number, 1, row.number, ws.columnCount || 8);
      return row;
    }

    // ── Sheet 1: Attendance Record ─────────────────────────────────────────
    {
      const ws = workbook.addWorksheet('Attendance Record');
      ws.pageSetup = { paperSize: 9, orientation: 'landscape' };

      // Title
      ws.mergeCells('A1:H1');
      const titleCell = ws.getCell('A1');
      titleCell.value = `POST-EVENT ATTENDANCE RECORD — ${eventTitle.toUpperCase()}`;
      titleCell.font  = { bold: true, size: 14, color: { argb: 'FF1D4ED8' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 30;

      // Meta info
      ws.getRow(2).values = [`Event: ${eventTitle}`, '', `Date: ${event.eventDate ? new Date(event.eventDate).toDateString() : ''}`, '', `Venue: ${event.venue || ''}`, '', '', ''];
      ws.getRow(3).values = ['Total Registered:', '', 'Total Attended:', '', 'Attendance Rate %:', '', '', ''];
      ws.getRow(3).font   = { bold: true };
      ws.getRow(4).values = []; // blank gap

      // Column headers on row 5
      ws.getRow(5).values = ['#', 'Full Name', 'Student ID / Reg No', 'Email', 'Department', 'Phone', 'Attended (Yes/No)', 'Remarks'];
      styleHeaderRow(ws, 5, 8);

      // Columns widths
      ws.columns = [
        { key: 'no',   width: 5  },
        { key: 'name', width: 28 },
        { key: 'id',   width: 20 },
        { key: 'email',width: 30 },
        { key: 'dept', width: 22 },
        { key: 'phone',width: 16 },
        { key: 'att',  width: 18 },
        { key: 'rem',  width: 30 },
      ];

      // 30 empty rows
      for (let i = 1; i <= 30; i++) {
        const row = ws.addRow([i, '', '', '', '', '', '', '']);
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          cell.border = {
            top:   { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom:{ style: 'thin', color: { argb: 'FFD1D5DB' } },
            left:  { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          };
          if (col === 7) {
            // Dropdown for Attended
            cell.dataValidation = { type: 'list', allowBlank: true, formulae: ['"Yes,No"'] };
          }
        });
      }
    }

    // ── Sheet 2: Expense Summary ──────────────────────────────────────────
    {
      const ws = workbook.addWorksheet('Expense Summary');
      ws.pageSetup = { paperSize: 9, orientation: 'landscape' };

      ws.mergeCells('A1:I1');
      const t = ws.getCell('A1');
      t.value = `POST-EVENT EXPENSE SUMMARY — ${eventTitle.toUpperCase()}`;
      t.font  = { bold: true, size: 14, color: { argb: 'FF1D4ED8' } };
      t.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 30;

      addInstructionRow(ws, 'ⓘ Fill in actual spending for each expense item. Compare against the approved budget application columns.');
      ws.getRow(3).values = [];

      const headerRow = ws.getRow(4);
      headerRow.values = ['#', 'Expense Title', 'Category', 'Description / Vendor', 'Planned Amount (BDT)', 'Actual Amount (BDT)', 'Variance', 'Receipt / Ref No', 'Remarks'];
      styleHeaderRow(ws, 4, 9);

      ws.columns = [
        { key: 'no',      width: 5  },
        { key: 'title',   width: 28 },
        { key: 'cat',     width: 20 },
        { key: 'desc',    width: 30 },
        { key: 'planned', width: 22 },
        { key: 'actual',  width: 22 },
        { key: 'var',     width: 18 },
        { key: 'ref',     width: 18 },
        { key: 'rem',     width: 28 },
      ];

      for (let i = 1; i <= 20; i++) {
        const rowIdx = 4 + i;
        const row = ws.addRow([i, '', '', '', '', '', { formula: `F${rowIdx}-E${rowIdx}` }, '', '']);
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          cell.border = {
            top:   { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom:{ style: 'thin', color: { argb: 'FFD1D5DB' } },
            left:  { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          };
          if (col === 5 || col === 6 || col === 7) {
            cell.numFmt = '#,##0.00';
          }
        });
      }

      // Total row
      const totalRow = ws.addRow(['', 'TOTAL', '', '', { formula: `SUM(E5:E24)` }, { formula: `SUM(F5:F24)` }, { formula: `SUM(G5:G24)` }, '', '']);
      totalRow.font = { bold: true };
      totalRow.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.fill = NOTE_FILL;
        if (col === 5 || col === 6 || col === 7) cell.numFmt = '#,##0.00';
      });
    }

    // ── Sheet 3: Event Report / Insights ─────────────────────────────────
    {
      const ws = workbook.addWorksheet('Event Report Insights');

      ws.mergeCells('A1:D1');
      const t = ws.getCell('A1');
      t.value = `POST-EVENT REPORT / INSIGHTS — ${eventTitle.toUpperCase()}`;
      t.font  = { bold: true, size: 14, color: { argb: 'FF1D4ED8' } };
      t.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 30;

      ws.columns = [{ width: 32 }, { width: 55 }, { width: 20 }, { width: 20 }];

      const fields = [
        ['Event Title',           eventTitle,                        false],
        ['Event Date',            event.eventDate ? new Date(event.eventDate).toDateString() : '', false],
        ['Venue',                 event.venue || '',                 false],
        ['Organizer',             event.organizerName || '',         false],
        ['Total Registered',      '',                                true],
        ['Total Attended',        '',                                true],
        ['Attendance Rate (%)',   '',                                true],
        ['Key Highlights',        '',                                true],
        ['Challenges Faced',      '',                                true],
        ['Improvements Suggested','',                                true],
        ['Overall Assessment',    '',                                true],
        ['Additional Notes',      '',                                true],
      ];

      ws.addRow([]);
      fields.forEach(([label, value, editable]) => {
        const row = ws.addRow([label, value]);
        const labelCell = row.getCell(1);
        const valueCell = row.getCell(2);
        labelCell.font  = { bold: true };
        labelCell.fill  = HEADER_FILL;
        labelCell.font  = { bold: true, color: { argb: 'FFFFFFFF' } };
        labelCell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        valueCell.alignment = { wrapText: true, vertical: 'top' };
        valueCell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        if (editable) valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9DB' } };
        row.height = 36;
      });
    }

    // ── Sheet 4: Media Archive Index ─────────────────────────────────────
    {
      const ws = workbook.addWorksheet('Media Archive Index');

      ws.mergeCells('A1:F1');
      const t = ws.getCell('A1');
      t.value = `MEDIA ARCHIVE INDEX — ${eventTitle.toUpperCase()}`;
      t.font  = { bold: true, size: 14, color: { argb: 'FF1D4ED8' } };
      t.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 30;

      addInstructionRow(ws, 'ⓘ List all photos, videos, and documents. Upload actual files via the Post-Event portal.');
      ws.getRow(3).values = [];

      ws.getRow(4).values = ['#', 'File Name', 'Media Type', 'Description', 'File Size', 'Uploaded By'];
      styleHeaderRow(ws, 4, 6);

      ws.columns = [
        { width: 5  },
        { width: 40 },
        { width: 18 },
        { width: 38 },
        { width: 14 },
        { width: 24 },
      ];

      for (let i = 1; i <= 20; i++) {
        const row = ws.addRow([i, '', '', '', '', '']);
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          cell.border = { top: { style: 'thin', color: { argb: 'FFD1D5DB' } }, bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }, left: { style: 'thin', color: { argb: 'FFD1D5DB' } }, right: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
          if (col === 3) cell.dataValidation = { type: 'list', allowBlank: true, formulae: ['"Photos,Video,Document"'] };
        });
      }
    }

    // ── Sheet 5: Budget Comparison ────────────────────────────────────────
    {
      const ws = workbook.addWorksheet('Budget Comparison');

      ws.mergeCells('A1:F1');
      const t = ws.getCell('A1');
      t.value = `BUDGET COMPARISON (PLANNED vs ACTUAL) — ${eventTitle.toUpperCase()}`;
      t.font  = { bold: true, size: 14, color: { argb: 'FF1D4ED8' } };
      t.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 30;

      addInstructionRow(ws, 'ⓘ Compare planned budget amounts from the approved budget application against actual spending. Variance = Actual − Planned.');
      ws.getRow(3).values = [];

      ws.getRow(4).values = ['#', 'Budget Category / Item', 'Planned Amount (BDT)', 'Actual Amount (BDT)', 'Variance (BDT)', 'Notes'];
      styleHeaderRow(ws, 4, 6);

      ws.columns = [
        { width: 5  },
        { width: 36 },
        { width: 24 },
        { width: 24 },
        { width: 20 },
        { width: 32 },
      ];

      for (let i = 1; i <= 15; i++) {
        const rowIdx = 4 + i;
        const row = ws.addRow([i, '', '', '', { formula: `D${rowIdx}-C${rowIdx}` }, '']);
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          cell.border = { top: { style: 'thin', color: { argb: 'FFD1D5DB' } }, bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }, left: { style: 'thin', color: { argb: 'FFD1D5DB' } }, right: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
          if (col === 3 || col === 4 || col === 5) cell.numFmt = '#,##0.00';
          if (col === 5) cell.font = { color: { argb: 'FFDC2626' } };
        });
      }

      const totalRow = ws.addRow(['', 'TOTAL', { formula: 'SUM(C5:C19)' }, { formula: 'SUM(D5:D19)' }, { formula: 'SUM(E5:E19)' }, '']);
      totalRow.font = { bold: true };
      totalRow.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.fill = NOTE_FILL;
        if (col === 3 || col === 4 || col === 5) cell.numFmt = '#,##0.00';
      });

      // Legend
      ws.addRow([]);
      const leg1 = ws.addRow(['Variance > 0 = Over budget (actual > planned)']);
      leg1.getCell(1).font = { italic: true, color: { argb: 'FFDC2626' }, size: 10 };
      const leg2 = ws.addRow(['Variance < 0 = Under budget (actual < planned)']);
      leg2.getCell(1).font = { italic: true, color: { argb: 'FF16A34A' }, size: 10 };
      const leg3 = ws.addRow(['Variance = 0 = On budget']);
      leg3.getCell(1).font = { italic: true, color: { argb: 'FF1D4ED8' }, size: 10 };
    }

    // Stream workbook as attachment
    const safeName = `post-event-template-${safeTitle.substring(0, 40).replace(/\s+/g, '-')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('downloadTemplate error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to generate template' });
    }
  }
};
