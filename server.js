// ============================================================
//  UDSM SOCIAL HUB — Production Server
//  Node.js + Express + Socket.io + PostgreSQL
// ============================================================
'use strict';
require('dotenv').config();

const express     = require('express');
const http        = require('http');
const { Server }  = require('socket.io');
const cors        = require('cors');
const helmet      = require('helmet');
const compression = require('compression');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');

const { syncDatabase } = require('./models');
const logger           = require('./utils/logger');
const socketHandler    = require('./utils/socketHandler');

const app    = express();
const server = http.createServer(app);

// ── Socket.io Setup ──────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin:  (process.env.FRONTEND_URL || '').split(','),
    methods: ['GET','POST'],
    credentials: true,
  },
  pingTimeout:  60000,
  pingInterval: 25000,
});

// Attach io to app so controllers can use it
app.set('io', io);
socketHandler(io);

// ── Security Middleware ──────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com', 'https://firebasestorage.googleapis.com'],
    }
  }
}));

app.use(cors({
  origin:      (process.env.FRONTEND_URL || '').split(','),
  credentials: true,
  methods:     ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(compression());

// ── Rate Limiting ────────────────────────────────────────────
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max:      20,
  message:  { error: 'Maombi mengi sana. Pumzika dakika 15.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

const apiLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      500,
  message:  { error: 'Maombi mengi sana.' },
});

app.use('/api/auth', authLimit);
app.use('/api',      apiLimit);

// ── Body Parsing ─────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Logging ──────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) }
  }));
}

// ── Health Check ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:    'OK',
    app:       'UDSM Social Hub API',
    version:   '1.0.0',
    timestamp: new Date().toISOString(),
    uptime:    process.uptime(),
  });
});

// ── API Routes ───────────────────────────────────────────────
const v1 = express.Router();

v1.use('/auth',         require('./routes/auth'));
v1.use('/users',        require('./routes/users'));
v1.use('/posts',        require('./routes/posts'));
v1.use('/polls',        require('./routes/polls'));
v1.use('/messages',     require('./routes/messages'));
v1.use('/groups',       require('./routes/groups'));
v1.use('/notifications',require('./routes/notifications'));
v1.use('/search',       require('./routes/search'));
v1.use('/upload',       require('./routes/upload'));
v1.use('/admin',        require('./routes/admin'));
v1.use('/ai',           require('./routes/ai'));

app.use('/api/v1', v1);
// Backward compat
app.use('/api', v1);

// ── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: `Endpoint '${req.method} ${req.path}' haipatikani`,
    availableRoutes: ['/api/v1/auth', '/api/v1/posts', '/api/v1/users', '/api/v1/polls'],
  });
});

// ── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method}`);

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: 'Data si sahihi',
      details: err.errors.map(e => e.message),
    });
  }

  // Sequelize unique constraint
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Rekodi hii ipo tayari' });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Kuna tatizo la server. Jaribu tena.'
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ── Start Server ─────────────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 5000;

const startServer = async () => {
  try {
    await syncDatabase();
    logger.info('✅ Database imeunganika na synced');

    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 UDSM Social Hub API: http://localhost:${PORT}`);
      logger.info(`🔌 Socket.io iko tayari`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (err) {
    logger.error('❌ Server imeshindwa kuanza:', err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server imesimama salama.');
    process.exit(0);
  });
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
});

startServer();

module.exports = { app, io };
