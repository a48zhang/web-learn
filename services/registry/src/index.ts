import dotenv from 'dotenv';

if (process.env.DOTENV_CONFIG_PATH) {
  dotenv.config({ path: process.env.DOTENV_CONFIG_PATH });
} else {
  dotenv.config();
}

import app from './app';

const port = parseInt(process.env.REGISTRY_PORT || '3010', 10);

app.listen(port, () => {
  console.log(`[registry] listening on port ${port}`);
});
