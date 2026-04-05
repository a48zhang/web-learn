import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { User } from '../models';
import { config } from '../utils/config';

const serializeUser = (user: User) => ({
  id: String(user.id),
  username: user.username,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
});

export const register = async (req: Request, res: Response) => {
  try {
    const { username, email, password, role: bodyRole } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, error: 'Username, email, and password are required' });
    }
    const role = bodyRole === 'teacher' ? 'teacher' : 'student';
    const existing = await User.findOne({ where: { [Op.or]: [{ username }, { email }] } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Username or email already exists' });
    }
    const user = await User.create({ username, email, password, role });
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      config.jwt.secret as jwt.Secret,
      { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] }
    );
    return res.status(201).json({ success: true, data: { token, user: serializeUser(user) } });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      config.jwt.secret as jwt.Secret,
      { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] }
    );
    return res.json({ success: true, data: { token, user: serializeUser(user) } });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
