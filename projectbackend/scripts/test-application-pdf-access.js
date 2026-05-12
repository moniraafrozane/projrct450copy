require('dotenv').config();
const axios = require('axios');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const api = axios.create({
  baseURL: process.env.BACKEND_URL || 'http://localhost:5000/api',
  validateStatus: () => true,
});

const TEST_PASSWORD = 'test123';

async function login(email, role) {
  const response = await api.post('/auth/login', {
    email,
    password: TEST_PASSWORD,
    role,
  });

  if (response.status !== 200 || !response.data?.token) {
    throw new Error(`Login failed for ${email} (${role}): ${JSON.stringify(response.data)}`);
  }

  return response.data.token;
}

async function ensureUser(email, name, roles) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return existing;
  }

  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 12);
  return prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      phone: '0000000000',
      roles,
      isActive: true,
      societyName: roles.includes('society') ? 'Test Society' : null,
      societyRole: roles.includes('society') ? 'Member' : null,
    },
  });
}

async function createApplication(owner, label) {
  return prisma.societyApplication.create({
    data: {
      type: 'fund_withdrawal',
      subject: `${label} PDF access test`,
      content: {
        applicationDate: new Date().toISOString(),
        recipientTitle: 'The President',
        throughTitle: 'The General Secretary',
        eventDate: '2026-04-30',
        eventTitle: `${label} Event`,
        chiefGuestName: 'Guest Name',
        chiefGuestDesignation: 'Professor',
        chiefGuestOrganization: 'CSE Department',
        amount: '5000',
        usedFor: 'testing the PDF route',
        applicantName: owner.name,
        applicantPosition: 'Member',
        registrationNumber: 'REG-TEST',
        phoneNumber: owner.phone || '0000000000',
        attachments: 'Budget sheet',
      },
      status: 'submitted',
      createdById: owner.id,
      createdByName: owner.name,
    },
  });
}

async function createTypedApplication(owner, label, type, content, subject) {
  return prisma.societyApplication.create({
    data: {
      type,
      subject,
      content,
      status: 'submitted',
      createdById: owner.id,
      createdByName: owner.name,
    },
  });
}

