import app from './app';
import { config } from './utils/config';
import { sequelize } from './utils/database';
import { startHeartbeat } from '@web-learn/shared';
import './models';

(async () => {
  await sequelize.authenticate();
  console.log('[ai] database connected');

  // topic_topics and auth_users tables are managed by topic-space and auth services.
  // They run schema drift checks in dev mode and only force-sync when schema changes.
  // AI service models (ai_agent_conversations, ai_agent_messages) sync automatically in dev mode.
  if (process.env.NODE_ENV !== 'production') {
    await sequelize.sync({ alter: true });
    console.log('[ai] database schema synced (dev mode)');
  }

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
