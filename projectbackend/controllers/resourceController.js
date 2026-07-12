const prisma = require('../config/prisma');
const { createAuditLog } = require('./auditLogController');

const RESOURCE_TYPES = new Set([
  'document',
  'policy_link',
  'image',
  'video',
  'banner',
  'logo',
  'report',
]);

const RESOURCE_VISIBILITIES = new Set(['society_only']);

function isSocietyUser(user) {
  return Array.isArray(user?.roles) && user.roles.includes('society');
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeNullableNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.trunc(numeric);
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value
      .map((tag) => normalizeString(tag))
      .filter((tag) => Boolean(tag));
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => Boolean(tag));
  }

  return [];
}

function isValidUrl(url) {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch (_error) {
    return false;
  }
}

function isResourceUploadUrl(fileUrl) {
  return String(fileUrl || '').includes('/uploads/resources/');
}

function parseSort(sort) {
  const allowed = {
    createdAt_desc: { createdAt: 'desc' },
    createdAt_asc: { createdAt: 'asc' },
    updatedAt_desc: { updatedAt: 'desc' },
    updatedAt_asc: { updatedAt: 'asc' },
    title_asc: { title: 'asc' },
    title_desc: { title: 'desc' },
  };

  return allowed[sort] || allowed.createdAt_desc;
}

function resourceInclude() {
  return {
    createdBy: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
  };
}

function ensureSociety(req, res) {
  if (!isSocietyUser(req.user)) {
    res.status(403).json({
      success: false,
      message: 'Only society members can access resources',
    });
    return false;
  }

  return true;
}

function validateResourceState({ type, linkUrl, fileUrl, fileName, mimeType }) {
  if (!RESOURCE_TYPES.has(type)) {
    return 'Invalid resource type';
  }

  if (type === 'policy_link') {
    if (!linkUrl || !isValidUrl(linkUrl)) {
      return 'policy_link resources require a valid linkUrl';
    }

    return null;
  }

  if (!fileUrl || !fileName || !mimeType) {
    return `${type} resources require fileUrl, fileName, and mimeType`;
  }

  if (!isResourceUploadUrl(fileUrl)) {
    return 'Resource fileUrl must point to uploaded resources storage';
  }

  return null;
}

exports.createResource = async (req, res) => {
  try {
    if (!ensureSociety(req, res)) return;

    const title = normalizeString(req.body.title);
    const description = normalizeNullableString(req.body.description);
    const type = normalizeString(req.body.type).toLowerCase();
    const visibility = normalizeString(req.body.visibility).toLowerCase() || 'society_only';

    const linkUrl = normalizeNullableString(req.body.linkUrl);
    const fileUrl = normalizeNullableString(req.body.fileUrl);
    const fileName = normalizeNullableString(req.body.fileName);
    const mimeType = normalizeNullableString(req.body.mimeType)?.toLowerCase() || null;
    const fileSize = normalizeNullableNumber(req.body.fileSize);
    const tags = normalizeTags(req.body.tags);

    if (!title) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }

    if (!RESOURCE_VISIBILITIES.has(visibility)) {
      return res.status(400).json({ success: false, message: 'Invalid visibility value' });
    }

    const validationError = validateResourceState({ type, linkUrl, fileUrl, fileName, mimeType });
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const resource = await prisma.resourceItem.create({
      data: {
        title,
        description,
        type,
        visibility,
        linkUrl: type === 'policy_link' ? linkUrl : null,
        fileUrl: type === 'policy_link' ? null : fileUrl,
        fileName: type === 'policy_link' ? null : fileName,
        mimeType: type === 'policy_link' ? null : mimeType,
        fileSize: type === 'policy_link' ? null : fileSize,
        tags,
        createdById: req.user.id,
      },
      include: resourceInclude(),
    });

    await createAuditLog({
      action: 'resource_created',
      module: 'resources',
      description: `Resource created: ${resource.title}`,
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorName: req.user.name,
      actorRole: 'society',
      resourceId: resource.id,
      resourceType: 'ResourceItem',
      resourceName: resource.title,
      newValue: {
        type: resource.type,
        visibility: resource.visibility,
      },
      metadata: {
        hasLink: Boolean(resource.linkUrl),
        hasFile: Boolean(resource.fileUrl),
      },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: 'Resource created successfully',
      resource,
    });
  } catch (error) {
    console.error('Create resource error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating resource',
      error: error.message,
    });
  }
};

exports.getResources = async (req, res) => {
  try {
    if (!ensureSociety(req, res)) return;

    const type = normalizeString(req.query.type).toLowerCase();
    const search = normalizeString(req.query.search);
    const sort = normalizeString(req.query.sort);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);

    const where = {
      isActive: true,
    };

    if (type) {
      if (!RESOURCE_TYPES.has(type)) {
        return res.status(400).json({ success: false, message: 'Invalid type filter' });
      }
      where.type = type;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { fileName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [resources, total] = await Promise.all([
      prisma.resourceItem.findMany({
        where,
        orderBy: parseSort(sort),
        skip,
        take: limit,
        include: resourceInclude(),
      }),
      prisma.resourceItem.count({ where }),
    ]);

    return res.json({
      success: true,
      resources,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get resources error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching resources',
      error: error.message,
    });
  }
};

exports.getResourceById = async (req, res) => {
  try {
    if (!ensureSociety(req, res)) return;

    const resource = await prisma.resourceItem.findFirst({
      where: {
        id: req.params.id,
        isActive: true,
      },
      include: resourceInclude(),
    });

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found',
      });
    }

    return res.json({ success: true, resource });
  } catch (error) {
    console.error('Get resource by id error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching resource',
      error: error.message,
    });
  }
};

