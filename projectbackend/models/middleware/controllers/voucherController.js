const prisma = require('../config/prisma');

const BUDGET_TYPE = 'budget_breakdown';

const VOUCHER_STATUS = {
  draft: 'draft',
  submitted: 'submitted',
  underReview: 'under_review',
  approved: 'approved',
  rejected: 'rejected',
};

const ALLOWED_MEMBER_MUTATION_STATUSES = new Set([VOUCHER_STATUS.draft, VOUCHER_STATUS.submitted]);
const REVIEWABLE_STATUSES = new Set([VOUCHER_STATUS.submitted, VOUCHER_STATUS.underReview]);

function isAdminUser(user) {
  return Array.isArray(user?.roles) && user.roles.includes('admin');
}

function isSocietyUser(user) {
  return Array.isArray(user?.roles) && user.roles.includes('society');
}

function isAllowedReceiptMime(mimeType) {
  return ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'].includes(
    String(mimeType || '').toLowerCase()
  );
}

function isReceiptUploadUrl(fileUrl) {
  return String(fileUrl || '').includes('/uploads/receipts/');
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function toPositiveAmount(value) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
}

function extractBudgetTotal(application) {
  const content = application?.content && typeof application.content === 'object' ? application.content : {};
  const totalAmount = Number(content.totalAmount);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return null;
  }
  return totalAmount;
}

function extractBudgetEventId(application) {
  const content = application?.content && typeof application.content === 'object' ? application.content : {};
  const eventId = content.eventId;
  return typeof eventId === 'string' ? eventId : null;
}

async function ensureEventExists(eventId) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, eventDate: true },
  });

  return event;
}

async function validateBudgetApplicationLink(eventId, budgetApplicationId) {
  if (!budgetApplicationId) {
    return { budgetApplication: null, message: null };
  }

  const budgetApplication = await prisma.societyApplication.findUnique({
    where: { id: budgetApplicationId },
    select: {
      id: true,
      type: true,
      status: true,
      subject: true,
      content: true,
    },
  });

  if (!budgetApplication) {
    return { budgetApplication: null, message: 'Linked budget application not found' };
  }

  if (budgetApplication.type !== BUDGET_TYPE) {
    return {
      budgetApplication: null,
      message: 'Linked application must be a budget breakdown application',
    };
  }

  const budgetEventId = extractBudgetEventId(budgetApplication);
  if (!budgetEventId || budgetEventId !== eventId) {
    return {
      budgetApplication: null,
      message: 'Budget application does not belong to the selected event',
    };
  }

  return { budgetApplication, message: null };
}

function buildVoucherInclude() {
  return {
    event: {
      select: {
        id: true,
        title: true,
        eventDate: true,
      },
    },
    createdBy: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    reviewedBy: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    budgetApplication: {
      select: {
        id: true,
        type: true,
        status: true,
        subject: true,
        content: true,
      },
    },
  };
}

async function canMutateVoucher(user, voucher) {
  if (isAdminUser(user)) {
    return true;
  }

  if (!isSocietyUser(user)) {
    return false;
  }

  return ALLOWED_MEMBER_MUTATION_STATUSES.has(voucher.status);
}

