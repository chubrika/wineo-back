import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { findByEmail, create } from '../store/users.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * POST /auth/register
 * Body: { email, password, firstName, lastName }
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (!firstName?.trim() || !lastName?.trim()) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await create({
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    });

    const token = jwt.sign(
      { userId: user.id },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role || 'customer' },
      token,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /auth/login
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const userId = user._id.toString();
    const token = jwt.sign(
      { userId },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    const firstName = user.firstName ?? (user.name || '').split(' ')[0] ?? '';
    const lastName = user.lastName ?? (user.name || '').split(' ').slice(1).join(' ') ?? '';
    const role = user.role === 'admin' ? 'admin' : 'customer';
    res.json({
      user: { id: userId, email: user.email, firstName, lastName, role },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /auth/me — current user (requires Authorization: Bearer <token>)
 */
router.get('/me', requireAuth, (req, res) => {
  const { id, email, firstName, lastName, name, role } = req.user;
  const first = firstName ?? (name || '').split(' ')[0] ?? '';
  const last = lastName ?? (name || '').split(' ').slice(1).join(' ') ?? '';
  const userRole = role === 'admin' ? 'admin' : 'customer';
  res.json({ user: { id, email, firstName: first, lastName: last, role: userRole } });
});

export default router;
