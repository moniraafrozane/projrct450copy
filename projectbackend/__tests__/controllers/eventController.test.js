jest.mock('../../config/prisma', () => ({
  event: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  eventRegistration: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    groupBy: jest.fn(),
    count: jest.fn(),
  },
  eventRegistrationLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  eventReport: {
    findFirst: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  notification: {
    createMany: jest.fn(),
  },
}));
jest.mock('../../controllers/auditLogController', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

const prisma = require('../../config/prisma');
const { createAuditLog } = require('../../controllers/auditLogController');
const eventController = require('../../controllers/eventController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('controllers/eventController', () => {
  let consoleErrorSpy;
  let consoleLogSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    createAuditLog.mockResolvedValue(undefined);
    prisma.eventRegistrationLog.create.mockResolvedValue({ id: 'log-1' });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('getPendingCertificates', () => {
    it('returns 404 when the event does not exist', async () => {
      const req = { params: { eventId: 'e1' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(null);

      await eventController.getPendingCertificates(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 403 when the requester is neither organizer nor admin', async () => {
      const req = { params: { eventId: 'e1' }, user: { id: 'u2', roles: ['student'] } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({ id: 'e1', title: 'Event', organizerId: 'u1' });

      await eventController.getPendingCertificates(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns pending certificates for the organizer', async () => {
      const req = { params: { eventId: 'e1' }, user: { id: 'u1', roles: ['society'] } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({ id: 'e1', title: 'Event', organizerId: 'u1' });
      prisma.eventRegistration.findMany.mockResolvedValue([{ id: 'r1' }]);

      await eventController.getPendingCertificates(req, res);

      expect(prisma.eventRegistration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { eventId: 'e1', certificateRequestStatus: 'pending' },
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, count: 1 })
      );
    });
  });

  describe('uploadCertificate', () => {
    it('returns 400 when no file is provided', async () => {
      const req = { params: { eventId: 'e1', registrationId: 'r1' }, user: { id: 'u1' } };
      const res = mockRes();

      await eventController.uploadCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(prisma.event.findUnique).not.toHaveBeenCalled();
    });

    it('returns 404 when the event does not exist', async () => {
      const req = {
        params: { eventId: 'e1', registrationId: 'r1' },
        user: { id: 'u1' },
        file: { filename: 'cert.pdf' },
      };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(null);

      await eventController.uploadCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 403 when not authorized', async () => {
      const req = {
        params: { eventId: 'e1', registrationId: 'r1' },
        user: { id: 'u2', roles: [] },
        file: { filename: 'cert.pdf' },
      };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({ id: 'e1', organizerId: 'u1' });

      await eventController.uploadCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 404 when there is no pending registration', async () => {
      const req = {
        params: { eventId: 'e1', registrationId: 'r1' },
        user: { id: 'u1' },
        file: { filename: 'cert.pdf' },
      };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({ id: 'e1', organizerId: 'u1' });
      prisma.eventRegistration.findFirst.mockResolvedValue(null);

      await eventController.uploadCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('uploads a certificate and writes an audit log on success', async () => {
      const req = {
        params: { eventId: 'e1', registrationId: 'r1' },
        user: { id: 'u1', email: 'org@b.com', name: 'Org' },
        file: { filename: 'cert.pdf', originalname: 'cert.pdf', size: 1000 },
      };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({ id: 'e1', organizerId: 'u1', title: 'Event' });
      prisma.eventRegistration.findFirst.mockResolvedValue({ id: 'r1', userName: 'Stu' });
      prisma.eventRegistration.update.mockResolvedValue({ id: 'r1', certificateFileUrl: '/uploads/certificates/cert.pdf' });

      await eventController.uploadCertificate(req, res);

      expect(prisma.eventRegistration.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: expect.objectContaining({ certificateFileUrl: '/uploads/certificates/cert.pdf' }),
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, fileUrl: '/uploads/certificates/cert.pdf' })
      );
    });
  });

  describe('approveCertificate', () => {
    it('returns 404 when the event does not exist', async () => {
      const req = { params: { eventId: 'e1', registrationId: 'r1' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(null);

      await eventController.approveCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 403 when not authorized', async () => {
      const req = { params: { eventId: 'e1', registrationId: 'r1' }, user: { id: 'u2', roles: [] } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({ id: 'e1', organizerId: 'u1', title: 'Event' });

      await eventController.approveCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 404 when the registration is not found', async () => {
      const req = { params: { eventId: 'e1', registrationId: 'r1' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({ id: 'e1', organizerId: 'u1', title: 'Event' });
      prisma.eventRegistration.findFirst.mockResolvedValue(null);

      await eventController.approveCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 400 when certificate request is not pending', async () => {
      const req = { params: { eventId: 'e1', registrationId: 'r1' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({ id: 'e1', organizerId: 'u1', title: 'Event' });
      prisma.eventRegistration.findFirst.mockResolvedValue({
        id: 'r1',
        certificateRequestStatus: 'approved',
        certificateFileUrl: '/x.pdf',
      });

      await eventController.approveCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Certificate request is not in pending status' })
      );
    });

    it('returns 400 when the certificate file has not been uploaded', async () => {
      const req = { params: { eventId: 'e1', registrationId: 'r1' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({ id: 'e1', organizerId: 'u1', title: 'Event' });
      prisma.eventRegistration.findFirst.mockResolvedValue({
        id: 'r1',
        certificateRequestStatus: 'pending',
        certificateFileUrl: null,
      });

      await eventController.approveCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Certificate file has not been uploaded yet' })
      );
    });

    it('approves the certificate, logs the event, and writes an audit log', async () => {
      const req = {
        params: { eventId: 'e1', registrationId: 'r1' },
        user: { id: 'u1', name: 'Org', email: 'org@b.com' },
      };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({ id: 'e1', organizerId: 'u1', title: 'Event' });
      prisma.eventRegistration.findFirst.mockResolvedValue({
        id: 'r1',
        userId: 'stu-1',
        userName: 'Stu',
        certificateRequestStatus: 'pending',
        certificateFileUrl: '/x.pdf',
        event: { title: 'Event' },
      });
      prisma.eventRegistration.update.mockResolvedValue({ id: 'r1', certificateRequestStatus: 'approved' });

      await eventController.approveCertificate(req, res);

      expect(prisma.eventRegistration.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: expect.objectContaining({ certificateRequestStatus: 'approved' }),
      });
      expect(prisma.eventRegistrationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'certificate_approved', registrationId: 'r1' }),
        })
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('rejectCertificate', () => {
    it('returns 404 when the event does not exist', async () => {
      const req = { params: { eventId: 'e1', registrationId: 'r1' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(null);

      await eventController.rejectCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 403 when not authorized', async () => {
      const req = { params: { eventId: 'e1', registrationId: 'r1' }, user: { id: 'u2', roles: [] } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({ id: 'e1', organizerId: 'u1', title: 'Event' });

      await eventController.rejectCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 400 when certificate request is not pending', async () => {
      const req = { params: { eventId: 'e1', registrationId: 'r1' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({ id: 'e1', organizerId: 'u1', title: 'Event' });
      prisma.eventRegistration.findFirst.mockResolvedValue({ id: 'r1', certificateRequestStatus: 'rejected' });

      await eventController.rejectCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects a pending certificate request', async () => {
      const req = { params: { eventId: 'e1', registrationId: 'r1' }, user: { id: 'u1', name: 'Org' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({ id: 'e1', organizerId: 'u1', title: 'Event' });
      prisma.eventRegistration.findFirst.mockResolvedValue({
        id: 'r1',
        userName: 'Stu',
        userId: 'stu-1',
        certificateRequestStatus: 'pending',
      });
      prisma.eventRegistration.update.mockResolvedValue({ id: 'r1', certificateRequestStatus: 'rejected' });

      await eventController.rejectCertificate(req, res);

      expect(prisma.eventRegistration.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: expect.objectContaining({ certificateRequestStatus: 'rejected' }),
      });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('createEvent', () => {
    it('rejects when required fields are missing', async () => {
      const req = { body: { title: 'Event' }, user: { id: 'u1' } };
      const res = mockRes();

      await eventController.createEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it('creates the event and notifies students on success', async () => {
      const req = {
        body: {
          title: 'Event',
          description: 'Desc',
          venue: 'Hall',
          eventDate: '2026-08-01',
          startTime: '10:00',
          endTime: '12:00',
          organizerName: 'CS Society',
          maxParticipants: '50',
          registrationFee: '10',
        },
        user: { id: 'u1', name: 'Org' },
      };
      const res = mockRes();

      prisma.event.create.mockResolvedValue({ id: 'e1', title: 'Event', organizerId: 'u1' });
      prisma.user.findMany.mockResolvedValue([]);

      await eventController.createEvent(req, res);

      expect(prisma.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Event',
          organizerId: 'u1',
          maxParticipants: 50,
          registrationFee: 10,
        }),
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, event: expect.objectContaining({ id: 'e1' }) })
      );
    });
  });

  describe('getAllEvents', () => {
    it('returns published events filtered by computed status', async () => {
      const req = { query: {} };
      const res = mockRes();

      const now = new Date();
      const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      prisma.event.findMany.mockResolvedValue([
        { id: 'e1', eventDate: pastDate, startTime: '00:00', endTime: '01:00', _count: { registrations: 0 } },
      ]);

      await eventController.getAllEvents(req, res);

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isPublished: true } })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, events: expect.any(Array) })
      );
    });

    it('returns 500 on a database error', async () => {
      const req = { query: {} };
      const res = mockRes();

      prisma.event.findMany.mockRejectedValue(new Error('db down'));

      await eventController.getAllEvents(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getSocietyEvents', () => {
    it('returns an empty list when there are no society users', async () => {
      const req = { query: {} };
      const res = mockRes();

      prisma.user.findMany.mockResolvedValue([]);

      await eventController.getSocietyEvents(req, res);

      expect(prisma.event.findMany).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, events: [] })
      );
    });

    it('returns events organized by society users', async () => {
      const req = { query: {} };
      const res = mockRes();

      prisma.user.findMany.mockResolvedValue([{ id: 'soc-1' }]);
      prisma.event.count.mockResolvedValue(1);
      prisma.event.findMany.mockResolvedValue([
        { id: 'e1', eventDate: new Date(), startTime: '10:00', endTime: '11:00' },
      ]);

      await eventController.getSocietyEvents(req, res);

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizerId: { in: ['soc-1'] } }) })
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('getEventById', () => {
    it('returns 404 when the event does not exist', async () => {
      const req = { params: { id: 'e1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(null);

      await eventController.getEventById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns the event with computed status', async () => {
      const req = { params: { id: 'e1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({
        id: 'e1',
        eventDate: new Date(),
        startTime: '00:00',
        endTime: '23:59',
      });

      await eventController.getEventById(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, event: expect.objectContaining({ id: 'e1' }) })
      );
    });
  });

  describe('updateEvent', () => {
    const baseEvent = {
      id: 'e1',
      organizerId: 'u1',
      venue: 'Hall',
      startTime: '10:00',
      endTime: '12:00',
    };

    it('returns 404 when the event does not exist', async () => {
      const req = { params: { id: 'e1' }, body: {}, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(null);

      await eventController.updateEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 403 when the requester is not the organizer, admin, or society', async () => {
      const req = { params: { id: 'e1' }, body: { venue: 'New' }, user: { id: 'u2', roles: ['student'] } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(baseEvent);

      await eventController.updateEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 400 for an empty venue', async () => {
      const req = { params: { id: 'e1' }, body: { venue: '   ' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(baseEvent);

      await eventController.updateEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Venue is required' })
      );
    });

    it('returns 400 for an invalid event date', async () => {
      const req = { params: { id: 'e1' }, body: { eventDate: 'not-a-date' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(baseEvent);

      await eventController.updateEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid event date' })
      );
    });

    it('returns 400 for a malformed start time', async () => {
      const req = { params: { id: 'e1' }, body: { startTime: '99:99' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(baseEvent);

      await eventController.updateEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('start time') })
      );
    });

    it('returns 400 for a malformed end time', async () => {
      const req = { params: { id: 'e1' }, body: { endTime: 'nope' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(baseEvent);

      await eventController.updateEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('end time') })
      );
    });

    it('returns 400 when start time is not earlier than end time', async () => {
      const req = { params: { id: 'e1' }, body: { startTime: '13:00', endTime: '12:00' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(baseEvent);

      await eventController.updateEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Start time must be earlier than end time' })
      );
    });

    it('returns 400 for an invalid registration deadline', async () => {
      const req = { params: { id: 'e1' }, body: { registrationDeadline: 'bad-date' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(baseEvent);

      await eventController.updateEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid registration deadline' })
      );
    });

    it('returns 400 for a non-positive maxParticipants', async () => {
      const req = { params: { id: 'e1' }, body: { maxParticipants: '0' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(baseEvent);

      await eventController.updateEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'maxParticipants must be a positive number' })
      );
    });

    it('returns 400 for a negative registrationFee', async () => {
      const req = { params: { id: 'e1' }, body: { registrationFee: '-5' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(baseEvent);

      await eventController.updateEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'registrationFee must be a non-negative number' })
      );
    });

    it('updates the event and notifies students on success', async () => {
      const req = {
        params: { id: 'e1' },
        body: { venue: '  New Hall  ', maxParticipants: '100' },
        user: { id: 'u1', name: 'Org' },
      };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(baseEvent);
      prisma.event.update.mockResolvedValue({ ...baseEvent, venue: 'New Hall', maxParticipants: 100 });
      prisma.user.findMany.mockResolvedValue([]);

      await eventController.updateEvent(req, res);

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: expect.objectContaining({ venue: 'New Hall', maxParticipants: 100 }),
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Event updated successfully' })
      );
    });

    it('allows a society user who is not the organizer to update the event', async () => {
      const req = {
        params: { id: 'e1' },
        body: { venue: 'New Hall' },
        user: { id: 'other-society', roles: ['society'] },
      };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(baseEvent);
      prisma.event.update.mockResolvedValue({ ...baseEvent, venue: 'New Hall' });
      prisma.user.findMany.mockResolvedValue([]);

      await eventController.updateEvent(req, res);

      expect(res.status).not.toHaveBeenCalledWith(403);
      expect(prisma.event.update).toHaveBeenCalled();
    });
  });

  describe('deleteEvent', () => {
    it('returns 404 when the event does not exist', async () => {
      const req = { params: { id: 'e1' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(null);

      await eventController.deleteEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 403 when the requester is not the organizer or admin', async () => {
      const req = { params: { id: 'e1' }, user: { id: 'u2', roles: ['student'] } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({ id: 'e1', organizerId: 'u1' });

      await eventController.deleteEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.event.delete).not.toHaveBeenCalled();
    });

    it('deletes the event when the requester is the organizer', async () => {
      const req = { params: { id: 'e1' }, user: { id: 'u1', roles: ['society'] } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({ id: 'e1', organizerId: 'u1' });
      prisma.event.delete.mockResolvedValue({ id: 'e1' });

      await eventController.deleteEvent(req, res);

      expect(prisma.event.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Event deleted successfully' })
      );
    });
  });

  describe('registerForEvent', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    it('returns 404 when the event does not exist', async () => {
      const req = { params: { eventId: 'e1' }, body: {}, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(null);

      await eventController.registerForEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 400 when the event is not published', async () => {
      const req = { params: { eventId: 'e1' }, body: {}, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({
        id: 'e1',
        isPublished: false,
        _count: { registrations: 0 },
      });

      await eventController.registerForEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Event is not open for registration' })
      );
    });

    it('returns 400 when the registration deadline has passed', async () => {
      const req = { params: { eventId: 'e1' }, body: {}, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({
        id: 'e1',
        isPublished: true,
        registrationDeadline: new Date(Date.now() - 1000),
        _count: { registrations: 0 },
      });

      await eventController.registerForEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Registration deadline has passed' })
      );
    });

    it('returns 400 when the event is full', async () => {
      const req = { params: { eventId: 'e1' }, body: {}, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({
        id: 'e1',
        isPublished: true,
        registrationDeadline: futureDate,
        maxParticipants: 5,
        _count: { registrations: 5 },
      });

      await eventController.registerForEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Event is full' })
      );
    });

    it('returns 400 for a duplicate registration', async () => {
      const req = { params: { eventId: 'e1' }, body: {}, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({
        id: 'e1',
        isPublished: true,
        registrationDeadline: futureDate,
        maxParticipants: null,
        _count: { registrations: 0 },
      });
      prisma.eventRegistration.findUnique.mockResolvedValue({ id: 'existing-reg' });

      await eventController.registerForEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Already registered for this event' })
      );
    });

    it('returns 400 when fullName or email is missing', async () => {
      const req = { params: { eventId: 'e1' }, body: { fullName: '' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({
        id: 'e1',
        isPublished: true,
        registrationDeadline: futureDate,
        maxParticipants: null,
        _count: { registrations: 0 },
      });
      prisma.eventRegistration.findUnique.mockResolvedValue(null);

      await eventController.registerForEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Full Name and Email are required for registration' })
      );
      expect(prisma.eventRegistration.create).not.toHaveBeenCalled();
    });

    it('registers the student and logs the submission on success', async () => {
      const req = {
        params: { eventId: 'e1' },
        body: { fullName: 'Stu Dent', email: 'stu@b.com', userPhone: ' 0123 ' },
        user: { id: 'u1', phone: null, studentId: 'S1' },
      };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({
        id: 'e1',
        title: 'Event',
        isPublished: true,
        registrationDeadline: futureDate,
        maxParticipants: null,
        registrationFee: 0,
        _count: { registrations: 0 },
      });
      prisma.eventRegistration.findUnique.mockResolvedValue(null);
      prisma.eventRegistration.create.mockResolvedValue({
        id: 'reg-1',
        status: 'submitted',
        registrationDate: new Date(),
      });

      await eventController.registerForEvent(req, res);

      expect(prisma.eventRegistration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u1',
          userName: 'Stu Dent',
          userEmail: 'stu@b.com',
          userPhone: '0123',
          registrationNumber: 'S1',
          paymentStatus: 'paid',
        }),
      });
      expect(prisma.eventRegistrationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'submitted', registrationId: 'reg-1' }),
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('cancelRegistration', () => {
    it('returns 404 when the registration does not exist', async () => {
      const req = { params: { eventId: 'e1' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.eventRegistration.findUnique.mockResolvedValue(null);

      await eventController.cancelRegistration(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prisma.eventRegistration.update).not.toHaveBeenCalled();
    });

    it('cancels the registration and logs the event', async () => {
      const req = { params: { eventId: 'e1' }, user: { id: 'u1', name: 'Stu' } };
      const res = mockRes();

      prisma.eventRegistration.findUnique.mockResolvedValue({ id: 'reg-1', status: 'confirmed' });
      prisma.eventRegistration.update.mockResolvedValue({ id: 'reg-1', status: 'cancelled' });

      await eventController.cancelRegistration(req, res);

      expect(prisma.eventRegistration.update).toHaveBeenCalledWith({
        where: { id: 'reg-1' },
        data: { status: 'cancelled' },
      });
      expect(prisma.eventRegistrationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'rejected', previousStatus: 'confirmed', nextStatus: 'cancelled' }),
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Registration cancelled successfully' })
      );
    });
  });

  describe('getMyRegistrations', () => {
    it('returns only registrations for society-organized events', async () => {
      const req = { user: { id: 'u1' } };
      const res = mockRes();

      prisma.eventRegistration.findMany.mockResolvedValue([
        {
          id: 'reg-1',
          event: { organizerId: 'soc-1', eventDate: new Date(), startTime: '10:00', endTime: '11:00' },
        },
        {
          id: 'reg-2',
          event: { organizerId: 'non-soc', eventDate: new Date(), startTime: '10:00', endTime: '11:00' },
        },
      ]);
      prisma.user.findMany.mockResolvedValue([{ id: 'soc-1' }]);

      await eventController.getMyRegistrations(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          registrations: [expect.objectContaining({ id: 'reg-1' })],
        })
      );
    });

    it('returns 500 on a database error', async () => {
      const req = { user: { id: 'u1' } };
      const res = mockRes();

      prisma.eventRegistration.findMany.mockRejectedValue(new Error('db down'));

      await eventController.getMyRegistrations(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getEventRegistrations', () => {
    it('returns 404 when the event does not exist', async () => {
      const req = { params: { eventId: 'e1' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(null);

      await eventController.getEventRegistrations(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 403 when not authorized', async () => {
      const req = { params: { eventId: 'e1' }, user: { id: 'u2', roles: ['student'] } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({ id: 'e1', title: 'Event', organizerId: 'u1' });

      await eventController.getEventRegistrations(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns registrations for the organizer', async () => {
      const req = { params: { eventId: 'e1' }, user: { id: 'u1', roles: ['society'] } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({ id: 'e1', title: 'Event', organizerId: 'u1' });
      prisma.eventRegistration.findMany.mockResolvedValue([{ id: 'r1' }]);

      await eventController.getEventRegistrations(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, totalRegistrations: 1 })
      );
    });
  });

  describe('getMyRegistrationLog', () => {
    it('returns 404 when the registration does not belong to the user', async () => {
      const req = { params: { eventId: 'e1', registrationId: 'r1' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.eventRegistration.findFirst.mockResolvedValue(null);

      await eventController.getMyRegistrationLog(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns the registration log and derived attendance status', async () => {
      const req = { params: { eventId: 'e1', registrationId: 'r1' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.eventRegistration.findFirst.mockResolvedValue({
        id: 'r1',
        eventId: 'e1',
        userEmail: 'stu@b.com',
        registrationNumber: 'S1',
        userName: 'Stu',
        status: 'confirmed',
        paymentStatus: 'paid',
        attended: true,
        attendedAt: new Date(),
        certificateRequestStatus: null,
        certificateRequestedAt: null,
        registrationDate: new Date(),
        teamName: null,
        remarks: null,
        event: { id: 'e1', title: 'Event', eventDate: new Date(), venue: 'Hall' },
      });
      prisma.eventRegistrationLog.findMany.mockResolvedValue([]);
      prisma.eventReport.findFirst.mockResolvedValue(null);

      await eventController.getMyRegistrationLog(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          registration: expect.objectContaining({
            id: 'r1',
            attendanceStatus: 'Attended',
            participationType: 'Solo',
            registered: true,
          }),
        })
      );
    });
  });

  describe('updateRegistrationAttendance', () => {
    it('returns 403 for non-admin users', async () => {
      const req = {
        params: { eventId: 'e1', registrationId: 'r1' },
        body: { attended: true },
        user: { id: 'u1', roles: ['student'] },
      };
      const res = mockRes();

      await eventController.updateRegistrationAttendance(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 400 when attended is not a boolean', async () => {
      const req = {
        params: { eventId: 'e1', registrationId: 'r1' },
        body: { attended: 'yes' },
        user: { id: 'u1', roles: ['admin'] },
      };
      const res = mockRes();

      await eventController.updateRegistrationAttendance(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 404 when the registration is not found', async () => {
      const req = {
        params: { eventId: 'e1', registrationId: 'r1' },
        body: { attended: true },
        user: { id: 'u1', roles: ['admin'] },
      };
      const res = mockRes();

      prisma.eventRegistration.findFirst.mockResolvedValue(null);

      await eventController.updateRegistrationAttendance(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('marks attendance and writes a timeline log', async () => {
      const req = {
        params: { eventId: 'e1', registrationId: 'r1' },
        body: { attended: true },
        user: { id: 'admin-1', roles: ['admin'], name: 'Admin' },
      };
      const res = mockRes();

      prisma.eventRegistration.findFirst.mockResolvedValue({
        id: 'r1',
        eventId: 'e1',
        event: { id: 'e1', title: 'Event' },
      });
      prisma.eventRegistration.update.mockResolvedValue({ id: 'r1', attended: true });

      await eventController.updateRegistrationAttendance(req, res);

      expect(prisma.eventRegistration.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: expect.objectContaining({ attended: true, attendedAt: expect.any(Date) }),
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Attendance updated successfully' })
      );
    });
  });

  describe('applyForCertificate', () => {
    it('returns 404 when the registration is not found', async () => {
      const req = { params: { eventId: 'e1', registrationId: 'r1' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.eventRegistration.findFirst.mockResolvedValue(null);

      await eventController.applyForCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 400 when the registration is not confirmed', async () => {
      const req = { params: { eventId: 'e1', registrationId: 'r1' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.eventRegistration.findFirst.mockResolvedValue({
        id: 'r1',
        status: 'submitted',
        event: { id: 'e1', title: 'Event' },
      });

      await eventController.applyForCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 409 when a certificate request is already pending', async () => {
      const req = { params: { eventId: 'e1', registrationId: 'r1' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.eventRegistration.findFirst.mockResolvedValue({
        id: 'r1',
        status: 'confirmed',
        certificateRequestStatus: 'pending',
        event: { id: 'e1', title: 'Event' },
      });

      await eventController.applyForCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('returns 409 when the certificate has already been approved', async () => {
      const req = { params: { eventId: 'e1', registrationId: 'r1' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.eventRegistration.findFirst.mockResolvedValue({
        id: 'r1',
        status: 'confirmed',
        certificateRequestStatus: 'approved',
        event: { id: 'e1', title: 'Event' },
      });

      await eventController.applyForCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('submits a new certificate application', async () => {
      const req = { params: { eventId: 'e1', registrationId: 'r1' }, user: { id: 'u1', name: 'Stu' } };
      const res = mockRes();

      prisma.eventRegistration.findFirst.mockResolvedValue({
        id: 'r1',
        eventId: 'e1',
        status: 'confirmed',
        certificateRequestStatus: null,
        event: { id: 'e1', title: 'Event' },
      });
      prisma.eventRegistration.update.mockResolvedValue({ id: 'r1', certificateRequestStatus: 'pending' });

      await eventController.applyForCertificate(req, res);

      expect(prisma.eventRegistration.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: expect.objectContaining({ certificateRequestStatus: 'pending' }),
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('updateRegistrationStatus', () => {
    it('returns 403 for non-admin users', async () => {
      const req = {
        params: { eventId: 'e1', registrationId: 'r1' },
        body: { status: 'approved' },
        user: { id: 'u1', roles: ['student'] },
      };
      const res = mockRes();

      await eventController.updateRegistrationStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 400 for an invalid status', async () => {
      const req = {
        params: { eventId: 'e1', registrationId: 'r1' },
        body: { status: 'bogus' },
        user: { id: 'u1', roles: ['admin'] },
      };
      const res = mockRes();

      await eventController.updateRegistrationStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 404 when the registration is not found', async () => {
      const req = {
        params: { eventId: 'e1', registrationId: 'r1' },
        body: { status: 'approved' },
        user: { id: 'u1', roles: ['admin'] },
      };
      const res = mockRes();

      prisma.eventRegistration.findFirst.mockResolvedValue(null);

      await eventController.updateRegistrationStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('updates status to confirmed and logs the transition', async () => {
      const req = {
        params: { eventId: 'e1', registrationId: 'r1' },
        body: { status: 'approved' },
        user: { id: 'admin-1', roles: ['admin'], name: 'Admin' },
      };
      const res = mockRes();

      prisma.eventRegistration.findFirst.mockResolvedValue({ id: 'r1', status: 'submitted' });
      prisma.eventRegistration.update.mockResolvedValue({ id: 'r1', status: 'confirmed' });

      await eventController.updateRegistrationStatus(req, res);

      expect(prisma.eventRegistration.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: 'confirmed' },
      });
      expect(prisma.eventRegistrationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'approved', previousStatus: 'submitted', nextStatus: 'confirmed' }),
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Registration status updated' })
      );
    });

    it('writes an additional comment log entry when a comment is provided', async () => {
      const req = {
        params: { eventId: 'e1', registrationId: 'r1' },
        body: { status: 'rejected', comment: 'not eligible' },
        user: { id: 'admin-1', roles: ['admin'], name: 'Admin' },
      };
      const res = mockRes();

      prisma.eventRegistration.findFirst.mockResolvedValue({ id: 'r1', status: 'submitted' });
      prisma.eventRegistration.update.mockResolvedValue({ id: 'r1', status: 'cancelled' });

      await eventController.updateRegistrationStatus(req, res);

      expect(prisma.eventRegistrationLog.create).toHaveBeenCalledTimes(2);
      expect(prisma.eventRegistrationLog.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'comment_added', metadata: { comment: 'not eligible' } }),
        })
      );
    });
  });

  describe('addRegistrationComment', () => {
    it('returns 403 for non-admin users', async () => {
      const req = {
        params: { eventId: 'e1', registrationId: 'r1' },
        body: { comment: 'hi' },
        user: { id: 'u1', roles: ['student'] },
      };
      const res = mockRes();

      await eventController.addRegistrationComment(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 400 when the comment is blank', async () => {
      const req = {
        params: { eventId: 'e1', registrationId: 'r1' },
        body: { comment: '   ' },
        user: { id: 'u1', roles: ['admin'] },
      };
      const res = mockRes();

      await eventController.addRegistrationComment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 404 when the registration is not found', async () => {
      const req = {
        params: { eventId: 'e1', registrationId: 'r1' },
        body: { comment: 'hi' },
        user: { id: 'u1', roles: ['admin'] },
      };
      const res = mockRes();

      prisma.eventRegistration.findFirst.mockResolvedValue(null);

      await eventController.addRegistrationComment(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('adds a comment log entry on success', async () => {
      const req = {
        params: { eventId: 'e1', registrationId: 'r1' },
        body: { comment: '  hi there  ' },
        user: { id: 'admin-1', roles: ['admin'], name: 'Admin' },
      };
      const res = mockRes();

      prisma.eventRegistration.findFirst.mockResolvedValue({ id: 'r1' });
      prisma.eventRegistrationLog.create.mockResolvedValue({ id: 'log-1', message: 'Comment added by admin' });

      await eventController.addRegistrationComment(req, res);

      expect(prisma.eventRegistrationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'comment_added', metadata: { comment: 'hi there' } }),
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Comment added' })
      );
    });
  });

  describe('addRegistrationSystemEvent', () => {
    it('returns 403 for non-admin users', async () => {
      const req = {
        params: { eventId: 'e1', registrationId: 'r1' },
        body: { eventType: 'email_sent' },
        user: { id: 'u1', roles: ['student'] },
      };
      const res = mockRes();

      await eventController.addRegistrationSystemEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 400 for an unrecognized eventType', async () => {
      const req = {
        params: { eventId: 'e1', registrationId: 'r1' },
        body: { eventType: 'not_allowed' },
        user: { id: 'u1', roles: ['admin'] },
      };
      const res = mockRes();

      await eventController.addRegistrationSystemEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 404 when the registration is not found', async () => {
      const req = {
        params: { eventId: 'e1', registrationId: 'r1' },
        body: { eventType: 'email_sent' },
        user: { id: 'u1', roles: ['admin'] },
      };
      const res = mockRes();

      prisma.eventRegistration.findFirst.mockResolvedValue(null);

      await eventController.addRegistrationSystemEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('records the system event on success', async () => {
      const req = {
        params: { eventId: 'e1', registrationId: 'r1' },
        body: { eventType: 'email_sent', message: 'Sent confirmation email' },
        user: { id: 'admin-1', roles: ['admin'], name: 'Admin' },
      };
      const res = mockRes();

      prisma.eventRegistration.findFirst.mockResolvedValue({ id: 'r1' });
      prisma.eventRegistrationLog.create.mockResolvedValue({ id: 'log-1' });

      await eventController.addRegistrationSystemEvent(req, res);

      expect(prisma.eventRegistrationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'email_sent', message: 'Sent confirmation email' }),
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'System event recorded' })
      );
    });
  });

  describe('getMyEvents', () => {
    it('returns the events organized by the current user', async () => {
      const req = { user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findMany.mockResolvedValue([
        { id: 'e1', eventDate: new Date(), startTime: '10:00', endTime: '11:00' },
      ]);

      await eventController.getMyEvents(req, res);

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizerId: 'u1' } })
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('getManageableEvents', () => {
    it('returns 403 for users who are neither admin nor society', async () => {
      const req = { user: { id: 'u1', roles: ['student'] } };
      const res = mockRes();

      await eventController.getManageableEvents(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.event.findMany).not.toHaveBeenCalled();
    });

    it('returns all events for admins', async () => {
      const req = { user: { id: 'admin-1', roles: ['admin'] } };
      const res = mockRes();

      prisma.event.findMany.mockResolvedValue([
        { id: 'e1', eventDate: new Date(), startTime: '10:00', endTime: '11:00' },
      ]);

      await eventController.getManageableEvents(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('getEventStats', () => {
    it('returns 404 when the event does not exist', async () => {
      const req = { params: { id: 'e1' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue(null);

      await eventController.getEventStats(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 403 when not authorized', async () => {
      const req = { params: { id: 'e1' }, user: { id: 'u2', roles: [] } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({ id: 'e1', organizerId: 'u1' });

      await eventController.getEventStats(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns computed stats for the organizer', async () => {
      const req = { params: { id: 'e1' }, user: { id: 'u1' } };
      const res = mockRes();

      prisma.event.findUnique.mockResolvedValue({ id: 'e1', organizerId: 'u1', maxParticipants: 50 });
      prisma.eventRegistration.groupBy.mockResolvedValue([{ status: 'confirmed', paymentStatus: 'paid', _count: 3 }]);
      prisma.eventRegistration.count.mockResolvedValue(3);

      await eventController.getEventStats(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          stats: expect.objectContaining({ totalRegistrations: 3, capacity: 50, spotsRemaining: 47 }),
        })
      );
    });
  });
});
