import { sequelize } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

async function runMigration() {
  console.log('Running migration: convert topic IDs to UUID...');
  const queryInterface = sequelize.getQueryInterface();
  const tableDescription = await queryInterface.describeTable('topic_topics');

  // Add published_url and share_link if they don't exist
  if (!tableDescription.published_url) {
    await queryInterface.addColumn('topic_topics', 'published_url', {
      type: 'STRING',
      allowNull: true,
    });
    console.log('Added published_url column');
  }

  if (!tableDescription.share_link) {
    await queryInterface.addColumn('topic_topics', 'share_link', {
      type: 'STRING',
      allowNull: true,
    });
    console.log('Added share_link column');
  }

  // Get all existing topics
  const [topics] = await sequelize.query('SELECT id, created_by, editors FROM topic_topics') as [any[], any];

  // Map old integer IDs to new UUIDs
  const idMap = new Map<string, string>();

  for (const topic of topics) {
    const newId = uuidv4();
    idMap.set(topic.id.toString(), newId);
  }

  // Convert id column: add temp column, populate, swap
  await queryInterface.addColumn('topic_topics', 'id_uuid', {
    type: 'VARCHAR(36)',
    allowNull: true,
  });

  for (const [oldId, newId] of idMap) {
    await sequelize.query(
      'UPDATE topic_topics SET id_uuid = :newId WHERE id = :oldId',
      { replacements: { oldId: parseInt(oldId), newId } }
    );
  }

  // Drop old id column and rename
  await queryInterface.removeColumn('topic_topics', 'id');
  await queryInterface.renameColumn('topic_topics', 'id_uuid', 'id');
  await queryInterface.changeColumn('topic_topics', 'id', {
    type: 'VARCHAR(36)',
    primaryKey: true,
    allowNull: false,
  });

  console.log('Migration complete. Topics migrated:', Object.fromEntries(idMap));
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
