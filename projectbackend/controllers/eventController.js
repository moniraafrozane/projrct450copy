const prisma = require('../config/prisma');

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
    const { status, category, search, upcoming, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
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
    const paginatedEvents = filteredEvents.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      events: paginatedEvents,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
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

    // Calculate actual status for each event
    const registrationsWithStatus = registrations.map(registration => ({
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

    return res.json({
      success: true,
      registration: {
        id: registration.id,
        eventId: registration.eventId,
        eventName: registration.event.title,
        submittedAt: registration.registrationDate,
        status: registration.status,
        paymentStatus: registration.paymentStatus,
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
