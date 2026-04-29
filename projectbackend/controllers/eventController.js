const prisma = require('../config/prisma');
const { createAuditLog } = require('./auditLogController');

// Helper function to calculate actual event status based on date/time
const calculateEventStatus = (event) => {
  const now = new Date();
  const eventDate = new Date(event.eventDate);
  
  // Parse start and end times
  const [startHour, startMin] = event.startTime.split(':').map(Number);
  const [endHour, endMin] = event.endTime.split(':').map(Number);
  
  const eventStart = new Date(eventDate);
  eventStart.setHours(startHour, startMin, 0, 0);
  
  const eventEnd = new Date(eventDate);
  eventEnd.setHours(endHour, endMin, 0, 0);
  
  // Calculate status
  if (now < eventStart) {
    return 'upcoming';
  } else if (now >= eventStart && now <= eventEnd) {
    return 'ongoing';
  } else {
    return 'completed';
  }
};

// Get all pending certificate applications for an event
exports.getPendingCertificates = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    // Check if event exists and user is authorized to manage it
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, organizerId: true }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Allow event organizer or admin to see pending certificates
    if (event.organizerId !== userId && !req.user.roles?.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this event'
      });
    }

    // Fetch all pending certificate applications
    const pendingCertificates = await prisma.eventRegistration.findMany({
      where: {
        eventId: eventId,
        certificateRequestStatus: 'pending'
      },
      select: {
        id: true,
        userId: true,
        userName: true,
        userEmail: true,
        userPhone: true,
        registrationNumber: true,
        certificateRequestedAt: true,
        certificateFileUrl: true,
        attended: true,
        event: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: { certificateRequestedAt: 'asc' }
    });

    return res.json({
      success: true,
      message: 'Pending certificates fetched successfully',
      pendingCertificates: pendingCertificates,
      count: pendingCertificates.length
    });
  } catch (error) {
    console.error('Get pending certificates error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching pending certificates',
      error: error.message
    });
  }
};

// Upload certificate file for a student
exports.uploadCertificate = async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No certificate file provided'
      });
    }

    // Verify event exists and user is authorized
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizerId: true }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (event.organizerId !== userId && !req.user.roles?.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to upload certificate for this event'
      });
    }

    // Find the registration
    const registration = await prisma.eventRegistration.findFirst({
      where: {
        id: registrationId,
        eventId: eventId,
        certificateRequestStatus: 'pending'
      }
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Pending certificate application not found'
      });
    }

    // Store the file path
    const fileUrl = `/uploads/certificates/${req.file.filename}`;

    // Update registration with certificate file URL
    const updated = await prisma.eventRegistration.update({
      where: { id: registrationId },
      data: {
        certificateFileUrl: fileUrl,
        updatedAt: new Date()
      }
    });

    // Log audit trail
    createAuditLog({
      action: 'certificate_uploaded',
      module: 'certificates',
      description: `Certificate uploaded for student ${registration.userName} in event ${event.title}`,
      actorId: userId,
      actorEmail: req.user.email,
      actorName: req.user.name,
      actorRole: event.organizerId === userId ? 'society' : 'admin',
      resourceId: registrationId,
      resourceType: 'EventRegistration',
      resourceName: `${registration.userName} - ${event.title}`,
      metadata: {
        eventId: eventId,
        eventTitle: event.title,
        fileName: req.file.originalname,
        fileSize: req.file.size
      }
    }).catch(err => console.error('Audit log error:', err));

    return res.json({
      success: true,
      message: 'Certificate uploaded successfully',
      registration: updated,
      fileUrl: fileUrl
    });
  } catch (error) {
    console.error('Upload certificate error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error uploading certificate',
      error: error.message
    });
  }
};