async function waitForAuditLog(resourceId, action) {
  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    const auditLog = await prisma.adminAuditLog.findFirst({
      where: { resourceId, action },
    });

    if (auditLog) {
      return auditLog;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return null;
}

async function main() {
  const tempUsers = [];
  const tempApplications = [];

  try {
    await prisma.$connect();

    const stamp = Date.now();
    const societyUser = await ensureUser(`society.view+${stamp}@example.com`, 'Test Society Member', ['society']);
    const adminUser = await ensureUser(`admin.view+${stamp}@example.com`, 'Test Admin', ['admin']);
    const otherUser = await ensureUser(`society.other+${stamp}@example.com`, 'Temporary Society Member', ['society']);

    tempUsers.push(societyUser.id, adminUser.id, otherUser.id);

    const societyToken = await login(societyUser.email, 'society');
    const adminToken = await login(adminUser.email, 'admin');

    const ownerApplications = [
      await createTypedApplication(
        societyUser,
        'Owner Fund Withdrawal',
        'fund_withdrawal',
        {
          applicationDate: new Date().toISOString(),
          recipientTitle: 'The President',
          throughTitle: 'The General Secretary',
          eventDate: '2026-04-30',
          eventTitle: 'Annual Seminar',
          chiefGuestName: 'Guest Name',
          chiefGuestDesignation: 'Professor',
          chiefGuestOrganization: 'CSE Department',
          amount: '5000',
          usedFor: 'testing the PDF route',
          applicantName: societyUser.name,
          applicantPosition: 'Member',
          registrationNumber: 'REG-TEST',
          phoneNumber: societyUser.phone || '0000000000',
          attachments: 'Budget sheet',
        },
        'Owner Fund Withdrawal PDF access test'
      ),
      await createTypedApplication(
        societyUser,
        'Owner Event Approval',
        'event_approval',
        {
          applicationDate: new Date().toISOString(),
          recipientTitle: 'The President',
          eventTitle: 'Tech Talk',
          proposedDate: '2026-05-10',
          venue: 'Auditorium',
          expectedAttendees: '120',
          description: 'A technical talk for society members.',
          budget: '3000',
          applicantName: societyUser.name,
          applicantPosition: 'Member',
          phoneNumber: societyUser.phone || '0000000000',
        },
        'Owner Event Approval PDF access test'
      ),
      await createTypedApplication(
        societyUser,
        'Owner Budget Breakdown',
        'budget_breakdown',
        {
          applicationDate: new Date().toISOString(),
          recipientTitle: 'The President',
          eventTitle: 'Annual Tech Fest',
          increasedRequirementsReason: 'additional logistics and materials',
          requiredAmount: '15000',
          applicantName: societyUser.name,
          applicantPosition: 'Member',
          phoneNumber: societyUser.phone || '0000000000',
        },
        'Owner Budget Breakdown PDF access test'
      ),
      await createTypedApplication(
        societyUser,
        'Owner Resource Request',
        'resource_request',
        {
          applicationDate: new Date().toISOString(),
          recipientTitle: 'The President',
          resourceType: 'Projector',
          quantity: '2',
          purpose: 'seminar presentation',
          duration: '3 days',
          eventReference: 'Tech Seminar 2026',
          applicantName: societyUser.name,
          applicantPosition: 'Member',
          phoneNumber: societyUser.phone || '0000000000',
        },
        'Owner Resource Request PDF access test'
      ),
    ];

    const otherApplication = await createTypedApplication(
      otherUser,
      'Other Society Fund Withdrawal',
      'fund_withdrawal',
      {
        applicationDate: new Date().toISOString(),
        recipientTitle: 'The President',
        throughTitle: 'The General Secretary',
        eventDate: '2026-04-30',
        eventTitle: 'Other Seminar',
        amount: '7000',
        usedFor: 'forbidden access test',
        applicantName: otherUser.name,
        applicantPosition: 'Member',
        registrationNumber: 'REG-OTHER',
        phoneNumber: otherUser.phone || '0000000000',
      },
      'Other Owner PDF access test'
    );

    tempApplications.push(...ownerApplications.map((application) => application.id), otherApplication.id);

    for (const application of ownerApplications) {
      const pdfResponse = await api.get(`/applications/${application.id}/pdf`, {
        headers: { Authorization: `Bearer ${societyToken}` },
        responseType: 'arraybuffer',
      });

      console.log(`${application.type} owner PDF status:`, pdfResponse.status);
      console.log(`${application.type} owner PDF content-type:`, pdfResponse.headers['content-type']);

      if (pdfResponse.status !== 200 || !String(pdfResponse.headers['content-type'] || '').includes('application/pdf')) {
        throw new Error(`Owner PDF request did not return a PDF response for ${application.type}`);
      }
    }

    const forbiddenResponse = await api.get(`/applications/${otherApplication.id}/pdf`, {
      headers: { Authorization: `Bearer ${societyToken}` },
      responseType: 'arraybuffer',
    });

    console.log('Forbidden PDF status:', forbiddenResponse.status);
    if (forbiddenResponse.status !== 403) {
      throw new Error('Society member was able to access another member\'s application PDF');
    }

    const adminPdfResponse = await api.get(`/applications/${otherApplication.id}/pdf`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      responseType: 'arraybuffer',
    });

    console.log('Admin PDF status:', adminPdfResponse.status);
    console.log('Admin PDF content-type:', adminPdfResponse.headers['content-type']);

    if (adminPdfResponse.status !== 200 || !String(adminPdfResponse.headers['content-type'] || '').includes('application/pdf')) {
      throw new Error('Admin PDF request did not return a PDF response');
    }

    for (const application of ownerApplications) {
      const ownerAuditLog = await waitForAuditLog(application.id, 'application_pdf_viewed');
      if (!ownerAuditLog) {
        throw new Error(`Missing audit log for society PDF view: ${application.type}`);
      }
    }

    const adminAuditLog = await waitForAuditLog(otherApplication.id, 'application_pdf_viewed');
    if (!adminAuditLog) {
      throw new Error('Missing audit log for admin PDF view');
    }

    console.log('Audit logs created for PDF views.');
    console.log('PASS');
  } finally {
    for (const applicationId of tempApplications) {
      await prisma.societyApplication.deleteMany({ where: { id: applicationId } });
    }

    for (const userId of tempUsers) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }

    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('PDF access test failed:', error.message);
  process.exitCode = 1;
});