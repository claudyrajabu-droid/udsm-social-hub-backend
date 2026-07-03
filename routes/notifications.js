// ============================================================
//  NOTIFICATIONS ROUTES — /api/notifications
// ============================================================
const router = require('express').Router();
const { Notification, User, Post, Op } = require('../models');
const { authenticate } = require('../middleware/auth');

// GET /api/notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [notifs, unreadCount] = await Promise.all([
      Notification.findAll({
        where: { userId: req.user.id },
        include: [{ model: User, as: 'actor', attributes: ['id','name','avatarUrl'] }],
        order: [['createdAt','DESC']],
        limit: parseInt(limit), offset,
      }),
      Notification.count({ where: { userId: req.user.id, isRead: false } }),
    ]);

    res.json({ notifications: notifs, unreadCount });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', authenticate, async (req, res) => {
  try {
    await Notification.update(
      { isRead: true },
      { where: { userId: req.user.id, isRead: false } }
    );
    res.json({ message: 'Zote zimesomwa ✅' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    await Notification.update(
      { isRead: true },
      { where: { id: req.params.id, userId: req.user.id } }
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
