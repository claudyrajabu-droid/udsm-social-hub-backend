// ============================================================
//  SOCKET.IO HANDLER — Real-time Chat, Notifications, Online Status
// ============================================================
const jwt    = require('jsonwebtoken');
const logger = require('./logger');

// userId → Set of socketIds (user inaweza kuwa na devices nyingi)
const onlineUsers = new Map();

module.exports = (io) => {

  // ── Auth Middleware kwa Socket ─────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token ||
                  socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) return next(new Error('Hakuna token'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Token si valid'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    logger.info(`🔌 User ${userId} ameunganika (${socket.id})`);

    // ── Sajili user kama online ────────────────────────────
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    // Tuma online users list kwa user mpya
    socket.emit('users:online', Array.from(onlineUsers.keys()));

    // Arifu wengine kwamba user huyu yuko online
    socket.broadcast.emit('user:online', { userId });

    // ── Join Personal Room (kwa notifications) ─────────────
    socket.join(`user:${userId}`);

    // ── Chat: Tuma Ujumbe ──────────────────────────────────
    socket.on('message:send', async (data) => {
      try {
        const { receiverId, content, tempId } = data;
        if (!receiverId || !content?.trim()) return;

        // Tuma kwa receiver kama yuko online
        io.to(`user:${receiverId}`).emit('message:receive', {
          tempId,
          senderId:   userId,
          receiverId,
          content:    content.trim(),
          createdAt:  new Date().toISOString(),
          isDelivered: true,
        });

        // Confirm kwa sender
        socket.emit('message:sent', { tempId, status: 'delivered' });

      } catch (err) {
        socket.emit('error', { message: 'Ujumbe haukutumwa' });
      }
    });

    // ── Chat: Typing indicator ─────────────────────────────
    socket.on('typing:start', ({ receiverId }) => {
      io.to(`user:${receiverId}`).emit('typing:start', { userId });
    });

    socket.on('typing:stop', ({ receiverId }) => {
      io.to(`user:${receiverId}`).emit('typing:stop', { userId });
    });

    // ── Mark messages as read ──────────────────────────────
    socket.on('messages:read', ({ senderId }) => {
      io.to(`user:${senderId}`).emit('messages:read', {
        readBy: userId, at: new Date().toISOString()
      });
    });

    // ── Notifications ──────────────────────────────────────
    socket.on('notification:send', ({ targetUserId, notification }) => {
      io.to(`user:${targetUserId}`).emit('notification:receive', notification);
    });

    // ── Live Post Updates (likes, comments) ───────────────
    socket.on('post:join', (postId) => socket.join(`post:${postId}`));
    socket.on('post:leave', (postId) => socket.leave(`post:${postId}`));

    // ── Group Chat ─────────────────────────────────────────
    socket.on('group:join', (groupId) => socket.join(`group:${groupId}`));
    socket.on('group:message', ({ groupId, content }) => {
      io.to(`group:${groupId}`).emit('group:message', {
        senderId: userId, content, groupId,
        createdAt: new Date().toISOString()
      });
    });

    // ── Ping/Pong (keepalive) ──────────────────────────────
    socket.on('ping', () => socket.emit('pong'));

    // ── Disconnect ─────────────────────────────────────────
    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          socket.broadcast.emit('user:offline', {
            userId, lastSeen: new Date().toISOString()
          });
        }
      }
      logger.info(`❌ User ${userId} amekatika`);
    });
  });

  // Export helper kwa controllers kutuma notifications
  io.sendNotification = (userId, data) => {
    io.to(`user:${userId}`).emit('notification:receive', data);
  };

  io.broadcastPostUpdate = (postId, event, data) => {
    io.to(`post:${postId}`).emit(event, data);
  };
};
