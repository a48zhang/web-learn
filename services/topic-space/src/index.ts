import app from './app';
import { config } from './utils/config';
import { sequelize } from './utils/database';
import { initStorageService, createNullStorageService } from './services/storageService';
import { runMigrations } from './utils/migrate';

(async () => {
  await sequelize.authenticate();
  await runMigrations();

  // Check if tables already exist before running sync({ alter: true })
  // to avoid MySQL's 64-index limit being hit by repeated UNIQUE index recreation
  let tableExists = false;
  try {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.describeTable('topic_topics');
    tableExists = true;
  } catch {
    // Tables don't exist yet
  }

  if (tableExists) {
    console.log('[topic-space] tables exist, skipping sync');
  } else {
    await sequelize.sync(process.env.NODE_ENV === 'production' ? {} : { alter: true });
    console.log('[topic-space] database synced');
  }

  // Initialize storage service with null implementation for now
  // In production, this should be replaced with actual storage provider (OSS/S3/Azure)
  initStorageService(createNullStorageService());
  console.log('[topic-space] storage service initialized (null implementation)');

  app.listen(config.port, () => {
    console.log(`[topic-space] listening on port ${config.port}`);
  });
})();
