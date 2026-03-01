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
    const updateData = req.body;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.organizerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (updateData.eventDate) updateData.eventDate = new Date(updateData.eventDate);
    if (updateData.registrationDeadline) updateData.registrationDeadline = new Date(updateData.registrationDeadline);
    if (updateData.maxParticipants) updateData.maxParticipants = parseInt(updateData.maxParticipants);
    if (updateData.registrationFee !== undefined) updateData.registrationFee = parseFloat(updateData.registrationFee);

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

    if (event.organizerId !== req.user.id && req.user.role !== 'admin') {
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
    const { remarks } = req.body;
    const userId = req.user.id;

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

    const user = await prisma.user.findUnique({ where: { id: userId } });

    const registration = await prisma.eventRegistration.create({
      data: {
        userId,
        userName: user.name,
        userEmail: user.email,
        userPhone: user.phone,
        eventId,
        remarks,
        paymentStatus: event.registrationFee > 0 ? 'pending' : 'paid'
      }
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

    await prisma.eventRegistration.update({
      where: { id: registration.id },
      data: { status: 'cancelled' }
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

// Get event statistics
exports.getEventStats = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await prisma.event.findUnique({ where: { id } });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.organizerId !== req.user.id && req.user.role !== 'admin') {
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