exports.updateResource = async (req, res) => {
  try {
    if (!ensureSociety(req, res)) return;

    const existing = await prisma.resourceItem.findFirst({
      where: { id: req.params.id, isActive: true },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }

    const nextType = normalizeString(req.body.type).toLowerCase() || existing.type;
    const nextVisibility = normalizeString(req.body.visibility).toLowerCase() || existing.visibility;

    if (!RESOURCE_TYPES.has(nextType)) {
      return res.status(400).json({ success: false, message: 'Invalid resource type' });
    }

    if (!RESOURCE_VISIBILITIES.has(nextVisibility)) {
      return res.status(400).json({ success: false, message: 'Invalid visibility value' });
    }

    const providedTitle = Object.prototype.hasOwnProperty.call(req.body, 'title');
    const providedDescription = Object.prototype.hasOwnProperty.call(req.body, 'description');
    const providedLinkUrl = Object.prototype.hasOwnProperty.call(req.body, 'linkUrl');
    const providedFileUrl = Object.prototype.hasOwnProperty.call(req.body, 'fileUrl');
    const providedFileName = Object.prototype.hasOwnProperty.call(req.body, 'fileName');
    const providedMimeType = Object.prototype.hasOwnProperty.call(req.body, 'mimeType');
    const providedFileSize = Object.prototype.hasOwnProperty.call(req.body, 'fileSize');
    const providedTags = Object.prototype.hasOwnProperty.call(req.body, 'tags');

    const nextTitle = providedTitle ? normalizeString(req.body.title) : existing.title;
    const nextDescription = providedDescription
      ? normalizeNullableString(req.body.description)
      : existing.description;

    const nextLinkUrl = providedLinkUrl
      ? normalizeNullableString(req.body.linkUrl)
      : existing.linkUrl;
    const nextFileUrl = providedFileUrl
      ? normalizeNullableString(req.body.fileUrl)
      : existing.fileUrl;
    const nextFileName = providedFileName
      ? normalizeNullableString(req.body.fileName)
      : existing.fileName;
    const nextMimeType = providedMimeType
      ? normalizeNullableString(req.body.mimeType)?.toLowerCase() || null
      : existing.mimeType;
    const nextFileSize = providedFileSize
      ? normalizeNullableNumber(req.body.fileSize)
      : existing.fileSize;
    const nextTags = providedTags ? normalizeTags(req.body.tags) : existing.tags;

    if (!nextTitle) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }

    const validationError = validateResourceState({
      type: nextType,
      linkUrl: nextLinkUrl,
      fileUrl: nextFileUrl,
      fileName: nextFileName,
      mimeType: nextMimeType,
    });

    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const data = {
      title: nextTitle,
      description: nextDescription,
      type: nextType,
      visibility: nextVisibility,
      tags: nextTags,
      linkUrl: nextType === 'policy_link' ? nextLinkUrl : null,
      fileUrl: nextType === 'policy_link' ? null : nextFileUrl,
      fileName: nextType === 'policy_link' ? null : nextFileName,
      mimeType: nextType === 'policy_link' ? null : nextMimeType,
      fileSize: nextType === 'policy_link' ? null : nextFileSize,
    };

    const resource = await prisma.resourceItem.update({
      where: { id: existing.id },
      data,
      include: resourceInclude(),
    });

    await createAuditLog({
      action: 'resource_updated',
      module: 'resources',
      description: `Resource updated: ${resource.title}`,
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorName: req.user.name,
      actorRole: 'society',
      resourceId: resource.id,
      resourceType: 'ResourceItem',
      resourceName: resource.title,
      previousValue: {
        type: existing.type,
        visibility: existing.visibility,
        title: existing.title,
      },
      newValue: {
        type: resource.type,
        visibility: resource.visibility,
        title: resource.title,
      },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: 'Resource updated successfully',
      resource,
    });
  } catch (error) {
    console.error('Update resource error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating resource',
      error: error.message,
    });
  }
};

exports.deleteResource = async (req, res) => {
  try {
    if (!ensureSociety(req, res)) return;

    const existing = await prisma.resourceItem.findFirst({
      where: {
        id: req.params.id,
        isActive: true,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found',
      });
    }

    await prisma.resourceItem.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    await createAuditLog({
      action: 'resource_deleted',
      module: 'resources',
      description: `Resource deleted: ${existing.title}`,
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorName: req.user.name,
      actorRole: 'society',
      resourceId: existing.id,
      resourceType: 'ResourceItem',
      resourceName: existing.title,
      previousValue: {
        isActive: true,
      },
      newValue: {
        isActive: false,
      },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: 'Resource deleted successfully',
    });
  } catch (error) {
    console.error('Delete resource error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting resource',
      error: error.message,
    });
  }
};
