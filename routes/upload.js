// ============================================================
//  UPLOAD ROUTES — /api/upload
// ============================================================
const router = require('express').Router();
const upload = require('../middleware/upload');
const { uploadVideo } = require('../middleware/upload');
const { authenticate } = require('../middleware/auth');

// POST /api/upload/image — Pakia picha moja
router.post('/image', authenticate, upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Hakuna picha' });
    res.json({ url: req.file.path, publicId: req.file.filename });
  } catch {
    res.status(500).json({ error: 'Upakiaji umeshindwa' });
  }
});

// POST /api/upload/images — Pakia picha nyingi (max 5)
router.post('/images', authenticate, upload.array('images', 5), (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: 'Hakuna picha' });
    const urls = req.files.map(f => ({ url: f.path, publicId: f.filename }));
    res.json({ images: urls });
  } catch {
    res.status(500).json({ error: 'Upakiaji umeshindwa' });
  }
});

// POST /api/upload/video — Pakia video/reel fupi (max 60MB)
router.post('/video', authenticate, uploadVideo.single('video'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Hakuna video' });
    res.json({ url: req.file.path, publicId: req.file.filename });
  } catch {
    res.status(500).json({ error: 'Upakiaji wa video umeshindwa' });
  }
});

// Kamata makosa ya multer (mfano faili kubwa mno) kwa ujumbe rafiki
router.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message || 'Upakiaji umeshindwa' });
  next();
});

module.exports = router;
