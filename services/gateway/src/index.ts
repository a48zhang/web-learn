import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import createApp from './app';

const port = parseInt(process.env.GATEWAY_PORT || '3000', 10);
const app = createApp();

app.listen(port, () => {
  console.log(`[gateway] listening on port ${port}`);
});
