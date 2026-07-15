const { randomUUID } = require('crypto');
const prisma = require('../config/prisma');

const SEMESTER_COLUMNS = [
  { code: '1st', label: '1/1', title: '1st Year 1st Semester' },
  { code: '2nd', label: '1/2', title: '1st Year 2nd Semester' },
  { code: '3rd', label: '2/1', title: '2nd Year 1st Semester' },
  { code: '4th', label: '2/2', title: '2nd Year 2nd Semester' },
  { code: '5th', label: '3/1', title: '3rd Year 1st Semester' },
  { code: '6th', label: '3/2', title: '3rd Year 2nd Semester' },
  { code: '7th', label: '4/1', title: '4th Year 1st Semester' },
  { code: '8th', label: '4/2', title: '4th Year 2nd Semester' },
];

const SEMESTER_CODE_TO_LABEL = new Map(SEMESTER_COLUMNS.map((semester) => [semester.code, semester.label]));
const SEMESTER_LABEL_TO_CODE = new Map(SEMESTER_COLUMNS.map((semester) => [semester.label, semester.code]));
const SEMESTER_SET = new Set(SEMESTER_COLUMNS.map((semester) => semester.code));
const SEMESTER_CODE_TO_COLUMN = new Map(SEMESTER_COLUMNS.map((semester) => [semester.code, semester]));

// Maps a student's admission batch year (from their registration number) to the
// academic semester they are currently in. Updated manually as cohorts progress.
const BATCH_YEAR_TO_CURRENT_SEMESTER = {
  '2020': '8th',
  '2021': '7th',
  '2022': '6th',
  '2023': '4th',
  '2024': '3rd',
  '2025': '1st',
};

function getCurrentSemesterForStudent(studentId) {
  const match = String(studentId || '').match(/^(\d{4})/);
  if (!match) {
    return null;
  }

  const batchYear = match[1];
  const code = BATCH_YEAR_TO_CURRENT_SEMESTER[batchYear];
  if (!code) {
    return null;
  }

  const column = SEMESTER_CODE_TO_COLUMN.get(code);
  const nextYear = String(Number(batchYear) + 1).slice(2);

  return {
    code,
    label: column?.label || code,
    title: column?.title || '',
    session: `${batchYear}-${nextYear}`,
  };
}

function normalizeSemesterCode(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '');

  if (!normalized) {
    return '';
  }

  if (SEMESTER_LABEL_TO_CODE.has(normalized)) {
    return SEMESTER_LABEL_TO_CODE.get(normalized);
  }

  if (SEMESTER_SET.has(normalized)) {
    return normalized;
  }

  const ordinalMatch = normalized.match(/^([1-8])(st|nd|rd|th)?$/);
  if (ordinalMatch) {
    const suffixMap = {
      1: '1st',
      2: '2nd',
      3: '3rd',
      4: '4th',
      5: '5th',
      6: '6th',
      7: '7th',
      8: '8th',
    };
    return suffixMap[ordinalMatch[1]];
  }

  return '';
}

function getSemesterLabel(code) {
  return SEMESTER_CODE_TO_LABEL.get(code) || code || '';
}

function buildPaymentReference({ student, session, semester }) {
  const studentPart = student?.studentId || student?.id?.slice(0, 8) || 'STUDENT';
  const sessionPart = session || 'SESSION';
  const semesterPart = semester || 'SEM';
  return ['MANUAL', studentPart, sessionPart, semesterPart, randomUUID().slice(0, 8)].join('-').toUpperCase();
}

