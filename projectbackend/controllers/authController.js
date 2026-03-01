const prisma = require('../config/prisma');
const jwt = require('jsonwebtoken');
const { hashPassword, comparePassword } = require('../utils/password');

// Generate JWT Token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
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
      role: user.role,
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
    
    // Validation: Admin requires phone number
    if (role === 'admin' && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required for admin registration'
      });
    }
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
    
    // Check if studentId already exists for students
    if (role === 'student' && studentId) {
      const existingStudent = await prisma.user.findUnique({
        where: { studentId }
      });
      
      if (existingStudent) {
        return res.status(400).json({
          success: false,
          message: 'Student ID already exists'
        });
      }
    }
    
    // Hash password
    const hashedPassword = await hashPassword(password);
    
    // Create user object based on role
    const userData = {
      name,
      email,
      password: hashedPassword,
      phone: phone || null,
      role
    };
    
    // Add role-specific fields
    if (role === 'student') {
      userData.studentId = studentId;
      userData.program = program;
      userData.year = year;
    } else if (role === 'society') {
      userData.societyName = societyName;
      userData.societyRole = societyRole;
    }
    // Admin role doesn't need additional fields beyond name, email, password, phone
    
    // Create user
    const user = await prisma.user.create({
      data: userData
    });
    
    sendTokenResponse(user, 201, res);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    
    // Validate email and password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }
    
    // Check for user
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Check if user role matches requested role
    if (role && user.role !== role) {
      return res.status(401).json({
        success: false,
        message: `Invalid credentials for ${role} login`
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
    const isPasswordMatch = await comparePassword(password, user.password);
    
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });
    
    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
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
        role: true,
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
    const fieldsToUpdate = {
      name: req.body.name,
      email: req.body.email
    };
    
    // Add role-specific fields
    if (req.user.role === 'student') {
      if (req.body.program) fieldsToUpdate.program = req.body.program;
      if (req.body.year) fieldsToUpdate.year = req.body.year;
    } else if (req.user.role === 'society') {
      if (req.body.societyName) fieldsToUpdate.societyName = req.body.societyName;
      if (req.body.societyRole) fieldsToUpdate.societyRole = req.body.societyRole;
    }
    
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: fieldsToUpdate
    });
    
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Update error:', error);
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
