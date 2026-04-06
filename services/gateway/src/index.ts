import dotenv from 'dotenv';

// Support explicit env file path; otherwise load from current working directory
if (process.env.DOTENV_CONFIG_PATH) {
  dotenv.config({ path: process.env.DOTENV_CONFIG_PATH });
} else {
  dotenv.config();
}

import createApp from './app';

const port = parseInt(process.env.GATEWAY_PORT || '3000', 10);
const app = createApp();

app.listen(port, () => {
  console.log(`[gateway] listening on port ${port}`);
});
