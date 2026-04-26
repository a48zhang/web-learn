import app from './app';
import { config } from './utils/config';
import { sequelize } from './utils/database';
import { startHeartbeat } from '@web-learn/shared';
import { AgentConversation, AgentMessage } from './models';

(async () => {
  await sequelize.authenticate();
  console.log('[ai] database connected');

  // topic_topics and auth_users tables are managed by topic-space and auth services.
  // Only sync AI-owned tables here so dev startup cannot ALTER cross-service tables.
  if (process.env.NODE_ENV !== 'production') {
    await AgentConversation.sync({ alter: true });
    await AgentMessage.sync({ alter: true });
    console.log('[ai] database schema synced (dev mode)');
  }

  app.listen(config.port, () => {
    console.log(`[ai] listening on port ${config.port}`);
    const serviceHost = process.env.SERVICE_HOST || 'localhost';
    startHeartbeat({
      name: 'ai',
      url: `http://${serviceHost}:${config.port}`,
      routes: [
        { path: '/api/ai/chat/completions', methods: ['POST'], auth: 'required' },
        { path: '/api/ai/conversations/:topicId/:agentType', methods: ['GET', 'PUT'], auth: 'required' },
      ],
      metadata: { description: 'AI service' },
    });
  });
})();
