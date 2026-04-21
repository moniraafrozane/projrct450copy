const prisma = require('../config/prisma');

const RECEIPT_STATUS = {
  pending: 'pending',
  accepted: 'accepted',
  rejected: 'rejected',
};

function isAdmin(user) {
  return Array.isArray(user?.roles) && user.roles.includes('admin');
}

function isStudent(user) {
  return Array.isArray(user?.roles) && user.roles.includes('student');
}

function isAllowedReceiptMime(mimeType) {
  return ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'].includes(String(mimeType || '').toLowerCase());
}

async function notifyStudentReceiptAccepted({ receipt, actor }) {
  if (!receipt?.studentId || !receipt?.id || !actor?.id || receipt.studentId === actor.id) {
    return;
  }

  const recipient = await prisma.user.findFirst({
    where: {
      id: receipt.studentId,
      isActive: true,
      roles: { has: 'student' },
    },
    select: { id: true },
  });

  if (!recipient) {
    return;
  }

  const baseData = {
    recipientId: recipient.id,
    actorId: actor.id,
    title: 'Receipt accepted',
    message: `Your bank receipt (${receipt.payment?.reference || 'reference unavailable'}) has been accepted by admin.`,
    metadata: {
      notificationCategory: 'receipt_accepted',
      receiptId: receipt.id,
      paymentId: receipt.paymentId,
      reference: receipt.payment?.reference || null,
      amount: receipt.payment?.amount || null,
    },
  };

  try {
    await prisma.notification.create({
      data: {
        ...baseData,
        type: 'receipt_accepted',
      },
    });
  } catch (error) {
    const details = String(error?.message || '');
    const enumUnavailable = details.includes('receipt_accepted') || details.includes('NotificationType');
    if (!enumUnavailable) {
      throw error;
    }

    // Fallback for environments where NotificationType enum migration is not applied yet.
    await prisma.notification.create({
      data: {
        ...baseData,
        type: 'event_updated',
      },
    });
  }
}

exports.createReceipt = async (req, res) => {
  try {
    const { reference, paymentDate, amount, notes, fileUrl, fileName, mimeType } = req.body;

    if (!isStudent(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only students can submit bank receipts',
      });
    }

    if (!reference || !paymentDate || amount === undefined || !fileUrl || !fileName || !mimeType) {
      return res.status(400).json({
        success: false,
        message: 'Reference, payment date, amount, file URL, file name and mime type are required',
      });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number',
      });
    }

    const parsedDate = new Date(paymentDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment date',
      });
    }

    if (!isAllowedReceiptMime(mimeType)) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported receipt file type. Allowed: PDF, JPG, PNG',
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.studentFeePayment.create({
        data: {
          studentId: req.user.id,
          reference: String(reference).trim(),
          paymentDate: parsedDate,
          amount: numericAmount,
          notes: notes ? String(notes).trim() : null,
          status: 'pending',
        },
      });

      const receipt = await tx.studentFeeReceipt.create({
        data: {
          paymentId: payment.id,
          studentId: req.user.id,
          fileUrl: String(fileUrl).trim(),
          fileName: String(fileName).trim(),
          mimeType: String(mimeType).trim().toLowerCase(),
          status: RECEIPT_STATUS.pending,
        },
        include: {
          payment: true,
        },
      });

      return { payment, receipt };
    });

    return res.status(201).json({
      success: true,
      message: 'Receipt submitted successfully',
      payment: result.payment,
      receipt: result.receipt,
    });
  } catch (error) {
    console.error('Create student receipt error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error submitting receipt',
      error: error.message,
    });
  }
};

exports.getReceipts = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view student affairs receipt queue',
      });
    }

    const { status } = req.query;
    const where = {
      ...(status ? { status: String(status) } : {}),
    };

    const receipts = await prisma.studentFeeReceipt.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            studentId: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        payment: {
          select: {
            id: true,
            reference: true,
            paymentDate: true,
            amount: true,
            notes: true,
            status: true,
            verifiedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, receipts });
  } catch (error) {
    console.error('Get student receipts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching student receipts',
      error: error.message,
    });
  }
};

exports.getMyReceipts = async (req, res) => {
  try {
    if (!isStudent(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only students can view their receipt submissions',
      });
    }

    const receipts = await prisma.studentFeeReceipt.findMany({
      where: { studentId: req.user.id },
      include: {
        reviewedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        payment: {
          select: {
            id: true,
            reference: true,
            paymentDate: true,
            amount: true,
            notes: true,
            status: true,
            verifiedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, receipts });
  } catch (error) {
    console.error('Get my student receipts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching your receipts',
      error: error.message,
    });
  }
};

exports.getReceiptById = async (req, res) => {
  try {
    const { id } = req.params;

    const receipt = await prisma.studentFeeReceipt.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            studentId: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        payment: {
          select: {
            id: true,
            reference: true,
            paymentDate: true,
            amount: true,
            notes: true,
            status: true,
            verifiedAt: true,
          },
        },
      },
    });

    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    if (!isAdmin(req.user) && receipt.studentId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this receipt' });
    }

    return res.json({ success: true, receipt });
  } catch (error) {
    console.error('Get student receipt by id error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching receipt',
      error: error.message,
    });
  }
};

exports.reviewReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, adminNote } = req.body;

    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can review student receipts',
      });
    }

    const normalizedDecision = String(decision || '').toLowerCase();
    if (!['accepted', 'rejected'].includes(normalizedDecision)) {
      return res.status(400).json({
        success: false,
        message: 'Decision must be accepted or rejected',
      });
    }

    if (normalizedDecision === 'rejected' && !String(adminNote || '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'Admin note is required when rejecting a receipt',
      });
    }

    const existing = await prisma.studentFeeReceipt.findUnique({
      where: { id },
      include: { payment: true },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    if (existing.status !== RECEIPT_STATUS.pending) {
      return res.status(400).json({
        success: false,
        message: 'Only pending receipts can be reviewed',
      });
    }

    const reviewedAt = new Date();
    const shouldAccept = normalizedDecision === 'accepted';

    const updated = await prisma.$transaction(async (tx) => {
      await tx.studentFeePayment.update({
        where: { id: existing.paymentId },
        data: {
          status: shouldAccept ? 'paid' : 'pending',
          verifiedById: shouldAccept ? req.user.id : null,
          verifiedAt: shouldAccept ? reviewedAt : null,
        },
      });

      return tx.studentFeeReceipt.update({
        where: { id },
        data: {
          status: shouldAccept ? RECEIPT_STATUS.accepted : RECEIPT_STATUS.rejected,
          adminNote: String(adminNote || '').trim() || null,
          reviewedById: req.user.id,
          reviewedAt,
        },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              studentId: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          payment: {
            select: {
              id: true,
              reference: true,
              paymentDate: true,
              amount: true,
              notes: true,
              status: true,
              verifiedAt: true,
            },
          },
        },
      });
    });

    if (shouldAccept) {
      notifyStudentReceiptAccepted({
        receipt: updated,
        actor: req.user,
      }).catch((err) => console.error('Receipt accepted notification error:', err));
    }

    return res.json({
      success: true,
      message: shouldAccept ? 'Receipt accepted' : 'Receipt rejected',
      receipt: updated,
    });
  } catch (error) {
    console.error('Review student receipt error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error reviewing receipt',
      error: error.message,
    });
  }
};
