// ============================================================
//  GROUPS ROUTES — /api/groups
// ============================================================
const router = require('express').Router();
const { Group, GroupMember, User, Post } = require('../models');
const { authenticate } = require('../middleware/auth');

// GET /api/groups — Vikundi vyote / vya mtumiaji
router.get('/', authenticate, async (req, res) => {
  try {
    const { mine } = req.query;
    let groups;

    if (mine === 'true') {
      // Vikundi alivyojiunga
      groups = await Group.findAll({
        include: [{
          model: GroupMember, as: 'members',
          where: { userId: req.user.id }, required: true,
        }, { model: User, as: 'creator', attributes: ['id','name','avatarUrl'] }],
      });
    } else {
      groups = await Group.findAll({
        where: { isPrivate: false },
        include: [{ model: User, as: 'creator', attributes: ['id','name','avatarUrl'] }],
        order: [['memberCount','DESC']],
        limit: 50,
      });
    }

    // Onyesha kama user amejiunga
    const memberOf = await GroupMember.findAll({
      where: { userId: req.user.id },
      attributes: ['groupId'],
    });
    const memberIds = new Set(memberOf.map(m => m.groupId));

    res.json({ groups: groups.map(g => ({ ...g.toJSON(), isMember: memberIds.has(g.id) })) });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/groups — Unda kikundi
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, description, isPrivate, department, category } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Jaza jina la kikundi' });

    const group = await Group.create({
      name: name.trim(), description, isPrivate: !!isPrivate,
      department, category, creatorId: req.user.id,
    });

    // Creator anajiunga automatically kama admin
    await GroupMember.create({ groupId: group.id, userId: req.user.id, role: 'admin' });

    res.status(201).json({ group });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/groups/:id/join — Jiunga na kikundi
router.post('/:id/join', authenticate, async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).json({ error: 'Kikundi haipatikani' });

    const existing = await GroupMember.findOne({
      where: { groupId: group.id, userId: req.user.id }
    });
    if (existing) return res.status(409).json({ error: 'Umekwisha jiunga' });

    await GroupMember.create({ groupId: group.id, userId: req.user.id });
    await Group.increment('memberCount', { where: { id: group.id } });

    res.json({ message: `Umejiunga na "${group.name}" ✅` });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/groups/:id/leave — Toka kikundi
router.delete('/:id/leave', authenticate, async (req, res) => {
  try {
    const member = await GroupMember.findOne({
      where: { groupId: req.params.id, userId: req.user.id }
    });
    if (!member) return res.status(404).json({ error: 'Hukuwa mwanachama' });
    if (member.role === 'admin') return res.status(400).json({ error: 'Admin hawezi kutoka. Hamisha admin kwanza.' });

    await member.destroy();
    await Group.decrement('memberCount', { where: { id: req.params.id } });
    res.json({ message: 'Umetoka kikundi' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
