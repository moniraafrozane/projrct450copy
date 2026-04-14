const prisma = require('../config/prisma');
const jwt = require('jsonwebtoken');
const { createAuditLog } = require('./auditLogController');
const { hashPassword, comparePassword } = require('../utils/password');

// Generate JWT Token
const signToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Send token response
const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user.id);
  
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      roles: user.roles,
      studentId: user.studentId,
      societyName: user.societyName,
      isActive: user.isActive
    }
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, role, studentId, program, year, societyName, societyRole } = req.body;
    const trimmedPhone = typeof phone === 'string' ? phone.trim() : '';
    const trimmedStudentId = typeof studentId === 'string' ? studentId.trim() : '';
    
    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }
    
    if (!role || !['student', 'admin', 'society'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Valid role (student, admin, or society) is required'
      });
    }
    
    const normalizedEmail = email.trim().toLowerCase();
    
    // Validation: Admin requires phone number
    if (role === 'admin' && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required for admin registration'
      });
    }

    // Validation: Student requires registration number and phone number
    if (role === 'student' && (!trimmedStudentId || !trimmedPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Registration number and phone number are required for student registration'
      });
    }
    
    // Check if user already exists by email
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    // Check if studentId already taken by a different account
    if (trimmedStudentId) {
      const existingStudent = await prisma.user.findUnique({
        where: { studentId: trimmedStudentId }
      });

      if (existingStudent && existingStudent.id !== existingUser?.id) {
        return res.status(400).json({
          success: false,
          message: 'Registration number already associated with another account'
        });
      }
    }

    // If email exists, allow adding a new role and persist submitted role-specific details
    if (existingUser) {
      if (existingUser.roles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: `You are already registered with the ${role} role`
        });
      }

      const roleUpdateData = {
        roles: { push: role }
      };

      if (role === 'student') {
        roleUpdateData.studentId = trimmedStudentId;
        roleUpdateData.program = program || existingUser.program;
        roleUpdateData.year = year || existingUser.year;
        roleUpdateData.phone = trimmedPhone || existingUser.phone;
      } else if (role === 'admin') {
        roleUpdateData.phone = trimmedPhone || existingUser.phone;
      } else if (role === 'society') {
        roleUpdateData.studentId = trimmedStudentId || existingUser.studentId;
        roleUpdateData.societyName = societyName || existingUser.societyName;
        roleUpdateData.societyRole = societyRole || existingUser.societyRole;
        roleUpdateData.year = year || existingUser.year;
      }

      const updatedUser = await prisma.user.update({
        where: { email: normalizedEmail },
        data: roleUpdateData
      });

      return sendTokenResponse(updatedUser, 200, res);
    }
    
    // Hash password
    const hashedPassword = await hashPassword(password);
    
    // Create user object based on role
    const userData = {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone: trimmedPhone || null,
      roles: [role]
    };
    
    // Add role-specific fields
    if (role === 'student') {
      userData.studentId = trimmedStudentId;
      userData.program = program;
      userData.year = year;
    } else if (role === 'society') {
      userData.studentId = trimmedStudentId || null;
      userData.societyName = societyName;
      userData.societyRole = societyRole;
      userData.year = year;
    }
    // Admin role doesn't need additional fields beyond name, email, password, phone
    
    // Create user
    const user = await prisma.user.create({
      data: userData
    });
    
    sendTokenResponse(user, 201, res);
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle Prisma-specific errors
    if (error.code === 'P2002') {
      // Unique constraint violation
      const field = error.meta?.target?.[0] || 'field';
      return res.status(400).json({
        success: false,
        message: `This ${field} is already registered. If you have an account with a different role, please use a different ${field}.`
      });
    }
    
    if (error.code === 'P2003') {
      // Foreign key constraint violation
      return res.status(400).json({
        success: false,
        message: 'Invalid reference data provided'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const requestedRole = typeof role === 'string' ? role.trim().toLowerCase() : undefined;
    
    // Validate email and password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }
    
    const normalizedEmail = email.trim().toLowerCase();

    if (requestedRole && !['student', 'admin', 'society'].includes(requestedRole)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }
    
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Check if user has the requested role
    const userRoles = Array.isArray(user.roles) ? user.roles : [];

    if (requestedRole && !userRoles.includes(requestedRole)) {
      return res.status(401).json({
        success: false,
        message: `You do not have a ${requestedRole} account`
      });
    }
    
    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact admin.'
      });
    }
    
    // Check if password matches
    if (!user.password || typeof user.password !== 'string') {
      return res.status(401).json({
        success: false,
        message: 'Account password is not set. Please reset your password.'
      });
    }

    const isPasswordMatch = await comparePassword(password, user.password);
    
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Update last login
    // Non-blocking update so login can still succeed if audit timestamp update fails.
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    }).catch((updateError) => {
      console.error('Failed to update lastLogin:', updateError.message);
    });
    
    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        roles: true,
        studentId: true,
        program: true,
        year: true,
        societyName: true,
        societyRole: true,
        isActive: true,
        isEmailVerified: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update user details
