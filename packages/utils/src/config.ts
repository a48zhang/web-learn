import dotenv from 'dotenv';
import fs from 'fs';

// Support explicit env file path; otherwise load from current working directory (default .env behavior)
if (process.env.DOTENV_CONFIG_PATH) {
  dotenv.config({ path: process.env.DOTENV_CONFIG_PATH });
} else {
  dotenv.config();
}

export interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  ssl: boolean;
  sslRejectUnauthorized: boolean;
  sslCa?: string;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
}

const parseBoolean = (value: string | undefined, defaultValue = false) => {
  if (!value) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const readOptionalFile = (path: string | undefined) => {
  if (!path) return undefined;
  return fs.readFileSync(path, 'utf8');
};

export const createDatabaseConfig = (): DatabaseConfig => {
  const sslCa = process.env.DB_SSL_CA || readOptionalFile(process.env.DB_SSL_CA_PATH);
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    name: process.env.DB_NAME || 'web_learn',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    ssl: parseBoolean(process.env.DB_SSL),
    sslRejectUnauthorized: parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, true),
    ...(sslCa ? { sslCa } : {}),
  };
};

export const createJwtConfig = (): JwtConfig => {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error('JWT_SECRET is required');
  return {
    secret,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  };
};

export const parseCorsOrigins = (): string[] => {
  const configured = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);
  if (configured && configured.length > 0) return configured;
  return ['http://localhost:5173', 'http://127.0.0.1:5173'];
};
