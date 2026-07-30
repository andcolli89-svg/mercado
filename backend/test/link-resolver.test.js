import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fetchWithRedirects } from '../src/http/fetcher.js';
import { extractMercadoLivreId } from '../src/providers/mercadolivre/linkResolver.js';

async function withServer(handler, run) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('segue redirecionamentos 302 e 307', async () => {
  await withServer((request, response) => {
    if (request.url === '/short') {
      response.writeHead(302, { location: '/middle', 'set-cookie': 'session=abc; Path=/' });
      response.end();
      return;
    }
    if (request.url === '/middle') {
      assert.match(request.headers.cookie || '', /session=abc/);
      response.writeHead(307, { location: '/final' });
      response.end();
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<html>MLB4812130742</html>');
  }, async (base) => {
    const result = await fetchWithRedirects(`${base}/short`);
    assert.equal(result.response.status, 200);
    assert.equal(result.redirects.length, 2);
    assert.equal(result.finalUrl, `${base}/final`);
  });
});

test('extrai MLB de URLs comuns', () => {
  assert.deepEqual(extractMercadoLivreId('https://produto.mercadolivre.com.br/MLB-4812130742-x'), { id: 'MLB4812130742', type: 'item' });
  assert.deepEqual(extractMercadoLivreId('https://www.mercadolivre.com.br/p/MLB123456'), { id: 'MLB123456', type: 'catalog' });
});

test('não confunde página de catálogo com MLB de anúncio', () => {
  assert.deepEqual(
    extractMercadoLivreId('https://www.mercadolivre.com.br/kit-toalhas/p/MLB45678901'),
    { id: 'MLB45678901', type: 'catalog' },
  );
  assert.deepEqual(
    extractMercadoLivreId('https://produto.mercadolivre.com.br/MLB-4812130742-kit-toalhas'),
    { id: 'MLB4812130742', type: 'item' },
  );
});

test('campos explícitos diferenciam item e catálogo', () => {
  assert.deepEqual(extractMercadoLivreId('{"item_id":"MLB4812130742"}'), { id: 'MLB4812130742', type: 'item' });
  assert.deepEqual(extractMercadoLivreId('{"catalog_product_id":"MLB45678901"}'), { id: 'MLB45678901', type: 'catalog' });
});

import {
  extractMercadoLivreTarget,
  isSupportedMercadoLivreInputHostname,
  resolveMercadoLivreLink,
} from '../src/providers/mercadolivre/linkResolver.js';

test('habilita o redirecionador go.promozone.ai sem liberar domínios arbitrários', () => {
  assert.equal(isSupportedMercadoLivreInputHostname('go.promozone.ai'), true);
  assert.equal(isSupportedMercadoLivreInputHostname('meli.la'), true);
  assert.equal(isSupportedMercadoLivreInputHostname('example.com'), false);
});

test('extrai destino do Mercado Livre de página intermediária', () => {
  const html = '<script>window.location.href="https:\\/\\/meli.la\\/1MxHWTB"</script>';
  assert.equal(extractMercadoLivreTarget(html, 'https://go.promozone.ai/mercadolivre/KDJSNW'), 'https://meli.la/1MxHWTB');
});

test('resolve redirecionador Promozone, segue meli.la e preserva HTML com foto', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === 'https://go.promozone.ai/mercadolivre/KDJSNW') {
      return new Response('<html><script>location.replace("https://meli.la/1MxHWTB")</script></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    }
    if (url === 'https://meli.la/1MxHWTB') {
      return new Response('', {
        status: 302,
        headers: { location: 'https://produto.mercadolivre.com.br/MLB-1234567890-produto' },
      });
    }
    if (url === 'https://produto.mercadolivre.com.br/MLB-1234567890-produto') {
      return new Response(`
        <html><head>
          <link rel="canonical" href="https://produto.mercadolivre.com.br/MLB-1234567890-produto">
          <meta property="og:title" content="Produto de teste">
          <meta property="og:image" content="https://http2.mlstatic.com/teste.jpg">
        </head><body></body></html>
      `, { status: 200, headers: { 'content-type': 'text/html' } });
    }
    throw new Error(`URL inesperada: ${url}`);
  };

  const result = await resolveMercadoLivreLink('https://go.promozone.ai/mercadolivre/KDJSNW');
  assert.equal(result.id, 'MLB1234567890');
  assert.equal(result.type, 'item');
  assert.equal(result.finalUrl, 'https://produto.mercadolivre.com.br/MLB-1234567890-produto');
  assert.match(result.html, /https:\/\/http2\.mlstatic\.com\/teste\.jpg/);
  assert.equal(result.redirects.length, 2);
});
