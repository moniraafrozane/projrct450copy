const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  try {
    let token;
    
    // Check if authorization header exists and starts with Bearer
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route. Please login.'
      });
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from token
      req.user = await prisma.user.findUnique({
        where: { id: decoded.id }
      });
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Check if user is active
      if (!req.user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Your account has been deactivated'
        });
      }
      
      // Check if user changed password after token was issued
      if (req.user.passwordChangedAt) {
        const changedTimestamp = parseInt(req.user.passwordChangedAt.getTime() / 1000, 10);
        if (changedTimestamp > decoded.iat) {
          return res.status(401).json({
            success: false,
            message: 'Password was recently changed. Please login again.'
          });
        }
      }
      
      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route. Invalid token.'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user.roles || !req.user.roles.some(r => roles.includes(r))) {
      return res.status(403).json({
        success: false,
        message: `Not authorized to access this route`
      });
    }
    next();
  };
};
