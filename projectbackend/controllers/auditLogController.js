const prisma = require('../config/prisma');

// Helper function to create audit log entries
exports.createAuditLog = async ({
  action,
  module,
  description,
  actorId,
  actorEmail,
  actorName,
  actorRole,
  resourceId,
  resourceType,
  resourceName,
  previousValue,
  newValue,
  metadata,
  ipAddress,
}) => {
  try {
    return await prisma.adminAuditLog.create({
      data: {
        action,
        module,
        description,
        actorId,
        actorEmail,
        actorName,
        actorRole,
        resourceId,
        resourceType,
        resourceName,
        previousValue,
        newValue,
        metadata,
        ipAddress,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw — audit logging should never break main flow
  }
};

// Fetch admin audit logs with filtering
exports.getAuditLogs = async (req, res) => {
  try {
    const { module, action, resourceType, actorId, startDate, endDate, page = 1, limit = 50 } = req.query;

    // Only admins can view audit logs
    if (!req.user.roles?.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view audit logs',
      });
    }

    const where = {};

    if (module) where.module = module;
    if (action) where.action = action;
    if (resourceType) where.resourceType = resourceType;
    if (actorId) where.actorId = actorId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    return res.json({
      success: true,
      logs,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching audit logs',
      error: error.message,
    });
  }
};

// Get audit logs for a specific resource
exports.getResourceAuditTrail = async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;

    if (!req.user.roles?.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view audit logs',
      });
    }

    const logs = await prisma.adminAuditLog.findMany({
      where: {
        resourceType,
        resourceId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      logs,
    });
  } catch (error) {
    console.error('Get resource audit trail error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching resource audit trail',
      error: error.message,
    });
  }
};
