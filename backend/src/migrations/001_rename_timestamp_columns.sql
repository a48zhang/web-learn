-- Migration: cleanup legacy created_at columns after model sync
--
-- Intended use for the current project phase:
--   1. Run application sync first so the current models create:
--      - resources.uploaded_at
--      - submissions.submitted_at
--      - reviews.reviewed_at
--   2. Run this script to remove leftover legacy `created_at` columns if they exist.
--
-- This script is intentionally schema-only.
-- It does NOT copy legacy data and is safe to rerun on fresh databases.
--
-- How to run:
--   mysql -u root -p web_learn < src/migrations/001_rename_timestamp_columns.sql

-- ============================================================
-- resources table cleanup
-- ============================================================
SET @has_uploaded_at = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'resources'
      AND COLUMN_NAME = 'uploaded_at'
);
SET @sql = IF(@has_uploaded_at > 0, 'SELECT 1', 'SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT = \'resources.uploaded_at does not exist; run sync first\'');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_created_at = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'resources'
      AND COLUMN_NAME = 'created_at'
);
SET @sql = IF(@has_created_at > 0, 'ALTER TABLE resources DROP COLUMN created_at', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- submissions table cleanup
-- ============================================================
SET @has_submitted_at = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'submissions'
      AND COLUMN_NAME = 'submitted_at'
);
SET @sql = IF(@has_submitted_at > 0, 'SELECT 1', 'SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT = \'submissions.submitted_at does not exist; run sync first\'');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_created_at = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'submissions'
      AND COLUMN_NAME = 'created_at'
);
SET @sql = IF(@has_created_at > 0, 'ALTER TABLE submissions DROP COLUMN created_at', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- reviews table cleanup
-- ============================================================
SET @has_reviewed_at = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'reviews'
      AND COLUMN_NAME = 'reviewed_at'
);
SET @sql = IF(@has_reviewed_at > 0, 'SELECT 1', 'SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT = \'reviews.reviewed_at does not exist; run sync first\'');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_created_at = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'reviews'
      AND COLUMN_NAME = 'created_at'
);
SET @sql = IF(@has_created_at > 0, 'ALTER TABLE reviews DROP COLUMN created_at', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify final schema
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('resources', 'submissions', 'reviews')
  AND COLUMN_NAME IN ('created_at', 'uploaded_at', 'submitted_at', 'reviewed_at')
ORDER BY TABLE_NAME, COLUMN_NAME;
