import dotenv from 'dotenv';
import app from './app';
import { config } from './utils/config';

dotenv.config();

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});