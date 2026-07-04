// ============================================================
//  POSTS ROUTES — /api/posts
//  GET / POST /:id PUT /:id DELETE /:id
//  POST /:id/like  POST /:id/comments  GET /search
// ============================================================
const router = require('express').Router();
const { Op }  = require('sequelize');
const { Post, User, Comment, Like, Notification } = require('../models');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

// ── GET /api/posts — Feed ─────────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, userId, hashtag } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = { visibility: 'public' };
    if (userId)  where.userId  = userId;
    if (hashtag) where.hashtags = { [Op.contains]: [hashtag] };

    const { rows: posts, count } = await Post.findAndCountAll({
      where,
      include: [
        { model: User, as: 'author', attributes: ['id','name','avatarUrl','department','role'] },
        { model: Like, as: 'likes', where: { userId: req.user.id }, required: false },
      ],
      order: [['isPinned','DESC'], ['createdAt','DESC']],
      limit:  parseInt(limit),
      offset,
      distinct: true,
    });

    const formatted = posts.map(p => ({
      ...p.toJSON(),
      isLiked: p.likes && p.likes.length > 0,
      likes: undefined,
    }));

    res.json({ posts: formatted, total: count, page: parseInt(page), pages: Math.ceil(count / parseInt(limit)) });
  } catch (err) { next(err); }
});

// ── GET /api/posts/search ─────────────────────────────────────
router.get('/search', authenticate, async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ posts: [] });

    const posts = await Post.findAll({
      where: { content: { [Op.iLike]: `%${q.trim()}%` }, visibility: 'public' },
      include: [{ model: User, as: 'author', attributes: ['id','name','avatarUrl','department'] }],
      order: [['createdAt','DESC']],
      limit: 30,
    });
    res.json({ posts });
  } catch (err) { next(err); }
});

// ── POST /api/posts ───────────────────────────────────────────
router.post('/', authenticate, upload.array('images', 5), async (req, res, next) => {
  try {
    let { content, hashtags, visibility, videoUrl, imageUrls: bodyImageUrls } = req.body;

    if (!content?.trim()) return res.status(400).json({ error: 'Andika kitu!' });
    if (content.length > 2000) return res.status(400).json({ error: 'Post ndefu sana (max herufi 2000)' });

    // Extract hashtags from content if not provided
    if (!hashtags) {
      const found = content.match(/#\w+/g) || [];
      hashtags = found.map(h => h.slice(1));
    } else if (typeof hashtags === 'string') {
      hashtags = JSON.parse(hashtags);
    }

    // Picha zaweza kuja moja kwa moja (multipart req.files) AU zikiwa
    // zimeshapakiwa awali kupitia /upload/image (JSON imageUrls array)
    let imageUrls = req.files ? req.files.map(f => f.path) : [];
    if (!imageUrls.length && bodyImageUrls) {
      imageUrls = typeof bodyImageUrls === 'string' ? JSON.parse(bodyImageUrls) : bodyImageUrls;
    }

    const post = await Post.create({
      userId:     req.user.id,
      content:    content.trim(),
      imageUrls,
      videoUrl:   videoUrl || null,
      hashtags,
      visibility: visibility || 'public',
    });

    // Increment user post count
    await User.increment('postsCount', { where: { id: req.user.id } });

    const full = await Post.findByPk(post.id, {
      include: [{ model: User, as: 'author', attributes: ['id','name','avatarUrl','department','role'] }],
    });

    res.status(201).json({ message: 'Post imechapishwa! ✅', post: { ...full.toJSON(), isLiked: false } });
  } catch (err) { next(err); }
});

// ── GET /api/posts/:id ────────────────────────────────────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const post = await Post.findByPk(req.params.id, {
      include: [
        { model: User, as: 'author', attributes: ['id','name','avatarUrl','department','role'] },
        {
          model: Comment, as: 'comments',
          include: [{ model: User, as: 'author', attributes: ['id','name','avatarUrl'] }],
          where: { parentId: null },
          required: false,
          limit: 50,
          order: [['createdAt','ASC']],
        },
      ],
    });

    if (!post) return res.status(404).json({ error: 'Post haipatikani' });

    const liked = await Like.findOne({ where: { postId: post.id, userId: req.user.id } });
    res.json({ ...post.toJSON(), isLiked: !!liked });
  } catch (err) { next(err); }
});