// Approve certificate and notify student
exports.approveCertificate = async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;
    const userId = req.user.id;

    // Verify event exists and user is authorized
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, organizerId: true }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (event.organizerId !== userId && !req.user.roles?.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to approve certificates for this event'
      });
    }

    // Find the registration
    const registration = await prisma.eventRegistration.findFirst({
      where: {
        id: registrationId,
        eventId: eventId
      },
      include: {
        event: {
          select: { title: true }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    if (registration.certificateRequestStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Certificate request is not in pending status'
      });
    }

    if (!registration.certificateFileUrl) {
      return res.status(400).json({
        success: false,
        message: 'Certificate file has not been uploaded yet'
      });
    }

    const approvedAt = new Date();

    // Update registration status to approved
    const updated = await prisma.eventRegistration.update({
      where: { id: registrationId },
      data: {
        certificateRequestStatus: 'approved',
        certificateApprovedAt: approvedAt,
        updatedAt: approvedAt
      }
    });

    // Log the approval event
    await appendRegistrationLog({
      registrationId: registration.id,
      eventType: 'certificate_approved',
      actorRole: 'society',
      actorId: userId,
      actorName: req.user.name,
      message: 'Certificate approved and forwarded to student',
      previousStatus: 'pending',
      nextStatus: 'approved',
      metadata: {
        approvedAt: approvedAt.toISOString(),
        eventId: event.id,
        eventName: event.title
      },
      createdAt: approvedAt
    });

    // Log audit trail
    createAuditLog({
      action: 'certificate_approved',
      module: 'certificates',
      description: `Certificate approved for student ${registration.userName} in event ${event.title}`,
      actorId: userId,
      actorEmail: req.user.email,
      actorName: req.user.name,
      actorRole: event.organizerId === userId ? 'society' : 'admin',
      resourceId: registrationId,
      resourceType: 'EventRegistration',
      resourceName: `${registration.userName} - ${event.title}`,
      metadata: {
        eventId: event.id,
        eventTitle: event.title,
        studentId: registration.userId,
        approvedAt: approvedAt.toISOString()
      }
    }).catch(err => console.error('Audit log error:', err));

    return res.json({
      success: true,
      message: 'Certificate approved and notification sent to student',
      registration: updated,
      notificationMessage: `Your certificate for "${event.title}" has been approved. You can now download it from the app.`
    });
  } catch (error) {
    console.error('Approve certificate error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error approving certificate',
      error: error.message
    });
  }
};

// Reject certificate request
exports.rejectCertificate = async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;
    const userId = req.user.id;

    // Verify event exists and user is authorized
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, organizerId: true }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (event.organizerId !== userId && !req.user.roles?.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reject certificates for this event'
      });
    }

    const registration = await prisma.eventRegistration.findFirst({
      where: {
        id: registrationId,
        eventId: eventId
      }
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    if (registration.certificateRequestStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Certificate request is not in pending status'
      });
    }

    const updated = await prisma.eventRegistration.update({
      where: { id: registrationId },
      data: {
        certificateRequestStatus: 'rejected',
        updatedAt: new Date()
      }
    });

    // Log audit trail
    createAuditLog({
      action: 'certificate_rejected',
      module: 'certificates',
      description: `Certificate request rejected for student ${registration.userName} in event ${event.title}`,
      actorId: userId,
      actorEmail: req.user.email,
      actorName: req.user.name,
      actorRole: event.organizerId === userId ? 'society' : 'admin',
      resourceId: registrationId,
      resourceType: 'EventRegistration',
      resourceName: `${registration.userName} - ${event.title}`,
      metadata: {
        eventId: event.id,
        eventTitle: event.title,
        studentId: registration.userId,
        rejectedAt: new Date().toISOString()
      }
    }).catch(err => console.error('Audit log error:', err));

    return res.json({
      success: true,
      message: 'Certificate request rejected successfully',
      registration: updated
    });
  } catch (error) {
    console.error('Reject certificate error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error rejecting certificate request',
      error: error.message
    });
  }
};

const isAdminUser = (user) => Array.isArray(user?.roles) && user.roles.includes('admin');
const isSocietyUser = (user) => Array.isArray(user?.roles) && user.roles.includes('society');
const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const toMinutes = (time) => {
  const [hour, minute] = String(time).split(':').map(Number);
  return hour * 60 + minute;
};

const mapRequestedStatusToRegistrationStatus = (requestedStatus) => {
  const normalised = String(requestedStatus || '').toLowerCase();
  if (normalised === 'under_review' || normalised === 'waitlisted') return 'waitlisted';
  if (normalised === 'approved' || normalised === 'confirmed') return 'confirmed';
  if (normalised === 'rejected' || normalised === 'cancelled') return 'cancelled';
  return null;
};

