import { createApp } from './app.js';
import { getConfig } from './config.js';

const config = getConfig();
const app = await createApp({ config });

app.listen({ port: config.port, host: '0.0.0.0' }).catch((error) => {
  console.error(error);
  process.exit(1);
});

