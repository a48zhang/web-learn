import { DataTypes } from 'sequelize';
import { sequelize } from './database';

export const runMigrations = async () => {
  try {
    const queryInterface = sequelize.getQueryInterface();

    const topicTableInfo = await queryInterface.describeTable('topic_topics');
    if (!topicTableInfo.editors) {
      await queryInterface.addColumn('topic_topics', 'editors', {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      });
      console.log('[migration] Added editors column to topic_topics');
    }

    const [topics] = await sequelize.query('SELECT id, created_by, editors FROM topic_topics');
    for (const topic of topics as Array<{ id: number; created_by: number; editors: unknown }>) {
      const currentEditors = Array.isArray(topic.editors) ? topic.editors : [];
      if (currentEditors.length === 0) {
        await sequelize.query(
          'UPDATE topic_topics SET editors = :editors WHERE id = :id',
          {
            replacements: {
              editors: JSON.stringify([topic.created_by.toString()]),
              id: topic.id,
            },
          }
        );
      }
    }

    console.log('[migration] Completed successfully');
  } catch (error) {
    console.error('[migration] Failed', error);
    throw error;
  }
};
