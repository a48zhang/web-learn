import app from './app';
import { config } from './utils/config';
import { sequelize } from './utils/database';
import { initStorageService, createNullStorageService } from './services/storageService';
import { runMigrations } from './utils/migrate';

(async () => {
  await sequelize.authenticate();
  await runMigrations();

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Drop and recreate tables on every dev startup.
    // This avoids MySQL's 64-index limit that sync({ alter: true }) can hit
    // after repeated restarts, and always brings the schema to the latest state.
    await sequelize.sync({ force: true });
    console.log('[topic-space] database reset and synced (dev mode)');
  } else {
    await sequelize.sync();
    console.log('[topic-space] database synced (production mode)');
  }

  // Initialize storage service with null implementation for now
  // In production, this should be replaced with actual storage provider (OSS/S3/Azure)
  initStorageService(createNullStorageService());
  console.log('[topic-space] storage service initialized (null implementation)');

  app.listen(config.port, () => {
    console.log(`[topic-space] listening on port ${config.port}`);
  });
})();
