import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../db/index.js';
import { generateToken, generateRefreshToken, verifyToken, authMiddleware, AuthRequest } from '../middleware/auth.js';

export const authRouter = Router();

// ============================================
// POST /auth/signup - Register new user
// ============================================
authRouter.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    // Check if user exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const result = await db.query(
      `INSERT INTO users (email, password_hash, full_name, email_verified)
       VALUES ($1, $2, $3, true)
       RETURNING id, email, full_name`,
      [email, passwordHash, fullName || null]
    );

    const user = result.rows[0];

    // Assign default role
    await db.query(
      'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
      [user.id, 'learner']
    );

    // Generate tokens
    const accessToken = generateToken({ id: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });

    // Store refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

    res.status(201).json({
      user: { id: user.id, email: user.email, fullName: user.full_name },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ============================================
// POST /auth/login - Authenticate user
// ============================================
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    // Find user
    const result = await db.query(
      'SELECT id, email, password_hash, full_name FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = result.rows[0];

    // Check password
    if (!user.password_hash) {
      res.status(401).json({ error: 'This account uses SSO login' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate tokens
    const accessToken = generateToken({ id: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });

    // Store refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

    res.json({
      user: { id: user.id, email: user.email, fullName: user.full_name },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============================================
// POST /auth/refresh - Refresh access token
// ============================================
authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    // Verify token format
    const decoded = verifyToken(refreshToken);
    if (!decoded) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    // Check if token exists in database
    const tokenResult = await db.query(
      'SELECT user_id FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [refreshToken]
    );

    if (tokenResult.rows.length === 0) {
      res.status(401).json({ error: 'Refresh token expired or revoked' });
      return;
    }

    // Get user
    const userResult = await db.query(
      'SELECT id, email, full_name FROM users WHERE id = $1',
      [tokenResult.rows[0].user_id]
    );

    if (userResult.rows.length === 0) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const user = userResult.rows[0];

    // Generate new access token
    const accessToken = generateToken({ id: user.id, email: user.email });

    res.json({ accessToken });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ============================================
// POST /auth/logout - Revoke refresh token
// ============================================
authRouter.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await db.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ============================================
// GET /auth/me - Get current user
// ============================================
authRouter.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const rolesResult = await db.query(
      'SELECT role FROM user_roles WHERE user_id = $1',
      [req.user!.id]
    );

    res.json({
      user: req.user,
      roles: rolesResult.rows.map(r => r.role),
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});
