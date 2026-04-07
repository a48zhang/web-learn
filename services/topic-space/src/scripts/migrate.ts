import { sequelize } from '../utils/database';

async function runMigration() {
  console.log('Running migration: add editor fields to topics...');

  const queryInterface = sequelize.getQueryInterface();

  // Check and add columns
  const tableDescription = await queryInterface.describeTable('topic_topics');

  if (!tableDescription.files_snapshot) {
    await queryInterface.addColumn('topic_topics', 'files_snapshot', {
      type: 'TEXT',
      allowNull: true,
    });
    console.log('Added files_snapshot column');
  }

  if (!tableDescription.chat_history) {
    await queryInterface.addColumn('topic_topics', 'chat_history', {
      type: 'TEXT',
      allowNull: true,
    });
    console.log('Added chat_history column');
  }

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

  console.log('Migration complete.');
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