// @route   PUT /api/auth/update
// @access  Private
exports.updateDetails = async (req, res) => {
  try {
    const fieldsToUpdate = {};

    if (typeof req.body.name === 'string' && req.body.name.trim()) {
      fieldsToUpdate.name = req.body.name.trim();
    }

    if (typeof req.body.email === 'string' && req.body.email.trim()) {
      fieldsToUpdate.email = req.body.email.trim().toLowerCase();
    }

    if (typeof req.body.phone === 'string') {
      fieldsToUpdate.phone = req.body.phone.trim() || null;
    }

    if (req.user.roles?.includes('student') && typeof req.body.studentId === 'string') {
      fieldsToUpdate.studentId = req.body.studentId.trim() || null;
    }
    
    // Add role-specific fields
    if (req.user.roles?.includes('student')) {
      if (req.body.program) fieldsToUpdate.program = req.body.program;
      if (req.body.year) fieldsToUpdate.year = req.body.year;
    }
    if (req.user.roles?.includes('society')) {
      if (req.body.societyName) fieldsToUpdate.societyName = req.body.societyName;
      if (req.body.societyRole) fieldsToUpdate.societyRole = req.body.societyRole;
    }
    
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: fieldsToUpdate,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        roles: true,
        studentId: true,
        program: true,
        year: true,
        societyName: true,
        societyRole: true,
        isActive: true,
        isEmailVerified: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Update error:', error);

    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'field';
      return res.status(400).json({
        success: false,
        message: `${field} is already in use`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during update',
      error: error.message
    });
  }
};

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    
    // Check current password
    const isMatch = await comparePassword(req.body.currentPassword, user.password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Hash new password
    const hashedPassword = await hashPassword(req.body.newPassword);
    
    // Update password
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { 
        password: hashedPassword,
        passwordChangedAt: new Date()
      }
    });
    
    sendTokenResponse(updatedUser, 200, res);
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password update',
      error: error.message
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
};

// @desc    Get all users
// @route   GET /api/auth/users
// @access  Private
exports.getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        roles: true,
        studentId: true,
        societyName: true,
        societyRole: true,
        year: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Close user account
// @route   PUT /api/auth/users/:id/close
// @access  Private/Admin
exports.closeUserAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Closure reason is required',
      });
    }

    if (req.user.id === id) {
      return res.status(400).json({
        success: false,
        message: 'Admin cannot close their own account',
      });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!target.isActive) {
      return res.status(400).json({
        success: false,
        message: 'User account is already closed',
      });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
        studentId: true,
        societyName: true,
        societyRole: true,
        year: true,
        isActive: true,
      },
    });

    // Log audit trail
    createAuditLog({
      action: 'user_account_closed',
      module: 'user_management',
      description: `User account closed: ${target.name} (${target.email}). Reason: ${reason.trim()}`,
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorName: req.user.name,
      actorRole: 'admin',
      resourceId: target.id,
      resourceType: 'User',
      resourceName: target.name,
      previousValue: 'active',
      newValue: 'closed',
      metadata: {
        targetUserId: target.id,
        targetEmail: target.email,
        closureReason: reason.trim(),
        closedAt: new Date().toISOString(),
      }
    }).catch(err => console.error('Audit log error:', err));

    res.status(200).json({
      success: true,
      message: `Account closed successfully. Reason: ${reason.trim()}`,
      user,
    });
  } catch (error) {
    console.error('Close account error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while closing account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