const resolveStatusEventType = (status) => {
  if (status === 'waitlisted') return 'under_review';
  if (status === 'confirmed') return 'approved';
  if (status === 'cancelled') return 'rejected';
  return 'under_review';
};

const appendRegistrationLog = async ({
  registrationId,
  eventType,
  actorRole = 'system',
  actorId,
  actorName,
  message,
  previousStatus,
  nextStatus,
  metadata,
  createdAt,
}) => {
  return prisma.eventRegistrationLog.create({
    data: {
      registrationId,
      eventType,
      actorRole,
      actorId,
      actorName,
      message,
      previousStatus,
      nextStatus,
      metadata,
      ...(createdAt ? { createdAt } : {}),
    },
  });
};

const buildEventNotificationContent = ({ event, type, actor }) => {
  if (type === 'event_updated') {
    return {
      title: 'Event updated',
      message: `${actor.name || 'A user'} updated the event "${event.title}".`,
    };
  }

  return {
    title: 'New event published',
    message: `${actor.name || 'A user'} created a new event "${event.title}".`,
  };
};

const notifyStudentsForEventAction = async ({ event, type, actor }) => {
  if (!event?.id || !event?.title || !actor?.id) {
    return;
  }

  const recipients = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { has: 'student' },
    },
    select: { id: true },
  });

  if (!recipients.length) {
    return;
  }

  const { title, message } = buildEventNotificationContent({ event, type, actor });

  await prisma.notification.createMany({
    data: recipients.map((recipient) => ({
      recipientId: recipient.id,
      actorId: actor.id,
      eventId: event.id,
      type,
      title,
      message,
      metadata: {
        eventTitle: event.title,
        organizerName: event.organizerName || actor.societyName || actor.name || null,
      },
    })),
  });
};

// Create a new event
exports.createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      eventType,
      category,
      venue,
      eventDate,
      startTime,
      endTime,
      speaker,
      eligibility,
      keyTopics,
      benefits,
      maxParticipants,
      registrationDeadline,
      registrationFee,
      registrationDetails,
      organizerName,
      organizerContact,
      contactInfo,
      bannerImage
    } = req.body;

    // Debug logging
    console.log('Creating event with bannerImage:', bannerImage);
    console.log('Full request body:', JSON.stringify(req.body, null, 2));

    if (!title || !description || !venue || !eventDate || !startTime || !endTime || !organizerName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    const event = await prisma.event.create({
      data: {
        title,
        description,
        eventType,
        category,
        venue,
        eventDate: new Date(eventDate),
        startTime,
        endTime,
        speaker,
        eligibility,
        keyTopics,
        benefits,
        maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
        registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
        registrationFee: registrationFee ? parseFloat(registrationFee) : 0,
        registrationDetails,
        organizerId: req.user.id,
        organizerName,
        organizerContact,
        contactInfo,
        bannerImage
      }
    });

    notifyStudentsForEventAction({
      event,
      type: 'event_created',
      actor: req.user,
    }).catch((err) => console.error('Notification write error:', err));

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating event',
      error: error.message
    });
  }
};

// Get all events
exports.getAllEvents = async (req, res) => {
  try {
    const { status, category, search, upcoming, page = 1, limit } = req.query;
    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = limit ? parseInt(limit, 10) : null;
    const usePagination = Number.isInteger(parsedLimit) && parsedLimit > 0;
    const skip = usePagination ? (parsedPage - 1) * parsedLimit : 0;
    const where = { isPublished: true };

    // Base filters
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Fetch all events that match base criteria
    const allEvents = await prisma.event.findMany({
      where,
      include: { _count: { select: { registrations: true } } },
      orderBy: { eventDate: 'asc' }
    });

    // Calculate actual status for each event and filter by requested status
    let filteredEvents = allEvents.map(event => ({
      ...event,
      status: calculateEventStatus(event)
    }));

    // Filter by status if requested
    if (status) {
      filteredEvents = filteredEvents.filter(event => event.status === status);
    }

    // Handle legacy 'upcoming' parameter
    if (upcoming === 'true') {
      filteredEvents = filteredEvents.filter(event => event.status === 'upcoming');
    }

    // Apply pagination
    const total = filteredEvents.length;
    const paginatedEvents = usePagination
      ? filteredEvents.slice(skip, skip + parsedLimit)
      : filteredEvents;

    res.json({
      success: true,
      events: paginatedEvents,
      pagination: {
        total,
        page: parsedPage,
        limit: usePagination ? parsedLimit : null,
        pages: usePagination ? Math.ceil(total / parsedLimit) : 1
      }
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching events',
      error: error.message
    });
  }
};

