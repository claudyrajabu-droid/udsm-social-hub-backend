// ============================================================
//  MESSAGES ROUTES — /api/messages
//  GET /conversations  GET /:userId  POST /  DELETE /:id
// ============================================================
const router = require('express').Router();
const { Op } = require('sequelize');
const { Message, User } = require('../models');
const { authenticate } = require('../middleware/auth');

// ── GET /api/messages/conversations ──────────────────────────
router.get('/conversations', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const sent     = await Message.findAll({ where: { senderId:   userId }, attributes: ['receiverId'], group: ['receiver_id'] });
    const received = await Message.findAll({ where: { receiverId: userId }, attributes: ['senderId'],   group: ['sender_id']   });

    const peerIds = [...new Set([
      ...sent.map(m => m.receiverId),
      ...received.map(m => m.senderId),
    ])].filter(id => id !== userId);

    const conversations = await Promise.all(peerIds.map(async (peerId) => {
      const [peer, lastMsg, unread] = await Promise.all([
        User.findByPk(peerId, { attributes: ['id','name','avatarUrl','department','lastSeen','role'] }),
        Message.findOne({
          where: { [Op.or]: [{ senderId: userId, receiverId: peerId }, { senderId: peerId, receiverId: userId }] },
          order: [['createdAt','DESC']],
        }),
        Message.count({ where: { senderId: peerId, receiverId: userId, readAt: null } }),
      ]);
      return { user: peer, lastMessage: lastMsg, unreadCount: unread };
    }));

    conversations.sort((a,b) => new Date(b.lastMessage?.createdAt||0) - new Date(a.lastMessage?.createdAt||0));
    res.json({ conversations });
  } catch (err) { next(err); }
});

// ── GET /api/messages/:userId — History ──────────────────────
router.get('/:userId', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset   = (parseInt(page)-1)*parseInt(limit);
    const otherId  = req.params.userId;
    const me       = req.user.id;

    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: me,      receiverId: otherId },
          { senderId: otherId, receiverId: me      },
        ],
        deletedAt: null,
      },
      include: [
        { model: User, as: 'sender',   attributes: ['id','name','avatarUrl'] },
        { model: User, as: 'receiver', attributes: ['id','name','avatarUrl'] },
      ],
      order:  [['createdAt','ASC']],
      limit:  parseInt(limit),
      offset,
    });

    // Mark as read
    await Message.update(
      { readAt: new Date() },
      { where: { senderId: otherId, receiverId: me, readAt: null } }
    );

    // Notify sender messages are read via Socket.io
    const io = req.app.get('io');
    if (io) io.to(`user:${otherId}`).emit('messages:read', { readBy: me, at: new Date().toISOString() });

    res.json({ messages });
  } catch (err) { next(err); }
});

// ── POST /api/messages ────────────────────────────────────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { receiverId, content } = req.body;

    if (!receiverId)       return res.status(400).json({ error: 'Mpokeaji anahitajika' });
    if (!content?.trim())  return res.status(400).json({ error: 'Andika ujumbe' });
    if (content.length > 2000) return res.status(400).json({ error: 'Ujumbe mrefu sana' });
    if (receiverId === req.user.id) return res.status(400).json({ error: 'Huwezi kujitumia ujumbe' });

    const receiver = await User.findByPk(receiverId);
    if (!receiver) return res.status(404).json({ error: 'Mpokeaji haipatikani' });

    const message = await Message.create({
      senderId: req.user.id, receiverId,
      content:  content.trim(),
    });

    const full = await Message.findByPk(message.id, {
      include: [
        { model: User, as: 'sender',   attributes: ['id','name','avatarUrl'] },
        { model: User, as: 'receiver', attributes: ['id','name','avatarUrl'] },
      ],
    });

    // Real-time delivery via Socket.io
    const io = req.app.get('io');
    if (io) {
      const sender = await User.findByPk(req.user.id, { attributes: ['name','avatarUrl'] });
      io.to(`user:${receiverId}`).emit('message:receive', {
        ...full.toJSON(),
        sender,
        isDelivered: true,
      });
    }

    res.status(201).json({ message: full });
  } catch (err) { next(err); }
});

// ── DELETE /api/messages/:id — Futa ujumbe ───────────────────
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const message = await Message.findByPk(req.params.id);
    if (!message) return res.status(404).json({ error: 'Ujumbe haipatikani' });
    if (message.senderId !== req.user.id) return res.status(403).json({ error: 'Unaweza kufuta ujumbe wako tu' });

    // Soft delete
    await message.update({ deletedAt: new Date(), content: 'Ujumbe umefutwa' });
    res.json({ message: 'Ujumbe umefutwa' });
  } catch (err) { next(err); }
});

module.exports = router;
