import app from './app';
import { config } from './utils/config';
import { sequelize } from './utils/database';

(async () => {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  console.log('[auth] database synced');
  app.listen(config.port, () => {
    console.log(`[auth] listening on port ${config.port}`);
  });
})();