exports.createVoucher = async (req, res) => {
  try {
    if (!isAdminUser(req.user) && !isSocietyUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin and society members can create vouchers',
      });
    }

    const title = normalizeString(req.body.title);
    const description = normalizeNullableString(req.body.description);
    const eventId = normalizeString(req.body.eventId);
    const budgetApplicationId = normalizeNullableString(req.body.budgetApplicationId);
    const receiptFileUrl = normalizeString(req.body.receiptFileUrl || req.body.fileUrl);
    const receiptFileName = normalizeString(req.body.receiptFileName || req.body.fileName);
    const receiptMimeType = normalizeString(req.body.receiptMimeType || req.body.mimeType).toLowerCase();
    const amount = toPositiveAmount(req.body.amount);

    if (!title || !eventId || amount === null || !receiptFileUrl || !receiptFileName || !receiptMimeType) {
      return res.status(400).json({
        success: false,
        message:
          'title, eventId, amount, receiptFileUrl, receiptFileName and receiptMimeType are required',
      });
    }

    if (!isAllowedReceiptMime(receiptMimeType)) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported receipt file type. Allowed: PDF, JPG, PNG',
      });
    }

    if (!isReceiptUploadUrl(receiptFileUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Receipt URL must be from uploaded receipts storage',
      });
    }

    const event = await ensureEventExists(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    const { message: budgetError } = await validateBudgetApplicationLink(eventId, budgetApplicationId);
    if (budgetError) {
      return res.status(400).json({ success: false, message: budgetError });
    }

    const voucher = await prisma.voucher.create({
      data: {
        title,
        description,
        amount,
        eventId,
        budgetApplicationId,
        receiptFileUrl,
        receiptFileName,
        receiptMimeType,
        status: VOUCHER_STATUS.draft,
        createdById: req.user.id,
      },
      include: buildVoucherInclude(),
    });

    return res.status(201).json({
      success: true,
      message: 'Voucher created successfully',
      voucher,
    });
  } catch (error) {
    console.error('Create voucher error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating voucher',
      error: error.message,
    });
  }
};

exports.getVouchers = async (req, res) => {
  try {
    const admin = isAdminUser(req.user);
    const society = isSocietyUser(req.user);

    if (!admin && !society) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view vouchers',
      });
    }

    const where = {};

    const status = normalizeString(req.query.status);
    const eventId = normalizeString(req.query.eventId);
    const budgetApplicationId = normalizeString(req.query.budgetApplicationId);
    const createdById = normalizeString(req.query.createdById);
    const fromDate = normalizeString(req.query.fromDate);
    const toDate = normalizeString(req.query.toDate);

    if (status) {
      where.status = status;
    }

    if (eventId) {
      where.eventId = eventId;
    }

    if (budgetApplicationId) {
      where.budgetApplicationId = budgetApplicationId;
    }

    if (admin && createdById) {
      where.createdById = createdById;
    }

    if (fromDate || toDate) {
      const createdAt = {};

      if (fromDate) {
        const parsed = new Date(fromDate);
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid fromDate' });
        }
        createdAt.gte = parsed;
      }

      if (toDate) {
        const parsed = new Date(toDate);
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid toDate' });
        }
        createdAt.lte = parsed;
      }

      where.createdAt = createdAt;
    }

    const vouchers = await prisma.voucher.findMany({
      where,
      include: buildVoucherInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, vouchers });
  } catch (error) {
    console.error('Get vouchers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching vouchers',
      error: error.message,
    });
  }
};

exports.getVoucherById = async (req, res) => {
  try {
    const { id } = req.params;

    const voucher = await prisma.voucher.findUnique({
      where: { id },
      include: buildVoucherInclude(),
    });

    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Voucher not found' });
    }

    const admin = isAdminUser(req.user);
    const society = isSocietyUser(req.user);

    if (!admin && !society) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this voucher',
      });
    }

    return res.json({ success: true, voucher });
  } catch (error) {
    console.error('Get voucher by id error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching voucher',
      error: error.message,
    });
  }
};

