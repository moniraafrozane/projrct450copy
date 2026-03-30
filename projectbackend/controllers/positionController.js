const prisma = require('../config/prisma');

// Position titles
const POSITION_TITLES = [
  'Vice President',
  'General Secretary',
  'Event and Cultural Secretary',
  'Sport Secretary',
  'Publication Secretary',
  'Assistant Event and Cultural Secretary',
  'Executive Member'
];

const ROLE_TO_TITLE = {
  VICE_PRESIDENT: 'Vice President',
  GENERAL_SECRETARY: 'General Secretary',
  EVENT_CULTURAL_SECRETARY: 'Event and Cultural Secretary',
  SPORTS_SECRETARY: 'Sport Secretary',
  PUBLICATION_SECRETARY: 'Publication Secretary',
  ASSISTANT_EVENT_CULTURAL_SECRETARY: 'Assistant Event and Cultural Secretary',
  EXECUTIVE_MEMBER: 'Executive Member'
};

const ensurePositionsInitialized = async () => {
  for (const title of POSITION_TITLES) {
    await prisma.position.upsert({
      where: { title },
      update: {},
      create: {
        title,
        description: `${title} Position`
      }
    });
  }
};

// @desc    Initialize positions in database
// @route   POST /api/positions/init
// @access  Private/Admin
exports.initializePositions = async (req, res) => {
  try {
    await ensurePositionsInitialized();

    // Check if positions already exist
    const existingPositions = await prisma.position.findMany();
    
    if (existingPositions.length > 0) {
      return res.status(200).json({
        success: true,
        message: 'Positions already initialized',
        count: existingPositions.length
      });
    }
    
    // Create all positions
    const positions = await Promise.all(
      POSITION_TITLES.map(title =>
        prisma.position.create({
          data: {
            title,
            description: `${title} Position`
          }
        })
      )
    );
    
    res.status(201).json({
      success: true,
      message: 'Positions initialized successfully',
      count: positions.length,
      positions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error initializing positions',
      error: error.message
    });
  }
};

// @desc    Get all positions
// @route   GET /api/positions
// @access  Private
exports.getPositions = async (req, res) => {
  try {
    await ensurePositionsInitialized();

    const positions = await prisma.position.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            studentId: true
          }
        }
      },
      orderBy: {
        title: 'asc'
      }
    });
    
    res.status(200).json({
      success: true,
      count: positions.length,
      positions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching positions',
      error: error.message
    });
  }
};

// @desc    Get position by ID
// @route   GET /api/positions/:id
// @access  Private
exports.getPositionById = async (req, res) => {
  try {
    const position = await prisma.position.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            studentId: true
          }
        }
      }
    });
    
    if (!position) {
      return res.status(404).json({
        success: false,
        message: 'Position not found'
      });
    }
    
    res.status(200).json({
      success: true,
      position
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching position',
      error: error.message
    });
  }
};

