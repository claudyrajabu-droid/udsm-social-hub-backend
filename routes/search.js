// ============================================================
//  SEARCH ROUTES — /api/search?q=
// ============================================================
const router = require('express').Router();
const { Op } = require('sequelize');
const { User, Post, Poll, Group } = require('../models');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const { q, type = 'all' } = req.query;
    if (!q || q.trim().length < 2)
      return res.status(400).json({ error: 'Andika herufi 2+ kutafuta' });

    const query = q.trim();
    const results = {};

    if (type === 'all' || type === 'users') {
      results.users = await User.findAll({
        where: {
          [Op.or]: [
            { name:       { [Op.iLike]: `%${query}%` } },
            { department: { [Op.iLike]: `%${query}%` } },
          ],
          isActive: true,
        },
        attributes: ['id','name','avatarUrl','department','role'],
        limit: type === 'all' ? 5 : 20,
      });
    }

    if (type === 'all' || type === 'posts') {
      results.posts = await Post.findAll({
        where: {
          [Op.or]: [
            { content: { [Op.iLike]: `%${query}%` } },
          ],
        },
        include: [{ model: User, as: 'author', attributes: ['id','name','avatarUrl'] }],
        order: [['createdAt','DESC']],
        limit: type === 'all' ? 5 : 20,
      });
    }

    if (type === 'all' || type === 'polls') {
      results.polls = await Poll.findAll({
        where: { question: { [Op.iLike]: `%${query}%` } },
        include: [{ model: User, as: 'creator', attributes: ['id','name'] }],
        limit: type === 'all' ? 3 : 10,
      });
    }

    if (type === 'all' || type === 'groups') {
      results.groups = await Group.findAll({
        where: {
          [Op.or]: [
            { name:        { [Op.iLike]: `%${query}%` } },
            { description: { [Op.iLike]: `%${query}%` } },
          ],
        },
        attributes: ['id','name','avatarUrl','memberCount','isPrivate'],
        limit: type === 'all' ? 5 : 10,
      });
    }

    res.json({ query, results });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
