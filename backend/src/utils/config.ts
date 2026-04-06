import dotenv from 'dotenv';

// Support explicit env file path; otherwise load from current working directory (default .env behavior)
if (process.env.DOTENV_CONFIG_PATH) {
  dotenv.config({ path: process.env.DOTENV_CONFIG_PATH });
} else {
  dotenv.config();
}


const parseRequiredJwtSecret = () => {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }

  return secret;
};

const parseCorsOrigins = () => {
  const configuredOrigins = process.env.CORS_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins && configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  return ['http://localhost:5173', 'http://127.0.0.1:5173'];
};

export const config = {
  port: process.env.PORT || 3001,
  jwt: {
    secret: parseRequiredJwtSecret(),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  cors: {
    origins: parseCorsOrigins(),
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    name: process.env.DB_NAME || 'web_learn',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  },
  ai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || '',
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  },
  storage: {
    provider: (process.env.STORAGE_PROVIDER as 'oss' | 's3' | 'azure' | 'local') || 'local',
    bucket: process.env.STORAGE_BUCKET || process.env.OSS_BUCKET || '',
    region: process.env.STORAGE_REGION || process.env.OSS_REGION || '',
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.STORAGE_ACCESS_KEY_SECRET || process.env.OSS_ACCESS_KEY_SECRET || '',
    accountName: process.env.STORAGE_ACCOUNT_NAME || '',
    accountKey: process.env.STORAGE_ACCOUNT_KEY || '',
    cdnBase: process.env.STORAGE_CDN_BASE || process.env.OSS_CDN_BASE || '',
    endpoint: process.env.STORAGE_ENDPOINT || '',
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
  },
};