exports.updateVoucher = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.voucher.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Voucher not found' });
    }

    if (!(await canMutateVoucher(req.user, existing))) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this voucher in its current state',
      });
    }

    const data = {};

    if (Object.prototype.hasOwnProperty.call(req.body, 'title')) {
      const title = normalizeString(req.body.title);
      if (!title) {
        return res.status(400).json({ success: false, message: 'title cannot be empty' });
      }
      data.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
      data.description = normalizeNullableString(req.body.description);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'amount')) {
      const amount = toPositiveAmount(req.body.amount);
      if (amount === null) {
        return res.status(400).json({ success: false, message: 'amount must be a positive number' });
      }
      data.amount = amount;
    }

    const eventIdFromBody = Object.prototype.hasOwnProperty.call(req.body, 'eventId')
      ? normalizeString(req.body.eventId)
      : null;

    if (eventIdFromBody !== null) {
      if (!eventIdFromBody) {
        return res.status(400).json({ success: false, message: 'eventId cannot be empty' });
      }

      const event = await ensureEventExists(eventIdFromBody);
      if (!event) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }

      data.eventId = eventIdFromBody;
    }

    const hasReceiptUrl = Object.prototype.hasOwnProperty.call(req.body, 'receiptFileUrl') ||
      Object.prototype.hasOwnProperty.call(req.body, 'fileUrl');
    const hasReceiptName = Object.prototype.hasOwnProperty.call(req.body, 'receiptFileName') ||
      Object.prototype.hasOwnProperty.call(req.body, 'fileName');
    const hasReceiptMime = Object.prototype.hasOwnProperty.call(req.body, 'receiptMimeType') ||
      Object.prototype.hasOwnProperty.call(req.body, 'mimeType');

    if (hasReceiptUrl || hasReceiptName || hasReceiptMime) {
      const receiptFileUrl = normalizeString(req.body.receiptFileUrl || req.body.fileUrl);
      const receiptFileName = normalizeString(req.body.receiptFileName || req.body.fileName);
      const receiptMimeType = normalizeString(req.body.receiptMimeType || req.body.mimeType).toLowerCase();

      if (!receiptFileUrl || !receiptFileName || !receiptMimeType) {
        return res.status(400).json({
          success: false,
          message: 'receiptFileUrl, receiptFileName and receiptMimeType are required together',
        });
      }

      if (!isAllowedReceiptMime(receiptMimeType)) {
        return res.status(400).json({
          success: false,
          message: 'Unsupported receipt file type. Allowed: PDF, JPG, PNG',
        });
      }

      if (!isReceiptUploadUrl(receiptFileUrl)) {
        return res.status(400).json({
          success: false,
          message: 'Receipt URL must be from uploaded receipts storage',
        });
      }

      data.receiptFileUrl = receiptFileUrl;
      data.receiptFileName = receiptFileName;
      data.receiptMimeType = receiptMimeType;
    }

    let budgetApplicationId = existing.budgetApplicationId;
    if (Object.prototype.hasOwnProperty.call(req.body, 'budgetApplicationId')) {
      budgetApplicationId = normalizeNullableString(req.body.budgetApplicationId);
      data.budgetApplicationId = budgetApplicationId;
    }

    const effectiveEventId = data.eventId || existing.eventId;
    const { message: budgetError } = await validateBudgetApplicationLink(effectiveEventId, budgetApplicationId);
    if (budgetError) {
      return res.status(400).json({ success: false, message: budgetError });
    }

    const voucher = await prisma.voucher.update({
      where: { id },
      data,
      include: buildVoucherInclude(),
    });

    return res.json({
      success: true,
      message: 'Voucher updated successfully',
      voucher,
    });
  } catch (error) {
    console.error('Update voucher error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating voucher',
      error: error.message,
    });
  }
};

exports.deleteVoucher = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.voucher.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Voucher not found' });
    }

    if (!(await canMutateVoucher(req.user, existing))) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this voucher in its current state',
      });
    }

    await prisma.voucher.delete({ where: { id } });

    return res.json({ success: true, message: 'Voucher deleted successfully' });
  } catch (error) {
    console.error('Delete voucher error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting voucher',
      error: error.message,
    });
  }
};

exports.submitVoucher = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.voucher.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Voucher not found' });
    }

    const admin = isAdminUser(req.user);
    const society = isSocietyUser(req.user);
    if (!admin && !society) {
      return res.status(403).json({ success: false, message: 'Not authorized to submit this voucher' });
    }

    if (existing.status !== VOUCHER_STATUS.draft) {
      return res.status(400).json({
        success: false,
        message: 'Only draft vouchers can be submitted',
      });
    }

    const voucher = await prisma.voucher.update({
      where: { id },
      data: {
        status: VOUCHER_STATUS.submitted,
      },
      include: buildVoucherInclude(),
    });

    return res.json({ success: true, message: 'Voucher submitted successfully', voucher });
  } catch (error) {
    console.error('Submit voucher error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error submitting voucher',
      error: error.message,
    });
  }
};

