/**
 * Migration runner: 001_cleanup_legacy_timestamp_columns
 *
 * For fresh databases, Sequelize model sync already creates the correct columns:
 * - resources.uploaded_at
 * - submissions.submitted_at
 * - reviews.reviewed_at
 *
 * This runner only removes legacy `created_at` columns if they still exist.
 * It is intentionally schema-only and safe to rerun after `syncDatabase()`.
 */

import { QueryTypes } from 'sequelize';
import { sequelize } from '../utils/database';

interface ColExistsRow {
  count: number;
}

interface ColInfoRow {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  DATA_TYPE: string;
  IS_NULLABLE: string;
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const result = await sequelize.query<ColExistsRow>(
    `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    {
      replacements: [tableName, columnName],
      type: QueryTypes.SELECT,
    }
  );
  return (result[0]?.count ?? 0) > 0;
}

async function ensureColumnExists(table: string, column: string): Promise<void> {
  const exists = await columnExists(table, column);
  if (!exists) {
    throw new Error(`${table}.${column} does not exist after syncDatabase()`);
  }
}

async function dropColumnIfExists(table: string, column: string): Promise<void> {
  const exists = await columnExists(table, column);
  if (!exists) {
    console.log(`  [SKIP] ${table}: '${column}' does not exist`);
    return;
  }

  await sequelize.query(`ALTER TABLE ${table} DROP COLUMN ${column}`);
  console.log(`  [OK]   ${table}: dropped '${column}'`);
}

export async function runMigration(): Promise<void> {
  console.log('\n=== Migration 001: Cleanup legacy timestamp columns ===\n');

  await ensureColumnExists('resources', 'uploaded_at');
  await ensureColumnExists('submissions', 'submitted_at');
  await ensureColumnExists('reviews', 'reviewed_at');

  console.log('Dropping legacy columns if they still exist...');
  await dropColumnIfExists('resources', 'created_at');
  await dropColumnIfExists('submissions', 'created_at');
  await dropColumnIfExists('reviews', 'created_at');

  console.log('\nVerifying final schema...');
  const rows = await sequelize.query<ColInfoRow>(
    `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN ('resources', 'submissions', 'reviews')
       AND COLUMN_NAME IN ('created_at', 'uploaded_at', 'submitted_at', 'reviewed_at')
     ORDER BY TABLE_NAME, COLUMN_NAME`,
    { type: QueryTypes.SELECT }
  );

  for (const row of rows) {
    console.log(
      `  ${row.TABLE_NAME}.${row.COLUMN_NAME}  |  ${row.DATA_TYPE}  |  nullable: ${row.IS_NULLABLE}`
    );
  }

  console.log('\n=== Migration complete ===\n');
}

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