async function findExistingPayment(tx, { studentId, session, semester, excludePaymentId }) {
  return tx.studentFeePayment.findFirst({
    where: {
      studentId,
      session,
      semester,
      ...(excludePaymentId ? { id: { not: excludePaymentId } } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
  });
}

function buildMatrixCell(semester, payment) {
  if (payment) {
    return {
      code: semester.code,
      label: semester.label,
      title: semester.title,
      status: 'paid',
      source: payment.status === 'paid' ? 'payment' : 'pending',
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      reference: payment.reference,
      paymentId: payment.id,
    };
  }

  return {
    code: semester.code,
    label: semester.label,
    title: semester.title,
    status: 'unpaid',
    source: 'unpaid',
    amount: null,
    paymentDate: null,
    reference: null,
    paymentId: null,
  };
}

function createReceiptInclude() {
  return {
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
    forwardedBy: {
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
        semester: true,
        session: true,
        notes: true,
        status: true,
        verifiedAt: true,
      },
    },
  };
}

function createPaymentInclude() {
  return {
    student: {
      select: {
        id: true,
        name: true,
        email: true,
        studentId: true,
      },
    },
    receipt: {
      select: {
        id: true,
        fileUrl: true,
        fileName: true,
        status: true,
        reviewedAt: true,
      },
    },
  };
}

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

function isSociety(user) {
  return Array.isArray(user?.roles) && user.roles.includes('society');
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

async function notifyAdminsReceiptForwarded({ receipt, actor, note }) {
  if (!receipt?.id || !actor?.id) {
    return;
  }

  const admins = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { has: 'admin' },
      id: { not: actor.id },
    },
    select: { id: true },
  });

  if (!admins.length) {
    return;
  }

  const title = 'Receipt forwarded to admin';
  const message = `${actor.name || 'Society member'} forwarded receipt (${receipt.payment?.reference || 'reference unavailable'}) for review.`;

  for (const admin of admins) {
    try {
      await prisma.notification.create({
        data: {
          recipientId: admin.id,
          actorId: actor.id,
          type: 'event_updated',
          title,
          message,
          metadata: {
            notificationCategory: 'receipt_forwarded_to_admin',
            receiptId: receipt.id,
            paymentId: receipt.paymentId,
            reference: receipt.payment?.reference || null,
            note: note || null,
          },
        },
      });
    } catch (err) {
      console.error('Notification create failed for admin', admin.id, err?.message || err);
    }
  }
}

