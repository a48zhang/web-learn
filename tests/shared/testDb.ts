import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'web_learn',
};

const TABLES = ['auth_users', 'topic_topics', 'topic_pages'];

let connection: mysql.Connection | null = null;

export async function getConnection(): Promise<mysql.Connection> {
  if (!connection) {
    connection = await mysql.createConnection(DB_CONFIG);
  }
  return connection;
}

export async function reset(): Promise<void> {
  const conn = await getConnection();
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of TABLES) {
    try {
      await conn.query(`TRUNCATE TABLE \`${table}\``);
    } catch {
      // Table may not exist yet
    }
  }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
}

export interface SeedUser {
  id: number;
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
}

export async function seed(): Promise<{ admin: SeedUser; user: SeedUser }> {
  const conn = await getConnection();

  const admin: SeedUser = {
    id: 1,
    username: 'admin',
    email: 'admin@test.com',
    password: 'Admin123!',
    role: 'admin',
  };

  const normalUser: SeedUser = {
    id: 2,
    username: 'testuser',
    email: 'user@test.com',
    password: 'User123!',
    role: 'user',
  };

  const adminPasswordHash = await bcrypt.hash(admin.password, 10);
  const userPasswordHash = await bcrypt.hash(normalUser.password, 10);

  await conn.query(
    `INSERT INTO auth_users (id, username, email, password, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [admin.id, admin.username, admin.email, adminPasswordHash, admin.role]
  );

  await conn.query(
    `INSERT INTO auth_users (id, username, email, password, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [normalUser.id, normalUser.username, normalUser.email, userPasswordHash, normalUser.role]
  );

  return { admin, user: normalUser };
}

export async function close(): Promise<void> {
  if (connection) {
    await connection.end();
    connection = null;
  }
}
