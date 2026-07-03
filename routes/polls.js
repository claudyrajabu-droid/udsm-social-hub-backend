// ============================================================
//  POLLS ROUTES — /api/polls
//  GET /  POST /  GET /:id  POST /:id/vote  DELETE /:id
// ============================================================
const router = require('express').Router();
const { Poll, PollOption, PollVote, User, Notification } = require('../models');
const { authenticate } = require('../middleware/auth');

// ── GET /api/polls ────────────────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page)-1)*parseInt(limit);

    const polls = await Poll.findAll({
      where: { isActive: true },
      include: [
        { model: User,       as: 'creator', attributes: ['id','name','avatarUrl','department'] },
        { model: PollOption, as: 'options', order: [['order','ASC']] },
        { model: PollVote,   as: 'votes',   where: { userId: req.user.id }, required: false },
      ],
      order: [['createdAt','DESC']],
      limit: parseInt(limit), offset,
    });

    const formatted = polls.map(p => {
      const json    = p.toJSON();
      const myVote  = json.votes?.[0];
      return { ...json, hasVoted: !!myVote, votedOptionId: myVote?.optionId || null, votes: undefined };
    });

    res.json({ polls: formatted });
  } catch (err) { next(err); }
});

// ── POST /api/polls ───────────────────────────────────────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { question, description, options, endsAt, isAnonymous } = req.body;

    if (!question?.trim())                  return res.status(400).json({ error: 'Andika swali la poll' });
    if (!options || options.length < 2)     return res.status(400).json({ error: 'Lazima iwe na majibu 2 au zaidi' });
    if (options.length > 6)                 return res.status(400).json({ error: 'Majibu mengi sana (max 6)' });
    if (options.some(o => !o?.trim()))      return res.status(400).json({ error: 'Majibu yote lazima yawe na maneno' });

    const poll = await Poll.create({
      userId:      req.user.id,
      question:    question.trim(),
      description: description?.trim() || null,
      endsAt:      endsAt ? new Date(endsAt) : null,
      isAnonymous: !!isAnonymous,
    });

    await PollOption.bulkCreate(
      options.map((label, i) => ({ pollId: poll.id, label: label.trim(), order: i+1 }))
    );

    const full = await Poll.findByPk(poll.id, {
      include: [
        { model: User,       as: 'creator', attributes: ['id','name','avatarUrl'] },
        { model: PollOption, as: 'options', order: [['order','ASC']] },
      ],
    });

    res.status(201).json({ message: 'Poll imeundwa! 📊', poll: { ...full.toJSON(), hasVoted: false, votedOptionId: null } });
  } catch (err) { next(err); }
});

// ── GET /api/polls/:id ────────────────────────────────────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const poll = await Poll.findByPk(req.params.id, {
      include: [
        { model: User,       as: 'creator', attributes: ['id','name','avatarUrl'] },
        { model: PollOption, as: 'options', order: [['order','ASC']] },
        { model: PollVote,   as: 'votes',   where: { userId: req.user.id }, required: false },
      ],
    });
    if (!poll) return res.status(404).json({ error: 'Poll haipatikani' });

    const json   = poll.toJSON();
    const myVote = json.votes?.[0];
    res.json({ ...json, hasVoted: !!myVote, votedOptionId: myVote?.optionId || null, votes: undefined });
  } catch (err) { next(err); }
});

// ── POST /api/polls/:id/vote ──────────────────────────────────
router.post('/:id/vote', authenticate, async (req, res, next) => {
  try {
    const { optionId } = req.body;
    if (!optionId) return res.status(400).json({ error: 'Chagua jibu moja' });

    const poll = await Poll.findByPk(req.params.id);
    if (!poll)          return res.status(404).json({ error: 'Poll haipatikani' });
    if (!poll.isActive) return res.status(400).json({ error: 'Poll imefungwa' });
    if (poll.endsAt && new Date() > poll.endsAt) return res.status(400).json({ error: 'Poll imekwisha muda wake' });

    const alreadyVoted = await PollVote.findOne({ where: { pollId: poll.id, userId: req.user.id } });
    if (alreadyVoted) return res.status(409).json({ error: 'Umekwisha piga kura katika poll hii' });

    const option = await PollOption.findOne({ where: { id: optionId, pollId: poll.id } });
    if (!option) return res.status(404).json({ error: 'Jibu halipatikani' });

    await PollVote.create({ pollId: poll.id, optionId, userId: req.user.id });
    await PollOption.increment('votes',      { where: { id: optionId } });
    await Poll.increment('totalVotes',       { where: { id: poll.id  } });

    // Notification kwa mwenye poll
    if (poll.userId !== req.user.id && !poll.isAnonymous) {
      const voter = await User.findByPk(req.user.id, { attributes: ['name'] });
      await Notification.create({
        userId: poll.userId, actorId: req.user.id,
        type: 'poll', title: 'Kura Mpya',
        body: `${voter.name} alipiga kura kwenye poll yako`,
        refId: poll.id, refType: 'poll',
      });
    }

    res.json({ message: 'Kura imepigwa! ✅', votedOptionId: optionId });
  } catch (err) { next(err); }
});

// ── DELETE /api/polls/:id ─────────────────────────────────────
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const poll = await Poll.findByPk(req.params.id);
    if (!poll) return res.status(404).json({ error: 'Poll haipatikani' });
    if (poll.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Hauna ruhusa' });

    await poll.destroy();
    res.json({ message: 'Poll imefutwa' });
  } catch (err) { next(err); }
});

// ── PATCH /api/polls/:id/close — Funga poll ──────────────────
router.patch('/:id/close', authenticate, async (req, res, next) => {
  try {
    const poll = await Poll.findByPk(req.params.id);
    if (!poll) return res.status(404).json({ error: 'Poll haipatikani' });
    if (poll.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Hauna ruhusa' });

    await poll.update({ isActive: false });
    res.json({ message: 'Poll imefungwa' });
  } catch (err) { next(err); }
});

module.exports = router;