// Get all published events created by society members
exports.getSocietyEvents = async (req, res) => {
  try {
    const { page = 1, limit, search } = req.query;
    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = limit ? parseInt(limit, 10) : null;
    const usePagination = Number.isInteger(parsedLimit) && parsedLimit > 0;
    const skip = usePagination ? (parsedPage - 1) * parsedLimit : 0;

    const societyUsers = await prisma.user.findMany({
      where: { roles: { has: 'society' } },
      select: { id: true },
    });

    const societyUserIds = societyUsers.map((user) => user.id);
    if (!societyUserIds.length) {
      return res.json({
        success: true,
        events: [],
        pagination: {
          total: 0,
          page: parsedPage,
          limit: usePagination ? parsedLimit : null,
          pages: 0,
        },
      });
    }

    const where = {
      isPublished: true,
      organizerId: { in: societyUserIds },
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, events] = await Promise.all([
      prisma.event.count({ where }),
      prisma.event.findMany({
        where,
        include: { _count: { select: { registrations: true } } },
        orderBy: { eventDate: 'desc' },
        ...(usePagination ? { skip, take: parsedLimit } : {}),
      }),
    ]);

    const eventsWithStatus = events.map((event) => ({
      ...event,
      status: calculateEventStatus(event),
    }));

    return res.json({
      success: true,
      events: eventsWithStatus,
      pagination: {
        total,
        page: parsedPage,
        limit: usePagination ? parsedLimit : null,
        pages: usePagination ? Math.ceil(total / parsedLimit) : 1,
      },
    });
  } catch (error) {
    console.error('Get society events error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching society events',
      error: error.message,
    });
  }
};

// Get single event
exports.getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        registrations: {
          select: {
            id: true,
            userName: true,
            userEmail: true,
            registrationDate: true,
            status: true,
            paymentStatus: true
          }
        },
        _count: { select: { registrations: true } }
      }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Calculate actual status
    const eventWithStatus = {
      ...event,
      status: calculateEventStatus(event)
    };

    res.json({ success: true, event: eventWithStatus });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching event',
      error: error.message
    });
  }
};

// Update event
exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const canManageAllEvents = isAdminUser(req.user) || isSocietyUser(req.user);
    if (event.organizerId !== req.user.id && !canManageAllEvents) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'venue')) {
      if (typeof updateData.venue !== 'string' || !updateData.venue.trim()) {
        return res.status(400).json({ success: false, message: 'Venue is required' });
      }
      updateData.venue = updateData.venue.trim();
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'eventDate')) {
      const parsedEventDate = new Date(updateData.eventDate);
      if (Number.isNaN(parsedEventDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid event date' });
      }
      updateData.eventDate = parsedEventDate;
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'startTime')) {
      if (typeof updateData.startTime !== 'string' || !TIME_24H_REGEX.test(updateData.startTime)) {
        return res.status(400).json({ success: false, message: 'Invalid start time format. Use HH:MM' });
      }
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'endTime')) {
      if (typeof updateData.endTime !== 'string' || !TIME_24H_REGEX.test(updateData.endTime)) {
        return res.status(400).json({ success: false, message: 'Invalid end time format. Use HH:MM' });
      }
    }

    const startTimeToValidate = updateData.startTime || event.startTime;
    const endTimeToValidate = updateData.endTime || event.endTime;
    if (TIME_24H_REGEX.test(startTimeToValidate) && TIME_24H_REGEX.test(endTimeToValidate)) {
      if (toMinutes(startTimeToValidate) >= toMinutes(endTimeToValidate)) {
        return res.status(400).json({ success: false, message: 'Start time must be earlier than end time' });
      }
    }

    if (updateData.registrationDeadline) {
      const parsedDeadline = new Date(updateData.registrationDeadline);
      if (Number.isNaN(parsedDeadline.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid registration deadline' });
      }
      updateData.registrationDeadline = parsedDeadline;
    }
    if (updateData.maxParticipants !== undefined && updateData.maxParticipants !== null) {
      const parsedMaxParticipants = parseInt(updateData.maxParticipants, 10);
      if (Number.isNaN(parsedMaxParticipants) || parsedMaxParticipants <= 0) {
        return res.status(400).json({ success: false, message: 'maxParticipants must be a positive number' });
      }
      updateData.maxParticipants = parsedMaxParticipants;
    }
    if (updateData.registrationFee !== undefined) {
      const parsedFee = parseFloat(updateData.registrationFee);
      if (Number.isNaN(parsedFee) || parsedFee < 0) {
        return res.status(400).json({ success: false, message: 'registrationFee must be a non-negative number' });
      }
      updateData.registrationFee = parsedFee;
    }

    const updatedEvent = await prisma.event.update({ where: { id }, data: updateData });

    notifyStudentsForEventAction({
      event: updatedEvent,
      type: 'event_updated',
      actor: req.user,
    }).catch((err) => console.error('Notification write error:', err));

    res.json({
      success: true,
      message: 'Event updated successfully',
      event: updatedEvent
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating event',
      error: error.message
    });
  }
};