// ── PUT /api/posts/:id ────────────────────────────────────────
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post haipatikani' });
    if (post.userId !== req.user.id) return res.status(403).json({ error: 'Unaweza kuhariri post yako tu' });

    const { content, visibility } = req.body;
    if (content && content.length > 2000) return res.status(400).json({ error: 'Post ndefu sana' });

    await post.update({
      content:    content?.trim() || post.content,
      visibility: visibility     || post.visibility,
      hashtags:   content ? (content.match(/#\w+/g) || []).map(h=>h.slice(1)) : post.hashtags,
    });

    res.json({ message: 'Post imebadilishwa ✅', post });
  } catch (err) { next(err); }
});

// ── DELETE /api/posts/:id ─────────────────────────────────────
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post haipatikani' });

    const isOwner = post.userId === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Hauna ruhusa ya kufuta post hii' });

    await post.destroy();
    if (isOwner) await User.decrement('postsCount', { where: { id: req.user.id } });

    res.json({ message: 'Post imefutwa' });
  } catch (err) { next(err); }
});

// ── POST /api/posts/:id/like — Toggle ────────────────────────
router.post('/:id/like', authenticate, async (req, res, next) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post haipatikani' });

    const existing = await Like.findOne({ where: { postId: post.id, userId: req.user.id } });

    if (existing) {
      await existing.destroy();
      await Post.decrement('likesCount', { where: { id: post.id } });
      return res.json({ liked: false, likesCount: post.likesCount - 1 });
    }

    await Like.create({ postId: post.id, userId: req.user.id });
    await Post.increment('likesCount', { where: { id: post.id } });

    // Notification (si kwa mwenyewe)
    if (post.userId !== req.user.id) {
      const liker = await User.findByPk(req.user.id, { attributes: ['name','avatarUrl'] });
      const notif = await Notification.create({
        userId:  post.userId,
        actorId: req.user.id,
        type:    'like',
        title:   'Like Mpya',
        body:    `${liker.name} alipiga like post yako`,
        refId:   post.id,
        refType: 'post',
      });
      // Socket.io real-time
      const io = req.app.get('io');
      if (io) io.sendNotification?.(post.userId, { ...notif.toJSON(), actor: liker });
    }

    res.json({ liked: true, likesCount: post.likesCount + 1 });
  } catch (err) { next(err); }
});

// ── GET /api/posts/:id/comments ───────────────────────────────
router.get('/:id/comments', authenticate, async (req, res, next) => {
  try {
    const comments = await Comment.findAll({
      where: { postId: req.params.id, parentId: null },
      include: [
        { model: User, as: 'author', attributes: ['id','name','avatarUrl','department'] },
        { model: Comment, as: 'replies',
          include: [{ model: User, as: 'author', attributes: ['id','name','avatarUrl'] }],
          limit: 5,
        },
      ],
      order: [['createdAt','ASC']],
      limit: 50,
    });
    res.json({ comments });
  } catch (err) { next(err); }
});

// ── POST /api/posts/:id/comments ─────────────────────────────
router.post('/:id/comments', authenticate, async (req, res, next) => {
  try {
    const { content, parentId } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Andika comment' });
    if (content.length > 500) return res.status(400).json({ error: 'Comment ndefu sana (max 500)' });

    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post haipatikani' });

    const comment = await Comment.create({
      postId:   post.id,
      userId:   req.user.id,
      parentId: parentId || null,
      content:  content.trim(),
    });

    if (!parentId) await Post.increment('commentsCount', { where: { id: post.id } });

    const full = await Comment.findByPk(comment.id, {
      include: [{ model: User, as: 'author', attributes: ['id','name','avatarUrl','department'] }],
    });

    // Notification
    if (post.userId !== req.user.id) {
      const commenter = await User.findByPk(req.user.id, { attributes: ['name'] });
      await Notification.create({
        userId: post.userId, actorId: req.user.id,
        type: 'comment', title: 'Comment Mpya',
        body: `${commenter.name}: "${content.slice(0,50)}..."`,
        refId: post.id, refType: 'post',
      });
    }

    res.status(201).json({ comment: full });
  } catch (err) { next(err); }
});

// ── DELETE /api/posts/:postId/comments/:commentId ────────────
router.delete('/:postId/comments/:commentId', authenticate, async (req, res, next) => {
  try {
    const comment = await Comment.findOne({ where: { id: req.params.commentId, postId: req.params.postId } });
    if (!comment) return res.status(404).json({ error: 'Comment haipatikani' });
    if (comment.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Hauna ruhusa' });

    await comment.destroy();
    if (!comment.parentId) await Post.decrement('commentsCount', { where: { id: req.params.postId } });
    res.json({ message: 'Comment imefutwa' });
  } catch (err) { next(err); }
});

module.exports = router;
