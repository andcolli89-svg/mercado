'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../src/app');

async function withServer(callback) {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    return await callback(server.address().port);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('health informa versão e recursos da V4.0', async () => {
  await withServer(async port => {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.version, '4.0.0');
    assert.ok(data.features.includes('favoritos'));
  });
});

test('rotas desconhecidas retornam 404', async () => {
  await withServer(async port => {
    const response = await fetch(`http://127.0.0.1:${port}/nao-existe`);
    assert.equal(response.status, 404);
  });
});