// Delete event
exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await prisma.event.findUnique({ where: { id } });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.organizerId !== req.user.id && !req.user.roles?.includes('admin')) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await prisma.event.delete({ where: { id } });
    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting event',
      error: error.message
    });
  }
};

// Register for event
exports.registerForEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { remarks, registrationNumber, fullName, email, userPhone, teamName, institution } = req.body;
    const userId = req.user.id;
    const normalizedPhone = typeof userPhone === 'string' ? userPhone.trim() : '';

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { _count: { select: { registrations: true } } }
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (!event.isPublished) {
      return res.status(400).json({ success: false, message: 'Event is not open for registration' });
    }

    if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline)) {
      return res.status(400).json({ success: false, message: 'Registration deadline has passed' });
    }

    if (event.maxParticipants && event._count.registrations >= event.maxParticipants) {
      return res.status(400).json({ success: false, message: 'Event is full' });
    }

    const existingRegistration = await prisma.eventRegistration.findUnique({
      where: { userId_eventId: { userId, eventId } }
    });

    if (existingRegistration) {
      return res.status(400).json({ success: false, message: 'Already registered for this event' });
    }

    // Validate required fields
    if (!fullName || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Full Name and Email are required for registration' 
      });
    }

    const registration = await prisma.eventRegistration.create({
      data: {
        userId,
        userName: fullName,
        userEmail: email,
        userPhone: normalizedPhone || req.user.phone || null,
        registrationNumber: registrationNumber || req.user.studentId || null,
        teamName,
        institution,
        eventId,
        remarks,
        paymentStatus: event.registrationFee > 0 ? 'pending' : 'paid'
      }
    });

    await appendRegistrationLog({
      registrationId: registration.id,
      eventType: 'submitted',
      actorRole: 'student',
      actorId: req.user.id,
      actorName: fullName,
      message: 'Application submitted',
      nextStatus: registration.status,
      metadata: {
        eventId,
        eventName: event.title,
      },
      createdAt: registration.registrationDate,
    });

    res.status(201).json({
      success: true,
      message: 'Successfully registered for the event',
      registration
    });
  } catch (error) {
    console.error('Event registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering for event',
      error: error.message
    });
  }
};

// Cancel registration
exports.cancelRegistration = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    const registration = await prisma.eventRegistration.findUnique({
      where: { userId_eventId: { userId, eventId } }
    });

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    const previousStatus = registration.status;

    await prisma.eventRegistration.update({
      where: { id: registration.id },
      data: { status: 'cancelled' }
    });

    await appendRegistrationLog({
      registrationId: registration.id,
      eventType: 'rejected',
      actorRole: 'student',
      actorId: req.user.id,
      actorName: req.user.name,
      message: 'Registration cancelled by student',
      previousStatus,
      nextStatus: 'cancelled',
    });

    res.json({ success: true, message: 'Registration cancelled successfully' });
  } catch (error) {
    console.error('Cancel registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling registration',
      error: error.message
    });
  }
};

