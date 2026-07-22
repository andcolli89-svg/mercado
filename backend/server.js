'use strict';

const { PORT } = require('./src/config');
const { createServer } = require('./src/app');
const { startRadarScheduler } = require('./src/services/radarService');

const server = createServer();
startRadarScheduler();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CbOfertas V4.0 disponível na porta ${PORT}`);
});
