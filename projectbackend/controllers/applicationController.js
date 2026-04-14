const prisma = require('../config/prisma');
const PDFDocument = require('pdfkit');
const { createAuditLog } = require('./auditLogController');

const BUDGET_TYPE = 'budget_breakdown';

const isSocietyUser = (user) => Array.isArray(user?.roles) && user.roles.includes('society');
const isAdminUser = (user) => Array.isArray(user?.roles) && user.roles.includes('admin');

const isUpcomingEvent = (event) => {
  if (!event?.eventDate || !event?.startTime) return false;

  const [hour, minute] = String(event.startTime).split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return false;

  const eventStart = new Date(event.eventDate);
  eventStart.setHours(hour, minute, 0, 0);

  return eventStart.getTime() > Date.now();
};

const toNumber = (value) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const validateBudgetSections = (sections) => {
  if (!Array.isArray(sections) || sections.length === 0) {
    return 'At least one budget section is required';
  }

  let hasPositiveAmount = false;

  for (const section of sections) {
    if (!section || typeof section !== 'object') {
      return 'Each budget section must be a valid object';
    }

    const title = typeof section.title === 'string' ? section.title.trim() : '';
    if (!title) {
      return 'Each budget section must include a title';
    }

    const amount = toNumber(section.amount);
    if (Number.isNaN(amount) || amount < 0) {
      return 'Each budget section amount must be a non-negative number';
    }

    if (amount > 0) {
      hasPositiveAmount = true;
    }
  }

  if (!hasPositiveAmount) {
    return 'At least one budget section must have an amount greater than 0';
  }

  return null;
};

const PDF_SUPPORTED_TYPES = new Set(['fund_withdrawal', 'event_approval']);

const normalizeText = (value, fallback = '___________') => {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();
  return text || fallback;
};

const formatLetterDate = (value) => {
  if (!value) return '___________';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return normalizeText(value);
  }
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const buildSubject = (applicationType, content) => {
  if (applicationType === 'fund_withdrawal') {
    const title = normalizeText(content.eventTitle, 'the event');
    return `Application for withdrawal of allocated funds for ${title}`;
  }

  const title = normalizeText(content.eventTitle, 'the proposed event');
  return `Application for approval of ${title}`;
};

const buildPdfFilename = (application) => {
  const safeType = String(application.type || 'application').replace(/[^a-z0-9_-]+/gi, '-');
  const shortId = String(application.id || '').slice(0, 8);
  return `${safeType}-${shortId || 'document'}.pdf`;
};

const ensurePdfSupportedType = (application) => {
  if (!PDF_SUPPORTED_TYPES.has(application.type)) {
    return false;
  }

  return true;
};

const addFundWithdrawalBody = (doc, content) => {
  const eventDate = formatLetterDate(content.eventDate);
  const eventTitle = normalizeText(content.eventTitle, 'seminar/event');
  const chiefGuestName = normalizeText(content.chiefGuestName, '');
  const chiefGuestDesignation = normalizeText(content.chiefGuestDesignation, '');
  const chiefGuestOrganization = normalizeText(content.chiefGuestOrganization, '');
  const amount = normalizeText(content.amount, '___');
  const usedFor = normalizeText(content.usedFor);

  const chiefGuestLine = chiefGuestName
    ? ` The chief guest of the seminar was ${chiefGuestName}${
        chiefGuestDesignation ? `, ${chiefGuestDesignation}` : ''
      }${chiefGuestOrganization ? ` at ${chiefGuestOrganization}` : ''}.`
    : '';

  doc.text('Sir,', { align: 'left' });
  doc.moveDown(0.8);

  doc.text(
    `With due respect, I would like to state that on ${eventDate}, a seminar on "${eventTitle}" was organized by the CSE Society.${chiefGuestLine} A total of ${amount} BDT was used to buy ${usedFor} which need to be withdrawn.`,
    { align: 'justify' }
  );
  doc.moveDown(0.8);

  doc.text(
    'Therefore, I humbly request you to kindly grant me permission to withdraw the said amount from the approved budget.',
    { align: 'justify' }
  );
};

