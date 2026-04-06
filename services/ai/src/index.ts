import app from './app';
import { config } from './utils/config';
import { sequelize } from './utils/database';

(async () => {
  await sequelize.authenticate();
  console.log('[ai] database connected');
  app.listen(config.port, () => {
    console.log(`[ai] listening on port ${config.port}`);
  });
})();