exports.forwardVoucher = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.voucher.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Voucher not found' });
    }

    const admin = isAdminUser(req.user);
    const society = isSocietyUser(req.user);
    if (!admin && !society) {
      return res.status(403).json({ success: false, message: 'Not authorized to forward this voucher' });
    }

    if (existing.status !== VOUCHER_STATUS.submitted) {
      return res.status(400).json({
        success: false,
        message: 'Only submitted vouchers can be forwarded to review',
      });
    }

    const voucher = await prisma.voucher.update({
      where: { id },
      data: {
        status: VOUCHER_STATUS.underReview,
      },
      include: buildVoucherInclude(),
    });

    return res.json({ success: true, message: 'Voucher moved to review queue', voucher });
  } catch (error) {
    console.error('Forward voucher error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error forwarding voucher',
      error: error.message,
    });
  }
};

exports.approveVoucher = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin can approve vouchers',
      });
    }

    const { id } = req.params;
    const existing = await prisma.voucher.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Voucher not found' });
    }

    if (!REVIEWABLE_STATUSES.has(existing.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only submitted or under-review vouchers can be approved',
      });
    }

    const adminDecisionNote = normalizeNullableString(req.body.adminDecisionNote);

    const voucher = await prisma.voucher.update({
      where: { id },
      data: {
        status: VOUCHER_STATUS.approved,
        reviewedById: req.user.id,
        reviewedAt: new Date(),
        adminDecisionNote,
      },
      include: buildVoucherInclude(),
    });

    return res.json({ success: true, message: 'Voucher approved', voucher });
  } catch (error) {
    console.error('Approve voucher error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error approving voucher',
      error: error.message,
    });
  }
};

exports.rejectVoucher = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin can reject vouchers',
      });
    }

    const { id } = req.params;
    const adminDecisionNote = normalizeString(req.body.adminDecisionNote);

    if (!adminDecisionNote) {
      return res.status(400).json({
        success: false,
        message: 'adminDecisionNote is required for rejection',
      });
    }

    const existing = await prisma.voucher.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Voucher not found' });
    }

    if (!REVIEWABLE_STATUSES.has(existing.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only submitted or under-review vouchers can be rejected',
      });
    }

    const voucher = await prisma.voucher.update({
      where: { id },
      data: {
        status: VOUCHER_STATUS.rejected,
        reviewedById: req.user.id,
        reviewedAt: new Date(),
        adminDecisionNote,
      },
      include: buildVoucherInclude(),
    });

    return res.json({ success: true, message: 'Voucher rejected', voucher });
  } catch (error) {
    console.error('Reject voucher error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error rejecting voucher',
      error: error.message,
    });
  }
};