const addEventApprovalBody = (doc, content) => {
  const eventTitle = normalizeText(content.eventTitle);
  const proposedDate = formatLetterDate(content.proposedDate);
  const venue = normalizeText(content.venue);
  const expectedAttendees = normalizeText(content.expectedAttendees, '');
  const description = normalizeText(content.description, '');
  const budget = normalizeText(content.budget, '');

  doc.text('Sir/Madam,', { align: 'left' });
  doc.moveDown(0.8);

  doc.text(
    `With due respect, I would like to seek approval for the event "${eventTitle}" proposed to be held on ${proposedDate} at ${venue}.${
      expectedAttendees ? ` The expected number of attendees is ${expectedAttendees}.` : ''
    }${budget ? ` An estimated budget of ${budget} BDT is required for this purpose.` : ''}`,
    { align: 'justify' }
  );

  if (description) {
    doc.moveDown(0.8);
    doc.text(description, { align: 'justify' });
  }

  doc.moveDown(0.8);
  doc.text(
    'I humbly request your kind approval and necessary support for the successful organizing of the event.',
    { align: 'justify' }
  );
};

const writeApplicationLetterPdf = (doc, application) => {
  const content = application.content && typeof application.content === 'object' ? application.content : {};
  const recipientTitle = normalizeText(content.recipientTitle, 'The President');
  const throughTitle = normalizeText(content.throughTitle, '');
  const subject = buildSubject(application.type, content);

  doc.font('Helvetica').fontSize(12);

  doc.text(`Date: ${formatLetterDate(content.applicationDate || application.createdAt)}`);
  doc.moveDown(1);

  doc.text('To');
  doc.text(`${recipientTitle},`);
  doc.text('CSE Society, SUST, Sylhet');
  doc.moveDown(0.8);

  if (application.type === 'fund_withdrawal' && throughTitle && throughTitle !== 'None') {
    doc.text('Through');
    doc.text(`${throughTitle},`);
    doc.text('CSE Society, SUST, Sylhet');
    doc.moveDown(0.8);
  }

  doc.font('Helvetica-Bold');
  doc.text(`Subject: ${subject}.`, { underline: true });
  doc.font('Helvetica');
  doc.moveDown(1);

  if (application.type === 'fund_withdrawal') {
    addFundWithdrawalBody(doc, content);
  } else {
    addEventApprovalBody(doc, content);
  }

  doc.moveDown(1.2);
  doc.text('Sincerely,');
  doc.moveDown(1.2);

  const applicantName = normalizeText(content.applicantName);
  const applicantPosition = normalizeText(content.applicantPosition, '');
  const registrationNumber = normalizeText(content.registrationNumber, '');
  const phoneNumber = normalizeText(content.phoneNumber, '');

  doc.font('Helvetica-Bold').text(applicantName);
  doc.font('Helvetica');
  doc.text(`${applicantPosition ? `${applicantPosition}, ` : ''}CSE Society, SUST`);

  if (registrationNumber) {
    doc.text(`Registration No.: ${registrationNumber}`);
  }
  if (phoneNumber) {
    doc.text(`Phone No: ${phoneNumber}`);
  }

  if (application.type === 'fund_withdrawal' && content.attachments) {
    doc.moveDown(1);
    doc.font('Helvetica-Bold').text('Attachment:');
    doc.font('Helvetica').text(`1. ${normalizeText(content.attachments)}`);
  }
};

