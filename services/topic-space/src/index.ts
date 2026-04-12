import app from './app';
import { startHeartbeat } from '@web-learn/shared';
import { config } from './utils/config';
import { sequelize } from './utils/database';
import { initStorageService } from './services/storageService';
import { createAzureBlobStorageService } from './services/azureBlobStorageService';
import { createNullStorageService } from './services/nullStorageService';
import { runMigrations } from './utils/migrate';

(async () => {
  await sequelize.authenticate();

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

  // Run manual migrations (e.g. add editors column) after tables are created
  await runMigrations();

  // Initialize storage service based on configuration
  if (config.storage.provider === 'azure') {
    initStorageService(
      createAzureBlobStorageService(
        config.storage.azure.connectionString,
        config.storage.azure.containerName,
      ),
    );
  } else {
    initStorageService(createNullStorageService());
  }
  console.log(`[topic-space] storage service initialized (${config.storage.provider})`);

  app.listen(config.port, () => {
    console.log(`[topic-space] listening on port ${config.port}`);
    const serviceHost = process.env.SERVICE_HOST || 'localhost';
    startHeartbeat({
      name: 'topic-space',
      url: `http://${serviceHost}:${config.port}`,
      routes: ['/api/topics'],
      metadata: { description: 'Topic space service' },
    });
  });
})();