exports.createReceipt = async (req, res) => {
  try {
    const { reference, paymentDate, amount, semester, session, notes, fileUrl, fileName, mimeType } = req.body;

    if (!isStudent(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only students can submit bank receipts',
      });
    }

    if (!reference || !paymentDate || amount === undefined || !semester || !session || !fileUrl || !fileName || !mimeType) {
      return res.status(400).json({
        success: false,
        message: 'Reference, payment date, amount, semester, session, file URL, file name and mime type are required',
      });
    }

    const normalizedSemester = normalizeSemesterCode(semester);
    const normalizedSession = String(session).trim();
    const allowedSemesters = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

    if (!allowedSemesters.includes(normalizedSemester)) {
      return res.status(400).json({
        success: false,
        message: 'Semester must be one of: 1st, 2nd, 3rd, 4th, 5th, 6th, 7th, 8th',
      });
    }

    if (!normalizedSession) {
      return res.status(400).json({
        success: false,
        message: 'Session is required',
      });
    }

    const existingPayment = await prisma.studentFeePayment.findFirst({
      where: {
        studentId: req.user.id,
        semester: normalizedSemester,
        session: normalizedSession,
        receipt: {
          status: { not: RECEIPT_STATUS.rejected },
        },
      },
      select: { id: true, status: true },
    });

    if (existingPayment) {
      return res.status(409).json({
        success: false,
        message: 'A payment already exists for this semester and session.',
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
          semester: normalizedSemester,
          session: normalizedSession,
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
    if (!isAdmin(req.user) && !isSociety(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins or society users can view student affairs receipt queue',
      });
    }

    const { status } = req.query;
    const search = String(req.query.search || '').trim();
    const session = String(req.query.session || '').trim();
    const semester = String(req.query.semester || '').trim();
    const registration = String(req.query.registration || '').trim();
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit || '20'), 10) || 20));
    const skip = (page - 1) * limit;

    // A search term that starts with digits (e.g. "2024-25", "2024", "24") is treated as an
    // admission batch year, matching students by their ID prefix rather than by whichever
    // session their payment happens to be for (many cohorts can share the same payment session).
    const batchYearMatch = search.match(/^(\d{2,4})/);
    const batchYear = batchYearMatch
      ? batchYearMatch[1].length >= 4
        ? batchYearMatch[1].slice(0, 4)
        : `20${batchYearMatch[1]}`
      : null;

    const normalizedSemester = normalizeSemesterCode(semester);
    const normalizedRegistration = registration.replace(/\D/g, '');
    const isRegistrationBatchYear = /^\d{2,4}$/.test(registration);
    const registrationFilter = isRegistrationBatchYear
      ? { startsWith: normalizedRegistration.length >= 4 ? normalizedRegistration.slice(0, 4) : `20${normalizedRegistration}` }
      : { contains: normalizedRegistration || registration, mode: 'insensitive' };

    const paymentFilter = {
      ...(session ? { session: { contains: session, mode: 'insensitive' } } : {}),
      ...(normalizedSemester ? { semester: normalizedSemester } : {}),
    };

    const where = {
      ...(status ? { status: String(status) } : {}),
      ...(Object.keys(paymentFilter).length ? { payment: paymentFilter } : {}),
      ...(registration ? { student: { studentId: registrationFilter } } : {}),
      ...(search
        ? {
            OR: [
              { student: { name: { contains: search, mode: 'insensitive' } } },
              { student: { email: { contains: search, mode: 'insensitive' } } },
              { student: { studentId: { contains: search, mode: 'insensitive' } } },
              { payment: { reference: { contains: search, mode: 'insensitive' } } },
              { payment: { semester: { contains: search, mode: 'insensitive' } } },
              ...(batchYear ? [{ student: { studentId: { startsWith: batchYear } } }] : []),
            ],
          }
        : {}),
    };

    const include = {
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
      forwardedBy: {
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
          semester: true,
          session: true,
          notes: true,
          status: true,
          verifiedAt: true,
        },
      },
    };

    // Payments an admin marked as paid directly (e.g. backfilled dues) have no
    // uploaded receipt. A status filter of "pending"/"rejected" can't match them
    // since they're always already-settled, paid records.
    const includeUnreceiptedPayments = !status || String(status) === 'accepted';

    const unreceiptedPaymentWhere = {
      status: 'paid',
      receipt: null,
      ...paymentFilter,
      ...(registration ? { student: { studentId: registrationFilter } } : {}),
      ...(search
        ? {
            OR: [
              { student: { name: { contains: search, mode: 'insensitive' } } },
              { student: { email: { contains: search, mode: 'insensitive' } } },
              { student: { studentId: { contains: search, mode: 'insensitive' } } },
              { reference: { contains: search, mode: 'insensitive' } },
              { semester: { contains: search, mode: 'insensitive' } },
              ...(batchYear ? [{ student: { studentId: { startsWith: batchYear } } }] : []),
            ],
          }
        : {}),
    };

    const [receipts, awaitingAdminAction, unreceiptedPayments] = await Promise.all([
      prisma.studentFeeReceipt.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.studentFeeReceipt.count({ where: { status: 'pending', forwardedToAdmin: true } }),
      includeUnreceiptedPayments
        ? prisma.studentFeePayment.findMany({
            where: unreceiptedPaymentWhere,
            include: {
              student: {
                select: { id: true, name: true, email: true, studentId: true },
              },
              verifiedBy: {
                select: { id: true, name: true, email: true },
              },
            },
          })
        : [],
    ]);

    // Represent admin-recorded payments without a receipt using the same shape as
    // an uploaded receipt (implicitly "accepted" since they're already paid), so
    // the list can show every student who has paid, not just those who uploaded proof.
    const unreceiptedEntries = unreceiptedPayments.map((payment) => ({
      id: `payment-${payment.id}`,
      paymentId: payment.id,
      studentId: payment.studentId,
      fileUrl: '',
      fileName: '',
      mimeType: '',
      status: 'accepted',
      adminNote: null,
      reviewedById: payment.verifiedById,
      reviewedAt: payment.verifiedAt,
      forwardedToAdmin: false,
      forwardedAt: null,
      forwardedBy: null,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      isManualEntry: true,
      student: payment.student,
      reviewedBy: payment.verifiedBy || null,
      payment: {
        id: payment.id,
        reference: payment.reference,
        paymentDate: payment.paymentDate,
        amount: payment.amount,
        semester: payment.semester,
        session: payment.session,
        notes: payment.notes,
        status: payment.status,
        verifiedAt: payment.verifiedAt,
      },
    }));

    const merged = [...receipts, ...unreceiptedEntries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = merged.length;
    const paginated = merged.slice(skip, skip + limit);

    return res.json({
      success: true,
      receipts: paginated,
      awaitingAdminAction,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error('Get student receipts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching student receipts',
      error: error.message,
    });
  }
};

