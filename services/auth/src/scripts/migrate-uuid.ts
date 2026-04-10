import { sequelize } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

async function runMigration() {
  console.log('Running migration: convert user IDs to UUID...');
  const queryInterface = sequelize.getQueryInterface();

  // Get all existing users
  const [users] = await sequelize.query('SELECT id FROM auth_users') as [any[], any];

  const idMap = new Map<number, string>();
  for (const user of users) {
    idMap.set(user.id, uuidv4());
  }

  // Add id_uuid column
  await queryInterface.addColumn('auth_users', 'id_uuid', {
    type: 'VARCHAR(36)',
    allowNull: true,
  });

  // Populate UUIDs
  for (const [oldId, newId] of idMap) {
    await sequelize.query(
      'UPDATE auth_users SET id_uuid = :newId WHERE id = :oldId',
      { replacements: { oldId, newId } }
    );
  }

  // Swap columns
  await queryInterface.removeColumn('auth_users', 'id');
  await queryInterface.renameColumn('auth_users', 'id_uuid', 'id');
  await queryInterface.changeColumn('auth_users', 'id', {
    type: 'VARCHAR(36)',
    primaryKey: true,
    allowNull: false,
  });

  console.log('Migration complete. Users migrated:', Object.fromEntries(idMap));
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
