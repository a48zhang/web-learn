import app from './app';
import { config } from './utils/config';
import { testDatabaseConnection, syncDatabase } from './utils/database';
import { initStorage } from './index';

const PORT = config.port;

async function startServer() {
  try {
    await initStorage();
    await testDatabaseConnection();
    await syncDatabase();

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
