// ============================================================
//  AUTH ROUTES — /api/auth
//  POST /register  POST /login  POST /refresh
//  GET  /me        POST /change-password
// ============================================================
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const Joi     = require('joi');
const { User } = require('../models');
const { authenticate } = require('../middleware/auth');

// ── Validation ───────────────────────────────────────────────
const registerSchema = Joi.object({
  name:        Joi.string().min(2).max(100).required().messages({ 'string.min':'Jina lazima liwe herufi 2+', 'any.required':'Jaza jina lako' }),
  email:       Joi.string().email().required().messages({ 'string.email':'Weka email sahihi', 'any.required':'Jaza email yako' }),
  password:    Joi.string().min(8).required().messages({ 'string.min':'Password lazima iwe herufi 8+', 'any.required':'Jaza password' }),
  role:        Joi.string().valid('student','teacher').default('student'),
  studentId:   Joi.string().optional().allow(''),
  department:  Joi.string().optional().allow(''),
  yearOfStudy: Joi.number().integer().min(1).max(7).optional(),
});

const loginSchema = Joi.object({
  email:    Joi.string().email().required(),
  password: Joi.string().required(),
});

// ── Helpers ───────────────────────────────────────────────────
const generateTokens = (user) => {
  const payload = { id: user.id, role: user.role };
  const accessToken  = jwt.sign(payload, process.env.JWT_SECRET,         { expiresIn: process.env.JWT_EXPIRES_IN         || '1d'  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET,  { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' });
  return { accessToken, refreshToken };
};

const safeUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role,
  studentId: u.studentId, department: u.department,
  yearOfStudy: u.yearOfStudy, avatarUrl: u.avatarUrl,
  bio: u.bio, isActive: u.isActive, isVerified: u.isVerified,
  followersCount: u.followersCount, followingCount: u.followingCount,
  postsCount: u.postsCount, createdAt: u.createdAt,
});

// ── POST /api/auth/register ───────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });

    const { name, email, password, role, studentId, department, yearOfStudy } = value;

    const exists = await User.unscoped().findOne({ where: { email: email.toLowerCase() } });
    if (exists) return res.status(409).json({ error: 'Email hii imetumika tayari. Ingia badala yake.' });

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(), email: email.toLowerCase(),
      password: hashedPassword, role,
      studentId: studentId || null,
      department: department || null,
      yearOfStudy: yearOfStudy || null,
    });

    const tokens = generateTokens(user);
    await user.update({ lastSeen: new Date() });

    res.status(201).json({
      message: `Karibu UDSM Social Hub, ${user.name}! 🎉`,
      user: safeUser(user),
      ...tokens,
    });
  } catch (err) { next(err); }
});

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { email, password } = value;

    const user = await User.unscoped().findOne({ where: { email: email.toLowerCase() } });
    if (!user) return res.status(401).json({ error: 'Email au password si sahihi' });
    if (!user.isActive) return res.status(403).json({ error: 'Akaunti yako imefungwa. Wasiliana na admin.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Email au password si sahihi' });

    await user.update({ lastSeen: new Date() });
    const tokens = generateTokens(user);

    res.json({
      message: `Karibu tena, ${user.name}!`,
      user: safeUser(user),
      ...tokens,
    });
  } catch (err) { next(err); }
});

// ── POST /api/auth/refresh ────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token inahitajika' });

    let decoded;
    try { decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET); }
    catch { return res.status(401).json({ error: 'Token imekwisha au si valid. Login tena.', code: 'TOKEN_EXPIRED' }); }

    const user = await User.findByPk(decoded.id);
    if (!user || !user.isActive) return res.status(401).json({ error: 'Akaunti haipo au imefungwa' });

    const tokens = generateTokens(user);
    res.json({ ...tokens, user: safeUser(user) });
  } catch (err) { next(err); }
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'Mtumiaji haipatikani' });
    res.json({ user: safeUser(user) });
  } catch (err) { next(err); }
});

// ── POST /api/auth/change-password ───────────────────────────
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Jaza sehemu zote' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password mpya lazima iwe herufi 8+' });
    if (oldPassword === newPassword) return res.status(400).json({ error: 'Password mpya lazima itofautiane na ya zamani' });

    const user = await User.unscoped().findByPk(req.user.id);
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Password ya zamani si sahihi' });

    await user.update({ password: await bcrypt.hash(newPassword, 12) });
    res.json({ message: 'Password imebadilishwa! 🔐' });
  } catch (err) { next(err); }
});

module.exports = router;
