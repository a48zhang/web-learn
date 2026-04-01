export const config = {
  port: process.env.PORT || 3001,
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    name: process.env.DB_NAME || 'web_learn',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  },
};