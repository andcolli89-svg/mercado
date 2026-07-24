import { createServer } from 'node:http';
import { createApp } from './src/app.js';
import { config } from './src/config.js';

const app = createApp();
const server = createServer(app);

server.listen(config.port, config.host, () => {
  console.log(`CbOfertas V6 API ${config.version} disponível em http://${config.host}:${config.port}`);
});

const shutdown = (signal) => {
  console.log(`${signal} recebido. Encerrando servidor...`);
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
