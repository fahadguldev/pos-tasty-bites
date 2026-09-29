import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

export function signToken(admin) {
  return jwt.sign({ sub: String(admin._id), email: admin.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

export async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'Sign in to continue' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(payload.sub);
    if (!admin) return res.status(401).json({ error: 'Account no longer exists' });

    req.admin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired, please sign in again' });
  }
}