// Get my registrations
exports.getMyRegistrations = async (req, res) => {
  try {
    const userId = req.user.id;
    const registrations = await prisma.eventRegistration.findMany({
      where: { userId },
      include: { event: true },
      orderBy: { createdAt: 'desc' }
    });

    const organizerIds = Array.from(
      new Set(registrations.map((registration) => registration.event?.organizerId).filter(Boolean))
    );

    const societyOrganizers = organizerIds.length
      ? await prisma.user.findMany({
          where: {
            id: { in: organizerIds },
            roles: { has: 'society' },
          },
          select: { id: true },
        })
      : [];

    const societyOrganizerIds = new Set(societyOrganizers.map((user) => user.id));
    const societyRegistrations = registrations.filter((registration) =>
      societyOrganizerIds.has(registration.event?.organizerId)
    );

    // Calculate actual status for each event
    const registrationsWithStatus = societyRegistrations.map(registration => ({
      ...registration,
      event: {
        ...registration.event,
        status: calculateEventStatus(registration.event)
      }
    }));

    res.json({ success: true, registrations: registrationsWithStatus });
  } catch (error) {
    console.error('Get registrations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching registrations',
      error: error.message
    });
  }
};

// Get a single registration audit log for the logged-in student
exports.getMyRegistrationLog = async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;
    const userId = req.user.id;

    const registration = await prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId, userId },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            eventDate: true,
            venue: true,
          },
        },
      },
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration log not found',
      });
    }

    const logs = await prisma.eventRegistrationLog.findMany({
      where: { registrationId: registration.id },
      orderBy: { createdAt: 'asc' },
    });

    const latestEventReport = await prisma.eventReport.findFirst({
      where: { eventId: registration.eventId },
      orderBy: { createdAt: 'desc' },
      select: { attendanceRecord: true },
    });

    const normaliseText = (value) => String(value || '').trim().toLowerCase();
    const toDisplayString = (value) => {
      if (value === null || value === undefined) return null;
      const normalized = String(value).trim();
      return normalized.length > 0 ? normalized : null;
    };

    const attendanceRecord =
      latestEventReport?.attendanceRecord && typeof latestEventReport.attendanceRecord === 'object'
        ? latestEventReport.attendanceRecord
        : null;

    const attendeeList = Array.isArray(attendanceRecord?.attendeeList)
      ? attendanceRecord.attendeeList
      : [];

    const matchedAttendee = attendeeList.find((attendee) => {
      if (!attendee || typeof attendee !== 'object') return false;

      const attendeeEmail = normaliseText(attendee.email);
      const attendeeId = normaliseText(attendee.id);
      const attendeeName = normaliseText(attendee.name);

      const registrationEmail = normaliseText(registration.userEmail);
      const registrationNumber = normaliseText(registration.registrationNumber);
      const registrationName = normaliseText(registration.userName);

      if (attendeeEmail && registrationEmail && attendeeEmail === registrationEmail) return true;
      if (attendeeId && registrationNumber && attendeeId === registrationNumber) return true;
      if (attendeeName && registrationName && attendeeName === registrationName) return true;
      return false;
    });

    const latestCertificateLog = [...logs]
      .reverse()
      .find((log) => ['certificate_ready', 'certificate_uploaded', 'certificate_issued'].includes(log.eventType));

    const position =
      toDisplayString(matchedAttendee?.position) ||
      toDisplayString(matchedAttendee?.award) ||
      toDisplayString(matchedAttendee?.result) ||
      null;

    const scoreValue =
      matchedAttendee?.score ??
      matchedAttendee?.marks ??
      matchedAttendee?.points ??
      null;

    const scoreOrMarks = toDisplayString(scoreValue);

    const performanceRemarks =
      toDisplayString(matchedAttendee?.remarks) ||
      toDisplayString(registration.remarks) ||
      null;

    const attendanceStatus =
      typeof matchedAttendee?.attended === 'boolean'
        ? (matchedAttendee.attended ? 'Attended' : 'Absent')
        : (registration.attended ? 'Attended' : 'Absent');

    const participationType = toDisplayString(registration.teamName) ? 'Team' : 'Solo';
    const isRegistered = registration.status !== 'cancelled';

    return res.json({
      success: true,
      registration: {
        id: registration.id,
        eventId: registration.eventId,
        eventName: registration.event.title,
        submittedAt: registration.registrationDate,
        status: registration.status,
        paymentStatus: registration.paymentStatus,
        attended: registration.attended,
        attendedAt: registration.attendedAt,
        certificateRequestStatus: registration.certificateRequestStatus,
        certificateRequestedAt: registration.certificateRequestedAt,
        registered: isRegistered,
        registrationDateTime: registration.registrationDate,
        certificateIssueTime: latestCertificateLog?.createdAt || null,
        attendanceStatus,
        participationType,
        position,
        scoreOrMarks,
        performanceRemarks,
      },
      logs,
    });
  } catch (error) {
    console.error('Get registration log error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching registration log',
      error: error.message,
    });
  }
};

