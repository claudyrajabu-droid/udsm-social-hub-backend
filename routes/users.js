// ============================================================
//  USERS ROUTES — /api/users
// ============================================================
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { Op }  = require('sequelize');
const { User, Post, Follow, Notification } = require('../models');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

// ── GET /api/users/search?q= ──────────────────────────────
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ users: [] });

    const users = await User.findAll({
      where: {
        [Op.or]: [
          { name:       { [Op.iLike]: `%${q}%` } },
          { department: { [Op.iLike]: `%${q}%` } },
          { studentId:  { [Op.iLike]: `%${q}%` } },
        ],
        isActive: true,
      },
      attributes: ['id','name','avatarUrl','department','role','yearOfStudy'],
      limit: 20,
    });

    res.json({ users });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/users/:id — Profile ya mtu ──────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password','fcmToken'] },
    });
    if (!user) return res.status(404).json({ error: 'Mtumiaji haipatikani' });

    const [isFollowing, postsCount] = await Promise.all([
      Follow.findOne({ where: { followerId: req.user.id, followingId: user.id } }),
      Post.count({ where: { userId: user.id } }),
    ]);

    res.json({
      user: { ...user.toJSON(), postsCount },
      isFollowing: !!isFollowing,
      isOwner: user.id === req.user.id,
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/users/:id — Sasisha profile ─────────────────
router.put('/:id', authenticate, async (req, res) => {
  try {
    if (req.params.id !== req.user.id)
      return res.status(403).json({ error: 'Unaweza kuhariri profile yako tu' });

    const user = await User.findByPk(req.user.id);
    const { name, bio, department, yearOfStudy, phone, coverUrl } = req.body;

    await user.update({ name, bio, department, yearOfStudy, phone, coverUrl });
    res.json({ message: 'Profile imesasishwa ✅', user });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/users/:id/avatar — Pakia picha ya profile ──
router.post('/:id/avatar', authenticate, upload.single('avatar'), async (req, res) => {
  try {
    if (req.params.id !== req.user.id)
      return res.status(403).json({ error: 'Hauna ruhusa' });
    if (!req.file) return res.status(400).json({ error: 'Pakia picha' });

    const user = await User.findByPk(req.user.id);
    await user.update({ avatarUrl: req.file.path }); // Cloudinary URL

    res.json({ message: 'Picha imepakiwa ✅', avatarUrl: req.file.path });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/users/:id/follow — Follow/Unfollow ─────────
router.post('/:id/follow', authenticate, async (req, res) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user.id)
      return res.status(400).json({ error: 'Huwezi kujifuata mwenyewe' });

    const target = await User.findByPk(targetId);
    if (!target) return res.status(404).json({ error: 'Mtumiaji haipatikani' });

    const existing = await Follow.findOne({
      where: { followerId: req.user.id, followingId: targetId }
    });

    if (existing) {
      await existing.destroy();
      await User.decrement('followersCount', { where: { id: targetId } });
      await User.decrement('followingCount', { where: { id: req.user.id } });
      return res.json({ following: false });
    }

    await Follow.create({ followerId: req.user.id, followingId: targetId });
    await User.increment('followersCount', { where: { id: targetId } });
    await User.increment('followingCount', { where: { id: req.user.id } });

    // Notification
    const follower = await User.findByPk(req.user.id, { attributes: ['name'] });
    await Notification.create({
      userId:  targetId,
      actorId: req.user.id,
      type:    'follow',
      title:   'Mfuataji Mpya',
      body:    `${follower.name} amekufuata`,
      refId:   req.user.id,
      refType: 'user',
    });

    // Socket notification
    const io = req.app.get('io');
    if (io) io.sendNotification?.(targetId, {
      type: 'follow', message: `${follower.name} amekufuata`
    });

    res.json({ following: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/users/:id/followers ──────────────────────────
router.get('/:id/followers', authenticate, async (req, res) => {
  try {
    const follows = await Follow.findAll({
      where: { followingId: req.params.id },
      include: [{ model: User, as: 'follower', foreignKey: 'follower_id',
        attributes: ['id','name','avatarUrl','department'] }],
      limit: 50,
    });
    res.json({ followers: follows.map(f => f.follower) });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
