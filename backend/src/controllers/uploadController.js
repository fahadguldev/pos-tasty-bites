import { uploadImage, destroyImage, isCloudinaryReady } from '../config/cloudinary.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

export const upload = asyncHandler(async (req, res) => {
  if (!isCloudinaryReady()) {
    return res.status(503).json({
      error: 'Image uploads are not configured. Add your Cloudinary keys to backend/.env',
    });
  }
  if (!req.file) return res.status(400).json({ error: 'No image received' });

  const { buffer, mimetype } = req.file;
  if (!ALLOWED.includes(mimetype)) {
    return res.status(400).json({ error: 'Upload a JPG, PNG, WEBP, AVIF or GIF image' });
  }
  if (buffer.length > MAX_BYTES) {
    return res.status(400).json({ error: 'Image is too large — keep it under 6 MB' });
  }

  const folder = req.query.folder ? String(req.query.folder).replace(/[^a-z0-9/_-]/gi, '') : 'tasty-bites';
  const result = await uploadImage(buffer, folder);

  res.status(201).json(result);
});

export const remove = asyncHandler(async (req, res) => {
  const { publicId } = req.body;
  if (!publicId) return res.status(400).json({ error: 'publicId is required' });

  await destroyImage(publicId);
  res.json({ ok: true });
});

export const status = asyncHandler(async (req, res) => {
  res.json({ cloudinary: isCloudinaryReady() });
});