exports.getVoucherSummary = async (req, res) => {
  try {
    const admin = isAdminUser(req.user);
    const society = isSocietyUser(req.user);

    if (!admin && !society) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view voucher summaries',
      });
    }

    const eventId = normalizeString(req.query.eventId);
    const budgetApplicationId = normalizeString(req.query.budgetApplicationId);

    const where = {
      ...(eventId ? { eventId } : {}),
      ...(budgetApplicationId ? { budgetApplicationId } : {}),
    };

    const vouchers = await prisma.voucher.findMany({
      where,
      select: {
        id: true,
        amount: true,
        status: true,
        eventId: true,
        budgetApplicationId: true,
        event: {
          select: {
            id: true,
            title: true,
            eventDate: true,
          },
        },
      },
    });

    if (vouchers.length === 0) {
      return res.json({
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
    }

    const linkedBudgetIds = [...new Set(vouchers.map((v) => v.budgetApplicationId).filter(Boolean))];

    const linkedBudgets = linkedBudgetIds.length
      ? await prisma.societyApplication.findMany({
          where: {
            id: { in: linkedBudgetIds },
            type: BUDGET_TYPE,
          },
          select: {
            id: true,
            content: true,
            status: true,
          },
        })
      : [];

    const linkedBudgetById = new Map(linkedBudgets.map((budget) => [budget.id, budget]));

    const allBudgetApplications = await prisma.societyApplication.findMany({
      where: { type: BUDGET_TYPE },
      select: {
        id: true,
        status: true,
        createdAt: true,
        content: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const budgetByEventId = new Map();
    for (const budget of allBudgetApplications) {
      const linkedEventId = extractBudgetEventId(budget);
      if (!linkedEventId || budgetByEventId.has(linkedEventId)) {
        continue;
      }
      budgetByEventId.set(linkedEventId, budget);
    }

    const byEvent = new Map();

    for (const voucher of vouchers) {
      const key = voucher.eventId;
      if (!byEvent.has(key)) {
        byEvent.set(key, {
          eventId: voucher.event.id,
          eventTitle: voucher.event.title,
          eventDate: voucher.event.eventDate,
          voucherCount: 0,
          approvedExpenses: 0,
          pendingExpenses: 0,
          draftExpenses: 0,
          rejectedExpenses: 0,
          linkedBudgetApplicationIds: new Set(),
        });
      }

      const group = byEvent.get(key);
      group.voucherCount += 1;

      if (voucher.budgetApplicationId) {
        group.linkedBudgetApplicationIds.add(voucher.budgetApplicationId);
      }

      if (voucher.status === VOUCHER_STATUS.approved) {
        group.approvedExpenses += voucher.amount;
      } else if (
        voucher.status === VOUCHER_STATUS.submitted ||
        voucher.status === VOUCHER_STATUS.underReview
      ) {
        group.pendingExpenses += voucher.amount;
      } else if (voucher.status === VOUCHER_STATUS.rejected) {
        group.rejectedExpenses += voucher.amount;
      } else {
        group.draftExpenses += voucher.amount;
      }
    }

    const events = [];
    let totalBudget = 0;
    let totalExpenses = 0;
    let totalPendingExpenses = 0;
    let totalVouchers = 0;

    for (const group of byEvent.values()) {
      const linkedBudgetIdsForEvent = [...group.linkedBudgetApplicationIds];
      let eventBudget = 0;

      if (linkedBudgetIdsForEvent.length > 0) {
        const visited = new Set();
        for (const budgetId of linkedBudgetIdsForEvent) {
          if (visited.has(budgetId)) {
            continue;
          }
          visited.add(budgetId);
          const linkedBudget = linkedBudgetById.get(budgetId);
          const amount = extractBudgetTotal(linkedBudget);
          if (amount) {
            eventBudget += amount;
          }
        }
      } else {
        const fallbackBudget = budgetByEventId.get(group.eventId);
        const amount = extractBudgetTotal(fallbackBudget);
        if (amount) {
          eventBudget = amount;
        }
      }

      const remainingBudget = eventBudget > 0 ? eventBudget - group.approvedExpenses : null;
      const utilizationPercent =
        eventBudget > 0 ? Number(((group.approvedExpenses / eventBudget) * 100).toFixed(2)) : null;

      totalBudget += eventBudget;
      totalExpenses += group.approvedExpenses;
      totalPendingExpenses += group.pendingExpenses;
      totalVouchers += group.voucherCount;

      events.push({
        eventId: group.eventId,
        eventTitle: group.eventTitle,
        eventDate: group.eventDate,
        voucherCount: group.voucherCount,
        totalBudget: eventBudget,
        totalExpenses: group.approvedExpenses,
        pendingExpenses: group.pendingExpenses,
        draftExpenses: group.draftExpenses,
        rejectedExpenses: group.rejectedExpenses,
        remainingBudget,
        utilizationPercent,
        linkedBudgetApplicationIds: linkedBudgetIdsForEvent,
      });
    }

    return res.json({
      success: true,
      summary: {
        totals: {
          vouchers: totalVouchers,
          totalBudget,
          totalExpenses,
          pendingExpenses: totalPendingExpenses,
          remainingBudget: totalBudget > 0 ? totalBudget - totalExpenses : null,
          utilizationPercent: totalBudget > 0 ? Number(((totalExpenses / totalBudget) * 100).toFixed(2)) : null,
        },
        events,
      },
    });
  } catch (error) {
    console.error('Get voucher summary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching voucher summary',
      error: error.message,
    });
  }
};
