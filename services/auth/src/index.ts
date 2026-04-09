import { DataTypes } from 'sequelize';
import app from './app';
import { config } from './utils/config';
import { sequelize } from './utils/database';

(async () => {
  await sequelize.authenticate();

  const queryInterface = sequelize.getQueryInterface();
  let tableExists = false;
  try {
    await queryInterface.describeTable('auth_users');
    tableExists = true;
  } catch {
    // Table doesn't exist yet
  }

  if (tableExists) {
    // Table already exists — run manual migrations only, skip sync({ alter: true })
    // to avoid MySQL's 64-index limit being hit by repeated UNIQUE index recreation
    console.log('[auth] auth_users table exists, skipping sync');
  } else {
    // First run — create tables
    await sequelize.sync();
    console.log('[auth] database synced');
  }

  // Migrate role enum from ('admin','teacher','student') to ('admin','user')
  try {
    const tableInfo = await queryInterface.describeTable('auth_users');
    if (tableInfo.role && tableInfo.role.type === 'enum') {
      await sequelize.query(
        "UPDATE auth_users SET role = 'user' WHERE role IN ('teacher', 'student')"
      );
      await sequelize.query(
        "ALTER TABLE auth_users MODIFY COLUMN role ENUM('admin', 'user') NOT NULL DEFAULT 'user'"
      );
      console.log('[auth] role enum migrated');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('Unknown table') && !message.includes("doesn't exist")) {
      console.error('[auth] role migration failed:', error);
    }
  }
  app.listen(config.port, () => {
    console.log(`[auth] listening on port ${config.port}`);
  });
})();
