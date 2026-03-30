const prisma = require('../config/prisma');

// Roles that can only have ONE holder per committee (singleton roles)
const SINGLETON_ROLES = [
  'VICE_PRESIDENT',
  'GENERAL_SECRETARY',
  'EVENT_CULTURAL_SECRETARY',
  'SPORTS_SECRETARY',
  'PUBLICATION_SECRETARY',
  'ASSISTANT_EVENT_CULTURAL_SECRETARY',
];

// Human-readable labels
const ROLE_LABELS = {
  VICE_PRESIDENT: 'Vice President',
  GENERAL_SECRETARY: 'General Secretary',
  EVENT_CULTURAL_SECRETARY: 'Event & Cultural Secretary',
  SPORTS_SECRETARY: 'Sports Secretary',
  PUBLICATION_SECRETARY: 'Publication Secretary',
  ASSISTANT_EVENT_CULTURAL_SECRETARY: 'Asst. Event & Cultural Secretary',
  EXECUTIVE_MEMBER: 'Executive Member',
};

// ─── CREATE COMMITTEE ──────────────────────────────────────────────
exports.createCommittee = async (req, res) => {
  try {
    const { name, termStart, termEnd } = req.body;

    if (!name || !termStart || !termEnd) {
      return res.status(400).json({
        success: false,
        message: 'Name, termStart, and termEnd are required',
      });
    }

    const start = new Date(termStart);
    const end = new Date(termEnd);
    if (end <= start) {
      return res.status(400).json({
        success: false,
        message: 'termEnd must be after termStart',
      });
    }

    // Deactivate any currently-active committees
    await prisma.committee.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    const committee = await prisma.committee.create({
      data: {
        name,
        termStart: start,
        termEnd: end,
        isActive: true,
      },
      include: { members: { include: { user: true } } },
    });

    res.status(201).json({
      success: true,
      message: 'Committee created successfully',
      committee,
    });
  } catch (error) {
    console.error('Create committee error:', error);
    res.status(500).json({ success: false, message: 'Server error creating committee' });
  }
};

// ─── GET ALL COMMITTEES ─────────────────────────────────────────────
exports.getCommittees = async (req, res) => {
  try {
    const committees = await prisma.committee.findMany({
      orderBy: { termStart: 'desc' },
      include: {
        _count: { select: { members: true } },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, studentId: true, roles: true },
            },
          },
          orderBy: { assignedAt: 'asc' },
        },
      },
    });

    res.json({ success: true, committees });
  } catch (error) {
    console.error('Get committees error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching committees' });
  }
};

// ─── GET ACTIVE COMMITTEE ───────────────────────────────────────────
exports.getActiveCommittee = async (req, res) => {
  try {
    const committee = await prisma.committee.findFirst({
      where: { isActive: true },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, studentId: true, roles: true },
            },
          },
          orderBy: { assignedAt: 'asc' },
        },
      },
    });

    res.json({ success: true, committee }); // committee may be null
  } catch (error) {
    console.error('Get active committee error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── GET COMMITTEE BY ID ────────────────────────────────────────────
exports.getCommitteeById = async (req, res) => {
  try {
    const committee = await prisma.committee.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, studentId: true, roles: true },
            },
          },
          orderBy: { assignedAt: 'asc' },
        },
      },
    });

    if (!committee) {
      return res.status(404).json({ success: false, message: 'Committee not found' });
    }

    res.json({ success: true, committee });
  } catch (error) {
    console.error('Get committee by id error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── UPDATE COMMITTEE ───────────────────────────────────────────────
exports.updateCommittee = async (req, res) => {
  try {
    const { name, termStart, termEnd } = req.body;
    const data = {};
    if (name) data.name = name;
    if (termStart) data.termStart = new Date(termStart);
    if (termEnd) data.termEnd = new Date(termEnd);

    const committee = await prisma.committee.update({
      where: { id: req.params.id },
      data,
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, studentId: true, roles: true },
            },
          },
        },
      },
    });

    res.json({ success: true, message: 'Committee updated', committee });
  } catch (error) {
    console.error('Update committee error:', error);
    res.status(500).json({ success: false, message: 'Server error updating committee' });
  }
};

