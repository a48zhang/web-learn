import app from './app';
import { config } from './utils/config';
import { sequelize } from './utils/database';
import { startHeartbeat } from '@web-learn/shared';

(async () => {
  await sequelize.authenticate();
  console.log('[ai] database connected');

  // topic_topics and auth_users tables are managed by topic-space and auth services.
  // Those services call sync({ force: true }) in dev mode, so tables are always up to date.
  // No migration needed here.

  app.listen(config.port, () => {
    console.log(`[ai] listening on port ${config.port}`);
    const serviceHost = process.env.SERVICE_HOST || 'localhost';
    startHeartbeat({
      name: 'ai',
      url: `http://${serviceHost}:${config.port}`,
      routes: ['/api/ai'],
      metadata: { description: 'AI service' },
    });
  });
})();
