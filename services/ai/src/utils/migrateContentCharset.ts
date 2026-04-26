import { sequelize } from './database';

async function migrate() {
  const table = 'ai_agent_messages';
  const column = 'content';

  console.log(`Checking charset for column ${table}.${column}...`);

  const [results] = await sequelize.query<any[]>(
    `SELECT CHARACTER_SET_NAME, COLLATION_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = '${table}'
       AND COLUMN_NAME = '${column}'`,
    { raw: true }
  );

  if (!results || results.length === 0) {
    console.log(`Column ${table}.${column} not found.`);
    return;
  }

  const currentCharset = (results as any)[0].CHARACTER_SET_NAME;
  console.log(`Current charset: ${currentCharset}`);

  if (currentCharset === 'utf8mb4') {
    console.log('Already utf8mb4 — no change needed.');
    return;
  }

  console.log(`Migrating ${table}.${column} to utf8mb4...`);

  // Step 1: convert to BLOB to reset the encoding
  await sequelize.query(
    `ALTER TABLE ${table} MODIFY COLUMN ${column} MEDIUMBLOB NOT NULL`
  );

  // Step 2: convert to LONGTEXT with utf8mb4 (charset/collate must come right after type)
  await sequelize.query(
    `ALTER TABLE ${table} MODIFY COLUMN ${column} LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL`
  );

  console.log('Migration complete.');

  const [verify] = await sequelize.query<any[]>(
    `SELECT CHARACTER_SET_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = '${table}'
       AND COLUMN_NAME = '${column}'`,
    { raw: true }
  );

  console.log(`Verified charset: ${(verify as any)[0].CHARACTER_SET_NAME}`);
}

migrate().catch(console.error);