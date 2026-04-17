import app from './app';
import { config } from './utils/config';
import { sequelize } from './utils/database';
import { syncSchemaWithDiffCheck } from './utils/schemaSync';
import { startHeartbeat } from '@web-learn/shared';

(async () => {
  await sequelize.authenticate();

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Dev mode: compare DB schema with model definitions.
    // Recreate tables only when drift is detected.
    await syncSchemaWithDiffCheck(sequelize, 'auth');
  } else {
    await sequelize.sync();
    console.log('[auth] database synced (production mode)');
  }

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

  app.listen(config.port, () => {
    console.log(`[auth] listening on port ${config.port}`);
    const serviceHost = process.env.SERVICE_HOST || 'localhost';
    startHeartbeat({
      name: 'auth',
      url: `http://${serviceHost}:${config.port}`,
      routes: ['/api/auth', '/api/users'],
      metadata: { description: 'Authentication service' },
    });
  });
})();
