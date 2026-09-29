import multer from 'multer';

// memory storage so images go straight to Cloudinary without touching local disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024, files: 1 },
});

export const singleImage = upload.single('image');
