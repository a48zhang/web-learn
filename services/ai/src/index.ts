import { DataTypes } from 'sequelize';
import app from './app';
import { config } from './utils/config';
import { sequelize } from './utils/database';

(async () => {
  await sequelize.authenticate();
  console.log('[ai] database connected');

  // Ensure editors column exists on the shared topic_topics table
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tableInfo = await queryInterface.describeTable('topic_topics');
    if (!tableInfo.editors) {
      await queryInterface.addColumn('topic_topics', 'editors', {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      });
      console.log('[ai] added editors column to topic_topics');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Table may not exist yet (managed by topic-space service) — skip silently
    if (!message.includes('No description found') && !message.includes("doesn't exist")) {
      console.error('[ai] editors migration failed:', error);
    }
  }

  app.listen(config.port, () => {
    console.log(`[ai] listening on port ${config.port}`);
  });
})();
