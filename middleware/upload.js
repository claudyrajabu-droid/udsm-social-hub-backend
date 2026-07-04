// ============================================================
//  UPLOAD MIDDLEWARE — Multer + Cloudinary
// ============================================================
const multer     = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder:         'udsm-social-hub',
    allowed_formats:['jpg','jpeg','png','gif','webp'],
    transformation: [{ width: 1080, height: 1080, crop: 'limit', quality: 'auto' }],
    public_id:      `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  }),
});

const videoStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder:         'udsm-social-hub/videos',
    resource_type:  'video',
    allowed_formats:['mp4','mov','m4v','webm'],
    public_id:      `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  }),
});

const imageFileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg','image/png','image/gif','image/webp'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Aina ya faili haikubaliwi. Tumia JPG, PNG, GIF, au WEBP'), false);
};

const videoFileFilter = (req, file, cb) => {
  const allowed = ['video/mp4','video/quicktime','video/x-m4v','video/webm'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Aina ya video haikubaliwi. Tumia MP4, MOV, au WEBM'), false);
};

const upload = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max kwa picha
});

const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: videoFileFilter,
  limits: { fileSize: 60 * 1024 * 1024 }, // 60MB max kwa video/reel fupi
});

module.exports = upload;
module.exports.uploadVideo = uploadVideo;
