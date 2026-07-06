const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { chat, improvePost } = require('../utils/ai');

// POST /api/ai/chat — Chatbot ya kusaidia wanafunzi
router.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Andika ujumbe' });

    const reply = await chat(message.trim(), Array.isArray(history) ? history : []);
    res.json({ reply });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'AI imeshindwa kujibu' });
  }
});

// POST /api/ai/improve-post — Boresha rasimu ya post
router.post('/improve-post', authenticate, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Andika rasimu kwanza' });

    const improved = await improvePost(content.trim());
    res.json({ improved });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'AI imeshindwa kuboresha' });
  }
});

module.exports = router;
