import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../src/app.js';

async function withApp(run) {
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('health informa versão V6', async () => {
  await withApp(async (base) => {
    const response = await fetch(`${base}/health`);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.match(payload.version, /^6\.0\.0/);
  });
});

test('resolve exige URL', async () => {
  await withApp(async (base) => {
    const response = await fetch(`${base}/v1/products/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.equal(payload.error.code, 'VALIDATION_ERROR');
  });
});


test('URL inválida retorna erro de validação, não erro interno', async () => {
  await withApp(async (base) => {
    const response = await fetch(`${base}/v1/products/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'nao-e-url' }),
    });
    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.equal(payload.error.code, 'VALIDATION_ERROR');
  });
});
