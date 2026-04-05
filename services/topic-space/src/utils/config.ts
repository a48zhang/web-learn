import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const parseRequiredJwtSecret = () => {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error('JWT_SECRET is required');
  return secret;
};

const parseCorsOrigins = () => {
  const configured = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);
  if (configured && configured.length > 0) return configured;
  return ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];
};

export const config = {
  port: parseInt(String(process.env.TOPIC_SPACE_PORT || process.env.PORT || '3002'), 10),
  jwt: { secret: parseRequiredJwtSecret(), expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  cors: { origins: parseCorsOrigins() },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    name: process.env.DB_NAME || 'web_learn',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  },
};
