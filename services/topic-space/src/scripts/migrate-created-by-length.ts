import { sequelize } from '../utils/database';

async function runMigration() {
  console.log('Running migration: widen created_by to VARCHAR(100)...');
  const queryInterface = sequelize.getQueryInterface();
  const tableDescription = await queryInterface.describeTable('topic_topics');

  const existingType = tableDescription.created_by?.type?.toLowerCase().replace(/\s+/g, '');
  if (existingType === 'varchar(100)') {
    console.log('created_by is already VARCHAR(100), skipping');
    process.exit(0);
  }

  await queryInterface.changeColumn('topic_topics', 'created_by', {
    type: 'VARCHAR(100)',
    allowNull: false,
  });

  console.log('Migration complete: created_by widened to VARCHAR(100)');
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
