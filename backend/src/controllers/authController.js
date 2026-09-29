import Admin from '../models/Admin.js';
import { signToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const admin = await Admin.findOne({ email: String(email).toLowerCase().trim() });
  if (!admin) return res.status(401).json({ error: 'Invalid email or password' });

  const match = await admin.verifyPassword(password);
  if (!match) return res.status(401).json({ error: 'Invalid email or password' });

  admin.lastLoginAt = new Date();
  await admin.save();

  res.json({
    token: signToken(admin),
    admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json({
    id: req.admin._id,
    name: req.admin.name,
    email: req.admin.email,
    role: req.admin.role,
  });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both current and new password are required' });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const match = await req.admin.verifyPassword(currentPassword);
  if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

  await req.admin.setPassword(newPassword);
  await req.admin.save();

  res.json({ ok: true });
});