// Admin updates attendance status for a specific registration.
exports.updateRegistrationAttendance = async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;
    const { attended } = req.body;

    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can update attendance',
      });
    }

    if (typeof attended !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'attended must be a boolean value',
      });
    }

    const registration = await prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId },
      include: {
        event: {
          select: { id: true, title: true },
        },
      },
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found',
      });
    }

    const updated = await prisma.eventRegistration.update({
      where: { id: registration.id },
      data: {
        attended,
        attendedAt: attended ? new Date() : null,
      },
    });

    await appendRegistrationLog({
      registrationId: registration.id,
      eventType: 'attendance_marked',
      actorRole: 'admin',
      actorId: req.user.id,
      actorName: req.user.name,
      message: attended ? 'Attendance marked as attended' : 'Attendance marked as not attended',
      metadata: {
        attended,
        eventId: registration.eventId,
        eventName: registration.event.title,
      },
    });

    return res.json({
      success: true,
      message: 'Attendance updated successfully',
      registration: updated,
    });
  } catch (error) {
    console.error('Update registration attendance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating registration attendance',
      error: error.message,
    });
  }
};

// Student applies for certificate for an attended event registration.
exports.applyForCertificate = async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;
    const userId = req.user.id;

    const registration = await prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId, userId },
      include: {
        event: {
          select: { id: true, title: true },
        },
      },
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found',
      });
    }

    if (registration.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Certificate can only be requested for approved registrations',
      });
    }

    if (registration.certificateRequestStatus === 'pending') {
      return res.status(409).json({
        success: false,
        message: 'Certificate request is already pending',
      });
    }

    if (registration.certificateRequestStatus === 'approved') {
      return res.status(409).json({
        success: false,
        message: 'Certificate request has already been approved',
      });
    }

    const requestedAt = new Date();
    const updated = await prisma.eventRegistration.update({
      where: { id: registration.id },
      data: {
        certificateRequestStatus: 'pending',
        certificateRequestedAt: requestedAt,
      },
    });

    await appendRegistrationLog({
      registrationId: registration.id,
      eventType: 'certificate_requested',
      actorRole: 'student',
      actorId: req.user.id,
      actorName: req.user.name,
      message: 'Certificate application submitted',
      metadata: {
        requestedAt: requestedAt.toISOString(),
        eventId: registration.eventId,
        eventName: registration.event.title,
      },
      createdAt: requestedAt,
    });

    return res.status(201).json({
      success: true,
      message: 'Certificate application submitted successfully',
      registration: updated,
    });
  } catch (error) {
    console.error('Apply for certificate error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error applying for certificate',
      error: error.message,
    });
  }
};

// Admin updates registration status and stores a timeline event.
exports.updateRegistrationStatus = async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;
    const { status, comment } = req.body;

    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can update registration status',
      });
    }

    const mappedStatus = mapRequestedStatusToRegistrationStatus(status);
    if (!mappedStatus) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Use under_review, approved, rejected, waitlisted, confirmed, or cancelled.',
      });
    }

    const registration = await prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId },
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found',
      });
    }

    const updated = await prisma.eventRegistration.update({
      where: { id: registration.id },
      data: { status: mappedStatus },
    });

    await appendRegistrationLog({
      registrationId: registration.id,
      eventType: resolveStatusEventType(mappedStatus),
      actorRole: 'admin',
      actorId: req.user.id,
      actorName: req.user.name,
      message: mappedStatus === 'confirmed' ? 'Application approved' : mappedStatus === 'cancelled' ? 'Application rejected' : 'Application moved to under review',
      previousStatus: registration.status,
      nextStatus: mappedStatus,
      metadata: comment ? { comment } : undefined,
    });

    if (comment) {
      await appendRegistrationLog({
        registrationId: registration.id,
        eventType: 'comment_added',
        actorRole: 'admin',
        actorId: req.user.id,
        actorName: req.user.name,
        message: 'Comment added by admin',
        metadata: { comment },
      });
    }

    return res.json({
      success: true,
      message: 'Registration status updated',
      registration: updated,
    });
  } catch (error) {
    console.error('Update registration status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating registration status',
      error: error.message,
    });
  }
};

