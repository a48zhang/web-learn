import { DataTypes } from 'sequelize';
import app from './app';
import { config } from './utils/config';
import { sequelize } from './utils/database';

(async () => {
  await sequelize.authenticate();

  // Migrate role enum from ('admin','teacher','student') to ('admin','user')
  try {
    const queryInterface = sequelize.getQueryInterface();
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

  await sequelize.sync(process.env.NODE_ENV === 'production' ? {} : { alter: true });
  console.log('[auth] database synced');
  app.listen(config.port, () => {
    console.log(`[auth] listening on port ${config.port}`);
  });
})();
