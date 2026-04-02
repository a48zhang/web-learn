import app from './app';
import { config } from './utils/config';
import { testDatabaseConnection, syncDatabase } from './utils/database';
import { runMigration } from './migrations/run';

const PORT = config.port;

async function startServer() {
  try {
    await testDatabaseConnection();
    await syncDatabase();
    // Run schema migration after sync: renames old created_at columns to
    // uploaded_at / submitted_at / reviewed_at for Resource/Submission/Review.
    // Safe to call multiple times (idempotent).
    await runMigration();

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