// ─── ADD MEMBER ─────────────────────────────────────────────────────
exports.addMember = async (req, res) => {
  try {
    const { userId, role } = req.body;
    const committeeId = req.params.id;

    if (!userId || !role) {
      return res.status(400).json({ success: false, message: 'userId and role are required' });
    }

    // Validate committee exists and is active
    const committee = await prisma.committee.findUnique({ where: { id: committeeId } });
    if (!committee) {
      return res.status(404).json({ success: false, message: 'Committee not found' });
    }
    if (!committee.isActive) {
      return res.status(400).json({ success: false, message: 'Cannot modify an inactive committee' });
    }

    // Validate user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // For singleton roles, check that no one else holds this role
    if (SINGLETON_ROLES.includes(role)) {
      const existing = await prisma.committeeMember.findFirst({
        where: { committeeId, role },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `The role ${ROLE_LABELS[role] || role} is already assigned in this committee`,
        });
      }
    }

    // Check duplicate: same user + same role in same committee
    const duplicate = await prisma.committeeMember.findFirst({
      where: { committeeId, userId, role },
    });
    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: 'This user already holds this role in the committee',
      });
    }

    const member = await prisma.committeeMember.create({
      data: { committeeId, userId, role },
      include: {
        user: {
          select: { id: true, name: true, email: true, studentId: true, roles: true },
        },
      },
    });

    res.status(201).json({ success: true, message: 'Member added to committee', member });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ success: false, message: 'Server error adding member' });
  }
};

// ─── REMOVE MEMBER ──────────────────────────────────────────────────
exports.removeMember = async (req, res) => {
  try {
    const { id: committeeId, memberId } = req.params;

    // Verify committee is active
    const committee = await prisma.committee.findUnique({ where: { id: committeeId } });
    if (!committee) {
      return res.status(404).json({ success: false, message: 'Committee not found' });
    }
    if (!committee.isActive) {
      return res.status(400).json({ success: false, message: 'Cannot modify an inactive committee' });
    }

    const member = await prisma.committeeMember.findUnique({ where: { id: memberId } });
    if (!member || member.committeeId !== committeeId) {
      return res.status(404).json({ success: false, message: 'Member not found in this committee' });
    }

    await prisma.committeeMember.delete({ where: { id: memberId } });

    res.json({ success: true, message: 'Member removed from committee' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ success: false, message: 'Server error removing member' });
  }
};

// ─── UPDATE MEMBER ROLE ─────────────────────────────────────────────
exports.updateMemberRole = async (req, res) => {
  try {
    const { id: committeeId, memberId } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ success: false, message: 'role is required' });
    }

    const committee = await prisma.committee.findUnique({ where: { id: committeeId } });
    if (!committee || !committee.isActive) {
      return res.status(400).json({ success: false, message: 'Committee not found or inactive' });
    }

    const member = await prisma.committeeMember.findUnique({ where: { id: memberId } });
    if (!member || member.committeeId !== committeeId) {
      return res.status(404).json({ success: false, message: 'Member not found in this committee' });
    }

    // If the new role is a singleton, check no one else holds it
    if (SINGLETON_ROLES.includes(role)) {
      const existing = await prisma.committeeMember.findFirst({
        where: { committeeId, role, id: { not: memberId } },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `The role ${ROLE_LABELS[role] || role} is already assigned`,
        });
      }
    }

    const updated = await prisma.committeeMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: {
          select: { id: true, name: true, email: true, studentId: true, roles: true },
        },
      },
    });

    res.json({ success: true, message: 'Member role updated', member: updated });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ success: false, message: 'Server error updating role' });
  }
};

// ─── DEACTIVATE COMMITTEE ───────────────────────────────────────────
exports.deactivateCommittee = async (req, res) => {
  try {
    const committee = await prisma.committee.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ success: true, message: 'Committee deactivated', committee });
  } catch (error) {
    console.error('Deactivate committee error:', error);
    res.status(500).json({ success: false, message: 'Server error deactivating committee' });
  }
};