const streamApplicationPdf = (res, application, { downloadMode = false } = {}) => {
  const filename = buildPdfFilename(application);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${downloadMode ? 'attachment' : 'inline'}; filename="${filename}"`
  );

  const doc = new PDFDocument({
    size: 'A4',
    margin: 56,
    info: {
      Title: application.subject,
      Author: 'CSE Society System',
      Subject: application.type,
    },
  });

  doc.on('error', (error) => {
    console.error('PDF generation error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error generating PDF',
      });
    }
  });

  doc.pipe(res);
  writeApplicationLetterPdf(doc, application);
  doc.end();
};

// ─── Create a budget breakdown draft (society only) ────────────────
exports.createBudgetBreakdown = async (req, res) => {
  try {
    const {
      eventId,
      sections,
      calculatedTotal,
      overrideAmount,
      totalAmount,
    } = req.body;

    if (!isSocietyUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only society members can create budget breakdowns',
      });
    }

    if (!eventId || typeof eventId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'eventId is required',
      });
    }

    const sectionsValidationError = validateBudgetSections(sections);
    if (sectionsValidationError) {
      return res.status(400).json({
        success: false,
        message: sectionsValidationError,
      });
    }

    const normalizedCalculatedTotal = toNumber(calculatedTotal);
    const normalizedTotalAmount = toNumber(totalAmount);
    const normalizedOverrideAmount =
      overrideAmount === null || overrideAmount === undefined || overrideAmount === ''
        ? null
        : toNumber(overrideAmount);

    if (Number.isNaN(normalizedCalculatedTotal) || normalizedCalculatedTotal < 0) {
      return res.status(400).json({
        success: false,
        message: 'calculatedTotal must be a non-negative number',
      });
    }

    if (Number.isNaN(normalizedTotalAmount) || normalizedTotalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'totalAmount must be greater than 0',
      });
    }

    if (normalizedOverrideAmount !== null && (Number.isNaN(normalizedOverrideAmount) || normalizedOverrideAmount <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'overrideAmount must be greater than 0 when provided',
      });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        eventDate: true,
        startTime: true,
        venue: true,
        organizerName: true,
      },
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    if (!isUpcomingEvent(event)) {
      return res.status(400).json({
        success: false,
        message: 'Budget breakdown can only be created for upcoming events',
      });
    }

    const content = {
      eventId: event.id,
      eventTitle: event.title,
      eventDate: event.eventDate,
      eventStartTime: event.startTime,
      eventVenue: event.venue,
      organizerName: event.organizerName,
      sections,
      calculatedTotal: normalizedCalculatedTotal,
      overrideAmount: normalizedOverrideAmount,
      totalAmount: normalizedTotalAmount,
    };

    const application = await prisma.societyApplication.create({
      data: {
        type: BUDGET_TYPE,
        subject: `Budget breakdown for ${event.title}`,
        content,
        createdById: req.user.id,
        createdByName: req.user.name,
        status: 'draft',
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Budget breakdown draft created',
      application,
    });
  } catch (error) {
    console.error('Create budget breakdown error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating budget breakdown',
      error: error.message,
    });
  }
};

// ─── Get all budget breakdowns ─────────────────────────────────────
exports.getBudgetBreakdowns = async (req, res) => {
  try {
    const isSociety = isSocietyUser(req.user);
    const isAdmin = isAdminUser(req.user);

    if (!isSociety && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view budget breakdowns',
      });
    }

    const where = { type: BUDGET_TYPE };

    const applications = await prisma.societyApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      applications,
    });
  } catch (error) {
    console.error('Get budget breakdowns error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching budget breakdowns',
      error: error.message,
    });
  }
};

// ─── Create a new application (saved as draft) ──────────────────────
exports.createApplication = async (req, res) => {
  try {
    const { type, subject, content } = req.body;

    if (!type || !subject) {
      return res.status(400).json({
        success: false,
        message: 'Application type and subject are required',
      });
    }

    if (!req.user.roles.includes('society')) {
      return res.status(403).json({
        success: false,
        message: 'Only society members can create applications',
      });
    }

    const application = await prisma.societyApplication.create({
      data: {
        type,
        subject,
        content: content || {},
        createdById: req.user.id,
        createdByName: req.user.name,
        status: 'draft',
      },
    });

    res.status(201).json({
      success: true,
      message: 'Application saved as draft',
      application,
    });
  } catch (error) {
    console.error('Create application error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating application',
      error: error.message,
    });
  }
};

// ─── Get applications (society → all; admin → all) ─────────────────
exports.getApplications = async (req, res) => {
  try {
    const isSociety = isSocietyUser(req.user);
    const isAdmin = isAdminUser(req.user);

    if (!isSociety && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    const { type, status } = req.query;
    const where = {
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
    };

    const applications = await prisma.societyApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, applications });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching applications',
      error: error.message,
    });
  }
};

// ─── Forward submitted application to admin review queue ────────────
exports.forwardToAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.societyApplication.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const isSociety = req.user.roles.includes('society');
    const isAdmin = req.user.roles.includes('admin');
    if (!isSociety && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (existing.status !== 'submitted') {
      return res.status(400).json({
        success: false,
        message: 'Only submitted applications can be forwarded to admin review',
      });
    }

    const application = await prisma.societyApplication.update({
      where: { id },
      data: { status: 'under_review' },
    });

    res.json({ success: true, message: 'Application forwarded to admin', application });
  } catch (error) {
    console.error('Forward application error:', error);
    res.status(500).json({
      success: false,
      message: 'Error forwarding application',
      error: error.message,
    });
  }
};

// ─── Approve application (admin only) ───────────────────────────────
exports.approveApplication = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.societyApplication.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (!req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Only admin can approve applications',
      });
    }

    if (!['submitted', 'under_review'].includes(existing.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only submitted or under review applications can be approved',
      });
    }

    const application = await prisma.societyApplication.update({
      where: { id },
      data: { status: 'approved' },
    });

    // Log audit trail
    createAuditLog({
      action: 'application_approved',
      module: 'applications',
      description: `Society application approved for society: ${existing.societyId}`,
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorName: req.user.name,
      actorRole: 'admin',
      resourceId: id,
      resourceType: 'SocietyApplication',
      resourceName: `Application ${existing.societyId}`,
      previousValue: existing.status,
      newValue: 'approved',
      metadata: {
        societyId: existing.societyId,
        approvedAt: new Date().toISOString(),
      }
    }).catch(err => console.error('Audit log error:', err));

    res.json({ success: true, message: 'Application approved', application });
  } catch (error) {
    console.error('Approve application error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving application',
      error: error.message,
    });
  }
};

// ─── Return application to society with admin note (admin only) ─────
exports.returnApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;

    if (!adminNotes || !adminNotes.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Admin note is required to return an application',
      });
    }

    const existing = await prisma.societyApplication.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (!req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Only admin can return applications',
      });
    }

    if (!['submitted', 'under_review'].includes(existing.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only submitted or under review applications can be returned',
      });
    }

    const application = await prisma.societyApplication.update({
      where: { id },
      data: {
        status: 'returned',
        adminNotes: adminNotes.trim(),
      },
    });

    // Log audit trail
    createAuditLog({
      action: 'application_returned',
      module: 'applications',
      description: `Society application returned for society: ${existing.societyId}. Notes: ${adminNotes.trim()}`,
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorName: req.user.name,
      actorRole: 'admin',
      resourceId: id,
      resourceType: 'SocietyApplication',
      resourceName: `Application ${existing.societyId}`,
      previousValue: existing.status,
      newValue: 'returned',
      metadata: {
        societyId: existing.societyId,
        adminNotes: adminNotes.trim(),
        returnedAt: new Date().toISOString(),
      }
    }).catch(err => console.error('Audit log error:', err));

    res.json({ success: true, message: 'Application returned to society member', application });
  } catch (error) {
    console.error('Return application error:', error);
    res.status(500).json({
      success: false,
      message: 'Error returning application',
      error: error.message,
    });
  }
};

// ─── Get single application by ID ───────────────────────────────────
exports.getApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await prisma.societyApplication.findUnique({ where: { id } });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    // Any society member or admin can view any application
    const isSociety = req.user.roles.includes('society');
    const isAdmin = req.user.roles.includes('admin');
    if (!isSociety && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.json({ success: true, application });
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching application',
      error: error.message,
    });
  }
};

// ─── Export application as PDF (admin or owner society member) ─────
exports.exportApplicationPdf = async (req, res) => {
  try {
    const { id } = req.params;

    const isAdmin = req.user.roles.includes('admin');
    const isSociety = req.user.roles.includes('society');

    if (!isAdmin && !isSociety) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to export application PDFs',
      });
    }

    const application = await prisma.societyApplication.findUnique({ where: { id } });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (!isAdmin && application.createdById !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only export your own applications',
      });
    }

    if (!ensurePdfSupportedType(application)) {
      return res.status(400).json({
        success: false,
        message: 'PDF export currently supports fund withdrawal and event approval applications only',
      });
    }

    const downloadMode = req.query.download === '1' || req.query.download === 'true';
    streamApplicationPdf(res, application, { downloadMode });
  } catch (error) {
    console.error('Export application PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting application PDF',
      error: error.message,
    });
  }
};

// ─── Print application as PDF (admin only) ─────────────────────────
exports.printApplicationPdf = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin can print applications',
      });
    }

    const application = await prisma.societyApplication.findUnique({ where: { id } });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (!ensurePdfSupportedType(application)) {
      return res.status(400).json({
        success: false,
        message: 'PDF print currently supports fund withdrawal and event approval applications only',
      });
    }

    streamApplicationPdf(res, application, { downloadMode: false });
  } catch (error) {
    console.error('Print application PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Error printing application PDF',
      error: error.message,
    });
  }
};

// ─── Update application (any status; any society member can edit) ──
exports.updateApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, subject, content } = req.body;

    const existing = await prisma.societyApplication.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    // Any society member (or admin) can edit, not just the original author
    const isSociety = req.user.roles.includes('society');
    const isAdmin = req.user.roles.includes('admin');
    if (!isSociety && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this application',
      });
    }

    const effectiveType = type !== undefined ? type : existing.type;

    if (effectiveType === BUDGET_TYPE && content !== undefined) {
      const sectionsValidationError = validateBudgetSections(content.sections);
      if (sectionsValidationError) {
        return res.status(400).json({
          success: false,
          message: sectionsValidationError,
        });
      }

      const normalizedTotalAmount = toNumber(content.totalAmount);
      if (Number.isNaN(normalizedTotalAmount) || normalizedTotalAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'totalAmount must be greater than 0',
        });
      }
    }

    const application = await prisma.societyApplication.update({
      where: { id },
      data: {
        ...(type !== undefined && { type }),
        ...(subject !== undefined && { subject }),
        ...(content !== undefined && { content }),
        ...(effectiveType === BUDGET_TYPE && { status: 'draft' }),
      },
    });

    res.json({ success: true, message: 'Application updated', application });
  } catch (error) {
    console.error('Update application error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating application',
      error: error.message,
    });
  }
};

// ─── Submit application to admin (any society member can submit) ────
exports.submitApplication = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.societyApplication.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const isSociety = req.user.roles.includes('society');
    const isAdmin = req.user.roles.includes('admin');
    if (!isSociety && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to submit this application',
      });
    }

    if (existing.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Application has already been submitted',
      });
    }

    const application = await prisma.societyApplication.update({
      where: { id },
      data: { status: 'submitted' },
    });

    res.json({
      success: true,
      message: 'Application submitted to admin',
      application,
    });
  } catch (error) {
    console.error('Submit application error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting application',
      error: error.message,
    });
  }
};

// ─── Add a member note ───────────────────────────────────────────────
exports.addNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Note text is required' });
    }

    const existing = await prisma.societyApplication.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const isSociety = req.user.roles.includes('society');
    const isAdmin = req.user.roles.includes('admin');
    if (!isSociety && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const newNote = {
      authorId: req.user.id,
      authorName: req.user.name,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    const currentNotes = Array.isArray(existing.memberNotes) ? existing.memberNotes : [];

    const application = await prisma.societyApplication.update({
      where: { id },
      data: { memberNotes: [...currentNotes, newNote] },
    });

    res.json({ success: true, message: 'Note added', application });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding note',
      error: error.message,
    });
  }
};
