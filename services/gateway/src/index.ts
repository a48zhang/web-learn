import dotenv from 'dotenv';

if (process.env.DOTENV_CONFIG_PATH) {
  dotenv.config({ path: process.env.DOTENV_CONFIG_PATH });
} else {
  dotenv.config();
}

import createApp from './app';
import { waitForRegistry } from './serviceDiscovery';

const port = parseInt(process.env.GATEWAY_PORT || '3000', 10);

(async () => {
  try {
    await waitForRegistry();
  } catch (err) {
    console.error('[gateway] Failed to connect to service registry, exiting');
    process.exit(1);
  }

  const app = createApp();
  app.listen(port, () => {
    console.log(`[gateway] listening on port ${port}`);
  });
})();
