// ============================================================
//  ADMIN ROUTES — /api/admin  (Admin tu)
// ============================================================
const router = require('express').Router();
const { Op, sequelize: db } = require('../models');
const { User, Post, Poll, Message, Report, Announcement, Group } = require('../models');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Middleware — kila route hapa inahitaji admin
router.use(authenticate, requireAdmin);

// ── GET /api/admin/stats — Dashboard numbers ──────────────
router.get('/stats', async (req, res) => {
  try {
    const now   = new Date();
    const today = new Date(now.setHours(0,0,0,0));
    const week  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000);
    const month = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers, newUsersToday, newUsersWeek,
      totalPosts, postsToday,
      totalPolls, activePolls,
      pendingReports,
      totalGroups,
      studentCount, teacherCount, adminCount,
    ] = await Promise.all([
      User.count(),
      User.count({ where: { createdAt: { [Op.gte]: today } } }),
      User.count({ where: { createdAt: { [Op.gte]: week  } } }),
      Post.count(),
      Post.count({ where: { createdAt: { [Op.gte]: today } } }),
      Poll.count(),
      Poll.count({ where: { isActive: true, [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gt]: new Date() } }] } }),
      Report.count({ where: { status: 'pending' } }),
      Group.count(),
      User.count({ where: { role: 'student' } }),
      User.count({ where: { role: 'teacher' } }),
      User.count({ where: { role: 'admin'   } }),
    ]);

    // Users waliojiunga kila siku — wiki iliyopita
    const dailySignups = await User.findAll({
      where: { createdAt: { [Op.gte]: week } },
      attributes: [
        [db.fn('DATE', db.col('created_at')), 'date'],
        [db.fn('COUNT', db.col('id')), 'count'],
      ],
      group: [db.fn('DATE', db.col('created_at'))],
      order: [[db.fn('DATE', db.col('created_at')), 'ASC']],
      raw: true,
    });

    // Posts kila siku
    const dailyPosts = await Post.findAll({
      where: { createdAt: { [Op.gte]: week } },
      attributes: [
        [db.fn('DATE', db.col('created_at')), 'date'],
        [db.fn('COUNT', db.col('id')), 'count'],
      ],
      group: [db.fn('DATE', db.col('created_at'))],
      order: [[db.fn('DATE', db.col('created_at')), 'ASC']],
      raw: true,
    });

    res.json({
      overview: {
        totalUsers, newUsersToday, newUsersWeek,
        totalPosts, postsToday,
        totalPolls, activePolls,
        pendingReports, totalGroups,
      },
      roles: { students: studentCount, teachers: teacherCount, admins: adminCount },
      charts: { dailySignups, dailyPosts },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/admin/users — Orodha ya users yote ──────────
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search, isActive } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (role)   where.role     = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) where[Op.or]   = [
      { name:  { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { studentId: { [Op.iLike]: `%${search}%` } },
    ];

    const { rows: users, count } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password','fcmToken'] },
      order: [['createdAt','DESC']],
      limit: parseInt(limit),
      offset,
    });

    res.json({ users, total: count, page: parseInt(page), pages: Math.ceil(count / parseInt(limit)) });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/admin/users/:id — Edit mtumiaji ─────────────
router.put('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User haipatikani' });

    const { name, role, department, isActive, isVerified } = req.body;

    // Admin hawezi kujiondoa role yake
    if (user.id === req.user.id && role && role !== 'admin')
      return res.status(400).json({ error: 'Huwezi kujiondoa role ya admin' });

    await user.update({ name, role, department, isActive, isVerified });
    res.json({ message: 'User imesasishwa ✅', user });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/admin/users/:id — Futa mtumiaji ──────────
router.delete('/users/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.id)
      return res.status(400).json({ error: 'Huwezi kujifuta mwenyewe' });

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User haipatikani' });

    await user.destroy();
    res.json({ message: 'User amefutwa' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/admin/reports — Ripoti zilizowasilishwa ─────
router.get('/reports', async (req, res) => {
  try {
    const { status = 'pending', page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * 20;

    const reports = await Report.findAll({
      where: { status },
      include: [{ model: User, as: 'reporter', foreignKey: 'reporter_id', attributes: ['id','name','email'] }],
      order: [['createdAt','DESC']],
      limit: 20, offset,
    });
    res.json({ reports });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/admin/reports/:id — Resolve ripoti ──────────
router.put('/reports/:id', async (req, res) => {
  try {
    const report = await Report.findByPk(req.params.id);
    if (!report) return res.status(404).json({ error: 'Ripoti haipatikani' });

    await report.update({ status: req.body.status || 'resolved', resolvedBy: req.user.id });
    res.json({ message: 'Ripoti imeshughulikiwa ✅' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/admin/posts/:id — Futa post yoyote ───────
router.delete('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post haipatikani' });
    await post.destroy();
    res.json({ message: 'Post imefutwa na admin' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/admin/announcements — Tuma tangazo ─────────
router.post('/announcements', async (req, res) => {
  try {
    const { title, content, priority, expiresAt } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Jaza title na content' });

    const ann = await Announcement.create({
      title, content, priority: priority || 'normal',
      authorId: req.user.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    // Broadcast kwa Socket.io
    const io = req.app.get('io');
    if (io) io.emit('announcement:new', { title, content, priority: ann.priority });

    res.status(201).json({ message: 'Tangazo limetumwa ✅', announcement: ann });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
