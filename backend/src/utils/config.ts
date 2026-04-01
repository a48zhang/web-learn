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
  uploadsDir: process.env.UPLOADS_DIR || `${process.cwd()}/uploads`,
};
