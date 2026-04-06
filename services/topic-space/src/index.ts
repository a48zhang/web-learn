import app from './app';
import { config } from './utils/config';
import { sequelize } from './utils/database';
import { initStorageService, createNullStorageService } from './services/storageService';

(async () => {
  await sequelize.authenticate();
  await sequelize.sync(process.env.NODE_ENV === 'production' ? {} : { alter: true });
  console.log('[topic-space] database synced');

  // Initialize storage service with null implementation for now
  // In production, this should be replaced with actual storage provider (OSS/S3/Azure)
  initStorageService(createNullStorageService());
  console.log('[topic-space] storage service initialized (null implementation)');

  app.listen(config.port, () => {
    console.log(`[topic-space] listening on port ${config.port}`);
  });
})();