exports.getReceiptsReport = async (req, res) => {
  try {
    if (!isAdmin(req.user) && !isSociety(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins or society users can view fee payment reports',
      });
    }

    const search = String(req.query.search || '').trim();
    const session = String(req.query.session || '').trim();
    const semester = String(req.query.semester || '').trim();
    const registration = String(req.query.registration || '').trim();
    const normalizedRegistration = registration.replace(/\D/g, '');
    // 2-digit input means batch year shorthand: "24" → matches studentId STARTSWITH "2024"
    const isBatchYear = /^\d{2}$/.test(normalizedRegistration);
    const registrationFilter = isBatchYear
      ? { startsWith: '20' + normalizedRegistration }
      : { contains: normalizedRegistration || registration, mode: 'insensitive' };

    // Derive batch year from session so the student list also narrows to that intake.
    // "24-25" or "2024-25" → "2024"; used only when no explicit registration filter is active.
    let sessionBatchYear = null;
    if (session && !registration) {
      const m = session.match(/^(\d{2,4})/);
      if (m) {
        const p = m[1];
        sessionBatchYear = p.length >= 4 ? p.slice(0, 4) : '20' + p; // "24" → "2024", "2024" → "2024"
      }
    }

    const normalizedSemester = normalizeSemesterCode(semester);
    const semesterLabel = normalizedSemester ? getSemesterLabel(normalizedSemester) : '';

    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '25'), 10) || 25));
    const skip = (page - 1) * limit;

    const paymentWhere = {
      status: 'paid',
      AND: [
        ...(session ? [{ session: { contains: session, mode: 'insensitive' } }] : []),
        ...(normalizedSemester ? [{ semester: normalizedSemester }] : []),
        ...(registration
          ? [{ student: { studentId: registrationFilter } }]
          : []),
        ...(search
          ? [
              {
                OR: [
                  { reference: { contains: search, mode: 'insensitive' } },
                  { session: { contains: search, mode: 'insensitive' } },
                  { semester: { contains: search, mode: 'insensitive' } },
                  { student: { name: { contains: search, mode: 'insensitive' } } },
                  { student: { email: { contains: search, mode: 'insensitive' } } },
                  { student: { studentId: { contains: search, mode: 'insensitive' } } },
                ],
              },
            ]
          : []),
      ],
    };

    // Student list filter: narrows to the relevant batch when a session or
    // registration filter is active; otherwise returns all registered students.
    const studentIdFilter = registration
      ? registrationFilter                              // explicit reg filter wins
      : sessionBatchYear
        ? { startsWith: sessionBatchYear }             // "24-25" → show 2024 batch
        : undefined;

    const studentWhere = {
      isActive: true,
      roles: { has: 'student' },
      ...(studentIdFilter ? { studentId: studentIdFilter } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { studentId: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, totalResults, uniquePaidStudents, students] = await Promise.all([
      prisma.studentFeePayment.findMany({
        where: paymentWhere,
        include: createPaymentInclude(),
        orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.studentFeePayment.count({ where: paymentWhere }),
      prisma.studentFeePayment.groupBy({
        by: ['studentId'],
        where: paymentWhere,
      }),
      prisma.user.findMany({
        where: studentWhere,
        select: {
          id: true,
          name: true,
          email: true,
          studentId: true,
        },
        orderBy: [{ name: 'asc' }],
      }),
    ]);

    const studentIds = students.map((student) => student.id);
    const paymentsForMatrix = studentIds.length
      ? await prisma.studentFeePayment.findMany({
          where: {
            studentId: { in: studentIds },
            status: 'paid',
            ...(session ? { session: { contains: session, mode: 'insensitive' } } : {}),
            ...(normalizedSemester ? { semester: normalizedSemester } : {}),
          },
          orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
          include: createPaymentInclude(),
        })
      : [];

    const paymentMap = new Map();
    for (const payment of paymentsForMatrix) {
      const key = `${payment.studentId}:${payment.semester}`;
      if (!paymentMap.has(key)) {
        paymentMap.set(key, payment);
      }
    }

    const studentRows = students
      .map((student) => {
        const semesters = SEMESTER_COLUMNS.map((semesterColumn) => {
          const payment = paymentMap.get(`${student.id}:${semesterColumn.code}`);
          return buildMatrixCell(semesterColumn, payment || null);
        });

        const paidSemesters = semesters.filter((semesterCell) => semesterCell.status === 'paid').length;
        const unpaidSemesters = semesters.length - paidSemesters;
        const paidAmount = semesters.reduce((sum, semesterCell) => sum + (semesterCell.amount || 0), 0);

        return {
          student,
          currentSemester: getCurrentSemesterForStudent(student.studentId),
          semesters,
          totals: {
            paidSemesters,
            unpaidSemesters,
            paidAmount,
          },
        };
      })
      // Semester filter narrows to students currently in that academic semester,
      // matching the other filters' behavior of narrowing the student list.
      .filter((row) => !normalizedSemester || row.currentSemester?.code === normalizedSemester);

    const totalPaidSemesters = studentRows.reduce((sum, row) => sum + row.totals.paidSemesters, 0);
    const totalUnpaidSemesters = studentRows.reduce((sum, row) => sum + row.totals.unpaidSemesters, 0);

    return res.json({
      success: true,
      totals: {
        totalPaidStudents: uniquePaidStudents.length,
        totalResults,
        totalStudents: studentRows.length,
        totalPaidSemesters,
        totalUnpaidSemesters,
      },
      filters: {
        search,
        session,
        semester: semesterLabel || semester,
        registration,
      },
      pagination: {
        page,
        limit,
        total: totalResults,
        totalPages: Math.max(1, Math.ceil(totalResults / limit)),
      },
      rows,
      students: studentRows,
      semesters: SEMESTER_COLUMNS,
    });
  } catch (error) {
    console.error('Get receipts report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error generating receipts report',
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
        forwardedBy: {
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
            semester: true,
            session: true,
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
        forwardedBy: {
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
            semester: true,
            session: true,
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

    if (!isAdmin(req.user) && !isSociety(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins or society users can review student receipts',
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
        message: 'Note is required when rejecting a receipt',
      });
    }

    const existing = await prisma.studentFeeReceipt.findUnique({
      where: { id },
      include: { payment: true },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    const isAdminUser = isAdmin(req.user);
    const isSocietyUser = isSociety(req.user);

    // Society members can approve pending receipts (mark as reviewed)
    // and may also reject a pending receipt with a note.
    if (isSocietyUser) {
      if (existing.status !== RECEIPT_STATUS.pending) {
        return res.status(400).json({
          success: false,
          message: 'Only pending receipts can be reviewed by society',
        });
      }

      if (normalizedDecision === 'accepted') {
        // Society approves but receipt stays pending until admin reviews it
        const updated = await prisma.studentFeeReceipt.update({
          where: { id },
          data: {
            reviewedById: req.user.id,
            reviewedAt: new Date(),
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
            forwardedBy: {
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
                semester: true,
                session: true,
                notes: true,
                status: true,
                verifiedAt: true,
              },
            },
          },
        });

        return res.json({
          success: true,
          message: 'Receipt approved by society. Ready to forward to admin.',
          receipt: updated,
        });
      }

      // Allow society to reject pending receipts (with a note)
      if (normalizedDecision === 'rejected') {
        const updated = await prisma.studentFeeReceipt.update({
          where: { id },
          data: {
            status: RECEIPT_STATUS.rejected,
            adminNote: String(adminNote || '').trim() || null,
            reviewedById: req.user.id,
            reviewedAt: new Date(),
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
            forwardedBy: {
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
                semester: true,
                session: true,
                notes: true,
                status: true,
                verifiedAt: true,
              },
            },
          },
        });

        return res.json({
          success: true,
          message: 'Receipt rejected by society',
          receipt: updated,
        });
      }

      return res.status(400).json({ success: false, message: 'Decision must be accepted or rejected' });
    }

    // Only admins can change final status (accepted/rejected)
    if (isAdminUser) {
      if (existing.status !== RECEIPT_STATUS.accepted && existing.status !== RECEIPT_STATUS.pending) {
        return res.status(400).json({
          success: false,
          message: 'Only pending or accepted receipts can be reviewed by admin',
        });
      }

      const reviewedAt = new Date();
      const shouldAccept = normalizedDecision === 'accepted';

      if (shouldAccept) {
        const duplicatePayment = await prisma.studentFeePayment.findFirst({
          where: {
            studentId: existing.studentId,
            semester: existing.payment?.semester,
            session: existing.payment?.session,
            id: { not: existing.paymentId },
            status: 'paid',
          },
          select: { id: true },
        });

        if (duplicatePayment) {
          return res.status(409).json({
            success: false,
            message: 'A paid record already exists for this student, semester and session.',
          });
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        // Update payment status based on admin decision
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
            forwardedBy: {
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
                semester: true,
                session: true,
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
        message: shouldAccept ? 'Receipt accepted by admin' : 'Receipt rejected by admin',
        receipt: updated,
      });
    }

    return res.status(403).json({
      success: false,
      message: 'Unauthorized to review this receipt',
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

exports.forwardReceiptToAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const note = String(req.body?.note || '').trim();

    if (!isSociety(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only society users can forward receipts to admin',
      });
    }

    if (!note) {
      return res.status(400).json({
        success: false,
        message: 'Note is required before forwarding to admin',
      });
    }

    const existing = await prisma.studentFeeReceipt.findUnique({
      where: { id },
      include: {
        payment: {
          select: {
            id: true,
            reference: true,
            paymentDate: true,
            amount: true,
            semester: true,
            session: true,
            notes: true,
            status: true,
            verifiedAt: true,
          },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    // Require receipt to be pending and reviewed by society before forwarding to admin
    if (existing.status !== RECEIPT_STATUS.pending) {
      return res.status(400).json({
        success: false,
        message: 'Receipt must be in pending status to be forwarded to admin',
      });
    }
    
    if (!existing.reviewedById) {
      return res.status(400).json({
        success: false,
        message: 'Receipt must be approved by society before forwarding to admin',
      });
    }

    const updated = await prisma.studentFeeReceipt.update({
      where: { id },
      data: {
        adminNote: note,
        forwardedToAdmin: true,
        forwardedAt: new Date(),
        forwardedById: req.user.id,
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
        forwardedBy: {
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
            semester: true,
            session: true,
            notes: true,
            status: true,
            verifiedAt: true,
          },
        },
      },
    });

    notifyAdminsReceiptForwarded({
      receipt: updated,
      actor: req.user,
      note,
    }).catch((err) => console.error('Receipt forward notification error:', err));

    return res.json({
      success: true,
      message: 'Receipt forwarded to admin',
      receipt: updated,
    });
  } catch (error) {
    console.error('Forward receipt to admin error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error forwarding receipt to admin',
      error: error.message,
    });
  }
};

exports.markFeePaymentPaid = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can mark fee payments as paid',
      });
    }

    const { studentId, semester, session, amount, paymentDate, reference, notes } = req.body;
    const normalizedSemester = normalizeSemesterCode(semester);
    const normalizedSession = String(session || '').trim();
    const parsedAmount = Number(amount);
    const parsedDate = new Date(paymentDate);

    if (!studentId || !normalizedSemester || !normalizedSession || !paymentDate || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Student, semester, session, payment date, and amount are required',
      });
    }

    if (!SEMESTER_SET.has(normalizedSemester)) {
      return res.status(400).json({
        success: false,
        message: 'Semester must be one of the 8 academic semesters',
      });
    }

    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment date',
      });
    }

    const student = await prisma.user.findFirst({
      where: {
        id: studentId,
        isActive: true,
        roles: { has: 'student' },
      },
      select: {
        id: true,
        name: true,
        studentId: true,
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    const existingPaid = await prisma.studentFeePayment.findFirst({
      where: {
        studentId,
        semester: normalizedSemester,
        session: normalizedSession,
        status: 'paid',
      },
      select: { id: true },
    });

    if (existingPaid) {
      return res.status(409).json({
        success: false,
        message: 'A paid record already exists for this semester and session',
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const pendingPayment = await tx.studentFeePayment.findFirst({
        where: {
          studentId,
          semester: normalizedSemester,
          session: normalizedSession,
          status: 'pending',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (pendingPayment) {
        return tx.studentFeePayment.update({
          where: { id: pendingPayment.id },
          data: {
            reference: String(reference || pendingPayment.reference || buildPaymentReference({ student, session: normalizedSession, semester: normalizedSemester })).trim(),
            paymentDate: parsedDate,
            amount: parsedAmount,
            notes: notes ? String(notes).trim() : pendingPayment.notes,
            status: 'paid',
            verifiedById: req.user.id,
            verifiedAt: new Date(),
          },
          include: createPaymentInclude(),
        });
      }

      return tx.studentFeePayment.create({
        data: {
          studentId,
          reference: String(reference || buildPaymentReference({ student, session: normalizedSession, semester: normalizedSemester })).trim(),
          paymentDate: parsedDate,
          amount: parsedAmount,
          semester: normalizedSemester,
          session: normalizedSession,
          notes: notes ? String(notes).trim() : null,
          status: 'paid',
          verifiedById: req.user.id,
          verifiedAt: new Date(),
        },
        include: createPaymentInclude(),
      });
    });

    return res.status(201).json({
      success: true,
      message: 'Fee payment marked as paid',
      payment: updated,
    });
  } catch (error) {
    console.error('Mark fee payment paid error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error marking fee payment as paid',
      error: error.message,
    });
  }
};

// Society fee status, aggregated per admission session (batch year) and overall,
// based on whether each active student has a paid record for their own current semester.
exports.getFeeStatusSummary = async (req, res) => {
  try {
    if (!isAdmin(req.user) && !isSociety(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins or society users can view the fee status summary',
      });
    }

    const students = await prisma.user.findMany({
      where: { isActive: true, roles: { has: 'student' } },
      select: { id: true, studentId: true },
    });

    const bySessionMap = new Map();
    const studentsWithCurrentSemester = [];

    for (const student of students) {
      const currentSemester = getCurrentSemesterForStudent(student.studentId);
      if (!currentSemester) continue;

      studentsWithCurrentSemester.push({ id: student.id, semester: currentSemester.code, session: currentSemester.session });

      if (!bySessionMap.has(currentSemester.session)) {
        bySessionMap.set(currentSemester.session, { session: currentSemester.session, paidCount: 0, unpaidCount: 0, total: 0 });
      }
    }

    const paidPayments = studentsWithCurrentSemester.length
      ? await prisma.studentFeePayment.findMany({
          where: {
            status: 'paid',
            OR: studentsWithCurrentSemester.map(({ id, semester }) => ({ studentId: id, semester })),
          },
          select: { studentId: true, semester: true },
        })
      : [];

    const paidSet = new Set(paidPayments.map((payment) => `${payment.studentId}:${payment.semester}`));

    for (const entry of studentsWithCurrentSemester) {
      const bucket = bySessionMap.get(entry.session);
      bucket.total += 1;
      if (paidSet.has(`${entry.id}:${entry.semester}`)) {
        bucket.paidCount += 1;
      } else {
        bucket.unpaidCount += 1;
      }
    }

    const bySession = [...bySessionMap.values()]
      .sort((a, b) => a.session.localeCompare(b.session))
      .map((bucket) => ({
        ...bucket,
        paidPercentage: bucket.total ? Math.round((bucket.paidCount / bucket.total) * 1000) / 10 : 0,
      }));

    const overall = bySession.reduce(
      (acc, bucket) => ({
        paidCount: acc.paidCount + bucket.paidCount,
        unpaidCount: acc.unpaidCount + bucket.unpaidCount,
        total: acc.total + bucket.total,
      }),
      { paidCount: 0, unpaidCount: 0, total: 0 }
    );

    return res.json({
      success: true,
      overall,
      bySession,
    });
  } catch (error) {
    console.error('Get fee status summary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching fee status summary',
      error: error.message,
    });
  }
};