// @desc    Assign position to a user
// @route   POST /api/positions/assign
// @access  Private/Admin
exports.assignPosition = async (req, res) => {
  try {
    await ensurePositionsInitialized();

    const { positionId, userId, name, studentId, email, role } = req.body;

    // Support role-based payload:
    // { name, studentId, email, role } where role is enum key like VICE_PRESIDENT
    if (!positionId && !userId && role) {
      const mappedTitle = ROLE_TO_TITLE[role];

      if (!mappedTitle) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role provided'
        });
      }

      if (!email && !studentId) {
        return res.status(400).json({
          success: false,
          message: 'Email or studentId is required for role-based assignment'
        });
      }

      const user = await prisma.user.findFirst({
        where: {
          OR: [
            email ? { email: email.toLowerCase().trim() } : undefined,
            studentId ? { studentId } : undefined
          ].filter(Boolean)
        }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found for provided email/studentId'
        });
      }

      if (name && user.name !== name) {
        return res.status(400).json({
          success: false,
          message: 'Provided name does not match user record'
        });
      }

      const position = await prisma.position.findUnique({
        where: { title: mappedTitle }
      });

      if (!position) {
        return res.status(404).json({
          success: false,
          message: 'Position not found'
        });
      }

      if (position.userId && role !== 'EXECUTIVE_MEMBER' && position.userId !== user.id) {
        return res.status(400).json({
          success: false,
          message: `${role} already assigned`
        });
      }

      const updatedPosition = await prisma.position.update({
        where: { id: position.id },
        data: { userId: user.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              studentId: true
            }
          }
        }
      });

      return res.status(201).json({
        success: true,
        message: 'Position assigned successfully',
        data: {
          name: updatedPosition.user?.name,
          studentId: updatedPosition.user?.studentId,
          email: updatedPosition.user?.email,
          role,
          assignedAt: updatedPosition.updatedAt
        },
        position: updatedPosition
      });
    }
    
    // Validate required fields
    if (!positionId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Position ID and User ID are required (or provide name, studentId/email, and role)'
      });
    }
    
    // Check if position exists
    const position = await prisma.position.findUnique({
      where: { id: positionId }
    });
    
    if (!position) {
      return res.status(404).json({
        success: false,
        message: 'Position not found'
      });
    }
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if position is already assigned to another user
    const existingAssignment = await prisma.position.findFirst({
      where: {
        id: positionId,
        userId: { not: null }
      }
    });
    
    if (existingAssignment && existingAssignment.userId !== userId) {
      return res.status(400).json({
        success: false,
        message: `Position already assigned to ${existingAssignment.userId}. Please unassign first.`
      });
    }
    
    // Assign position to user
    const updatedPosition = await prisma.position.update({
      where: { id: positionId },
      data: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            studentId: true
          }
        }
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Position assigned successfully',
      position: updatedPosition
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error assigning position',
      error: error.message
    });
  }
};

// @desc    Assign position by title
// @route   POST /api/positions/assign-by-title
// @access  Private/Admin
exports.assignPositionByTitle = async (req, res) => {
  try {
    await ensurePositionsInitialized();

    const { positionTitle, userId } = req.body;
    
    // Validate required fields
    if (!positionTitle || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Position title and User ID are required'
      });
    }
    
    // Check if title is valid
    if (!POSITION_TITLES.includes(positionTitle)) {
      return res.status(400).json({
        success: false,
        message: `Invalid position title. Valid positions are: ${POSITION_TITLES.join(', ')}`
      });
    }
    
    // Find position by title
    const position = await prisma.position.findUnique({
      where: { title: positionTitle }
    });
    
    if (!position) {
      return res.status(404).json({
        success: false,
        message: 'Position not found'
      });
    }
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if position is already assigned to another user
    if (position.userId && position.userId !== userId) {
      return res.status(400).json({
        success: false,
        message: `Position "${positionTitle}" already assigned to another user. Please unassign first.`
      });
    }
    
    // Assign position to user
    const updatedPosition = await prisma.position.update({
      where: { id: position.id },
      data: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            studentId: true
          }
        }
      }
    });
    
    res.status(200).json({
      success: true,
      message: `${positionTitle} assigned successfully`,
      position: updatedPosition
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error assigning position',
      error: error.message
    });
  }
};

// @desc    Unassign position from user
// @route   PUT /api/positions/:id/unassign
// @access  Private/Admin
exports.unassignPosition = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if position exists
    const position = await prisma.position.findUnique({
      where: { id }
    });
    
    if (!position) {
      return res.status(404).json({
        success: false,
        message: 'Position not found'
      });
    }
    
    // Unassign position
    const updatedPosition = await prisma.position.update({
      where: { id },
      data: { userId: null },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            studentId: true
          }
        }
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Position unassigned successfully',
      position: updatedPosition
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error unassigning position',
      error: error.message
    });
  }
};

// @desc    Get available positions (not assigned)
// @route   GET /api/positions/available
// @access  Private
exports.getAvailablePositions = async (req, res) => {
  try {
    await ensurePositionsInitialized();

    const positions = await prisma.position.findMany({
      where: { userId: null },
      orderBy: { title: 'asc' }
    });
    
    res.status(200).json({
      success: true,
      count: positions.length,
      positions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching available positions',
      error: error.message
    });
  }
};

// @desc    Get user's positions
// @route   GET /api/positions/user/:userId
// @access  Private
exports.getUserPositions = async (req, res) => {
  try {
    const positions = await prisma.position.findMany({
      where: { userId: req.params.userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            studentId: true
          }
        }
      }
    });
    
    res.status(200).json({
      success: true,
      count: positions.length,
      positions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user positions',
      error: error.message
    });
  }
};
