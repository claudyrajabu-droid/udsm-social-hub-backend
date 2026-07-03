// ============================================================
//  AUTH MIDDLEWARE — JWT Verification + Role Guards
// ============================================================
const jwt    = require('jsonwebtoken');
const { User } = require('../models');

// ── Verify JWT ────────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
      return res.status(401).json({ error: 'Login kwanza ili kuendelea', code: 'NO_TOKEN' });

    const token = header.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError')
        return res.status(401).json({ error: 'Session imekwisha. Login tena.', code: 'TOKEN_EXPIRED' });
      return res.status(401).json({ error: 'Token si valid', code: 'INVALID_TOKEN' });
    }

    const user = await User.findByPk(decoded.id, { attributes: ['id','role','isActive'] });
    if (!user)          return res.status(401).json({ error: 'Akaunti haipatikani' });
    if (!user.isActive) return res.status(403).json({ error: 'Akaunti yako imefungwa. Wasiliana na admin.' });

    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (err) {
    next(err);
  }
};

// ── Admin only ────────────────────────────────────────────────
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Sehemu hii ni kwa admin tu' });
  next();
};

// ── Teacher or Admin ──────────────────────────────────────────
const requireTeacherOrAdmin = (req, res, next) => {
  if (!['teacher','admin'].includes(req.user?.role))
    return res.status(403).json({ error: 'Sehemu hii ni kwa walimu na admin tu' });
  next();
};

// ── Optional Auth (public routes that benefit from knowing user) ──
const optionalAuth = (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
      req.user = { id: decoded.id, role: decoded.role };
    }
  } catch { /* ignore */ }
  next();
};

module.exports = { authenticate, requireAdmin, requireTeacherOrAdmin, optionalAuth };