// Admin adds comment to a registration timeline.
exports.addRegistrationComment = async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;
    const { comment } = req.body;

    if (!isAdminUser(req.user)) {
      return res.status(403).json({ success: false, message: 'Only admins can add comments' });
    }

    if (!comment || !String(comment).trim()) {
      return res.status(400).json({ success: false, message: 'Comment is required' });
    }

    const registration = await prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId },
      select: { id: true },
    });

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    const log = await appendRegistrationLog({
      registrationId: registration.id,
      eventType: 'comment_added',
      actorRole: 'admin',
      actorId: req.user.id,
      actorName: req.user.name,
      message: 'Comment added by admin',
      metadata: { comment: String(comment).trim() },
    });

    return res.json({ success: true, message: 'Comment added', log });
  } catch (error) {
    console.error('Add registration comment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error adding registration comment',
      error: error.message,
    });
  }
};

// Admin or system records timeline system events (e.g. email sent, certificate uploaded).
exports.addRegistrationSystemEvent = async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;
    const { eventType, message, metadata } = req.body;

    if (!isAdminUser(req.user)) {
      return res.status(403).json({ success: false, message: 'Only admins can add system events' });
    }

    const allowedEvents = ['certificate_uploaded', 'certificate_ready', 'email_sent', 'receipt_generated'];
    if (!allowedEvents.includes(eventType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid eventType for system event',
      });
    }

    const registration = await prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId },
      select: { id: true },
    });

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    const log = await appendRegistrationLog({
      registrationId: registration.id,
      eventType,
      actorRole: 'admin',
      actorId: req.user.id,
      actorName: req.user.name,
      message: message || 'System event recorded',
      metadata: metadata || null,
    });

    return res.json({ success: true, message: 'System event recorded', log });
  } catch (error) {
    console.error('Add registration system event error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error adding registration system event',
      error: error.message,
    });
  }
};

// Get my events
exports.getMyEvents = async (req, res) => {
  try {
    const userId = req.user.id;
    const events = await prisma.event.findMany({
      where: { organizerId: userId },
      include: { _count: { select: { registrations: true } } },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate actual status for each event
    const eventsWithStatus = events.map(event => ({
      ...event,
      status: calculateEventStatus(event)
    }));

    res.json({ success: true, events: eventsWithStatus });
  } catch (error) {
    console.error('Get my events error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching your events',
      error: error.message
    });
  }
};

// Get manageable events for admin/society users
exports.getManageableEvents = async (req, res) => {
  try {
    if (!isAdminUser(req.user) && !isSocietyUser(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage events' });
    }

    const events = await prisma.event.findMany({
      include: { _count: { select: { registrations: true } } },
      orderBy: { eventDate: 'asc' }
    });

    const eventsWithStatus = events.map(event => ({
      ...event,
      status: calculateEventStatus(event)
    }));

    return res.json({ success: true, events: eventsWithStatus });
  } catch (error) {
    console.error('Get manageable events error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching manageable events',
      error: error.message
    });
  }
};

// Get event statistics
exports.getEventStats = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await prisma.event.findUnique({ where: { id } });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.organizerId !== req.user.id && !req.user.roles?.includes('admin')) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const stats = await prisma.eventRegistration.groupBy({
      by: ['status', 'paymentStatus'],
      where: { eventId: id },
      _count: true
    });

    const totalRegistrations = await prisma.eventRegistration.count({
      where: { eventId: id }
    });

    res.json({
      success: true,
      stats: {
        totalRegistrations,
        breakdown: stats,
        capacity: event.maxParticipants,
        spotsRemaining: event.maxParticipants ? event.maxParticipants - totalRegistrations : null
      }
    });
  } catch (error) {
    console.error('Get event stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching event statistics',
      error: error.message
    });
  }
};
