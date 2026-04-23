import app from './app';
import { startHeartbeat } from '@web-learn/shared';
import { config } from './utils/config';
import { sequelize } from './utils/database';
import { syncSchemaWithDiffCheck } from './utils/schemaSync';
import { initStorageService } from './services/storageService';
import { createAzureBlobStorageService } from './services/azureBlobStorageService';
import { createNullStorageService } from './services/nullStorageService';
import { runMigrations } from './utils/migrate';

(async () => {
  await sequelize.authenticate();

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Dev mode: compare DB schema with model definitions.
    // Recreate tables only when drift is detected.
    await syncSchemaWithDiffCheck(sequelize, 'topic-space');
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
      routes: [
        { path: '/api/topics', methods: ['GET'], auth: 'optional' },
        { path: '/api/topics/:id', methods: ['GET'], auth: 'optional' },
        {
          path: '/api/topics/:id/git/presign',
          methods: ['GET'],
          auth: 'optional',
          queryRules: [
            { when: { op: 'upload' }, auth: 'required' },
            { when: { op: 'download' }, auth: 'optional' },
            { when: { op: 'publish' }, auth: 'optional' },
          ],
        },
        { path: '/api/topics', methods: ['POST'], auth: 'required' },
        { path: '/api/topics/:id', methods: ['PUT'], auth: 'required' },
        { path: '/api/topics/:id/status', methods: ['PATCH'], auth: 'required' },
        { path: '/api/topics/:id', methods: ['DELETE'], auth: 'required' },
      ],
      metadata: { description: 'Topic space service' },
    });
  });
})();
