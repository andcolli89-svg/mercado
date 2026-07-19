const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 8099);
const ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'
};
const ALLOWED_HOST = /(^|\.)(meli\.la|mercadolivre\.com\.br|mercadolibre\.com|mercadolibre\.com\.br|mlstatic\.com)$/i;
const PAGE_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36',
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'pt-BR,pt;q=0.9,en;q=0.7',
  'cache-control': 'no-cache'
};

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...headers
  });
  res.end(body);
};

function decodeHtml(value = '') {
  return String(value)
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\\u002F/g, '/')
    .replace(/\\u0026/g, '&').replace(/\\u003D/g, '=');
}

function itemIdFrom(value) {
  const raw = String(value || '');
  // Não use decodeURIComponent na página HTML inteira: páginas do Mercado Livre
  // podem conter sinais de porcentagem que não formam uma sequência URI válida.
  const candidates = [raw];
  if (raw.length < 4096 && raw.includes('%')) {
    try { candidates.push(decodeURIComponent(raw)); } catch { /* mantém o valor original */ }
  }
  for (const candidate of candidates) {
    const match = candidate.match(/\bMLB-?(\d{6,})\b/i);
    if (match) return `MLB${match[1]}`.toUpperCase();
  }
  return '';
}

function cleanProductUrl(value) {
  return String(value || '')
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/^[<\[(]+|[>\]),.;]+$/g, '');
}

function numberBR(value) {
  let raw = String(value ?? '').trim().replace(/[^\d,.-]/g, '');
  if (!raw) return '';
  if (raw.includes(',') && raw.includes('.')) raw = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  else if (raw.includes(',')) raw = raw.replace(',', '.');
  const number = Number(raw);
  return Number.isFinite(number) ? number.toFixed(2).replace('.', ',') : '';
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return match ? decodeHtml(match[1]) : '';
}

function meta(html, name) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const key = attr(tag, 'property') || attr(tag, 'name') || attr(tag, 'itemprop');
    if (key && key.toLowerCase() === name.toLowerCase()) return attr(tag, 'content');
  }
  return '';
}

function capture(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return '';
}


function moneyFromBlock(block = '') {
  const fraction = capture(block, [/andes-money-amount__fraction[^>]*>\s*([\d.]+)\s*</i]);
  if (!fraction) return '';
  const cents = capture(block, [/andes-money-amount__cents[^>]*>\s*(\d{1,2})\s*</i]);
  const normalized = fraction.replace(/\./g, '') + (cents ? `,${cents.padStart(2, '0')}` : ',00');
  return numberBR(normalized);
}

function moneyFromAriaLabel(label = '') {
  const text = decodeHtml(label).replace(/\s+/g, ' ').trim();
  let match = text.match(/(?:R\$\s*)?([\d.]+)(?:\s*reais?)?(?:\s*(?:e|com)?\s*(\d{1,2})\s*centavos?)?/i);
  if (!match) return '';
  const integer = String(match[1] || '').replace(/\./g, '');
  const cents = String(match[2] || '00').padStart(2, '0');
  return numberBR(`${integer},${cents}`);
}

function visiblePrices(html = '') {
  const mainMatch = html.match(/<div\b[^>]*class=["'][^"']*ui-pdp-price__main-container[^"']*["'][^>]*>[\s\S]{0,7000}?<\/div>/i)
    || html.match(/<div\b[^>]*class=["'][^"']*ui-pdp-price__second-line[^"']*["'][^>]*>[\s\S]{0,5000}?<\/div>/i);
  const area = mainMatch ? mainMatch[0] : html;

  const amounts = [];
  const tagPattern = /<(?:span|div)\b[^>]*class=["'][^"']*andes-money-amount[^"']*["'][^>]*>[\s\S]{0,1200}?<\/(?:span|div)>/gi;
  for (const block of area.match(tagPattern) || []) {
    const open = block.match(/^<[^>]+>/)?.[0] || '';
    const aria = attr(open, 'aria-label');
    let value = aria ? moneyFromAriaLabel(aria) : '';
    if (!value) value = moneyFromBlock(block);
    if (!value) continue;
    const lower = block.toLowerCase();
    const previous = /previous|price-tag-previous|ui-pdp-price__original-value/.test(lower);
    amounts.push({ value, previous });
  }

  // Fallback específico para os rótulos acessíveis usados no preço principal.
  if (!amounts.length) {
    for (const tag of area.match(/<(?:span|div)\b[^>]*aria-label=["'][^"']+["'][^>]*>/gi) || []) {
      const value = moneyFromAriaLabel(attr(tag, 'aria-label'));
      if (!value) continue;
      const previous = /previous|original|antes|de\s+R\$/i.test(tag);
      amounts.push({ value, previous });
    }
  }

  const current = amounts.find(x => !x.previous)?.value || '';
  const old = amounts.find(x => x.previous)?.value || '';
  return { current, old, area };
}

function discountPercent(html = '') {
  const raw = capture(html, [
    /(?:discount|discount_percentage|discountPercent|off_percentage)[^\d]{0,30}(\d{1,2}(?:[.,]\d+)?)\s*%?/i,
    /(\d{1,2}(?:[.,]\d+)?)\s*%\s*OFF/i
  ]);
  if (!raw) return 0;
  const value = Number(String(raw).replace(',', '.'));
  return Number.isFinite(value) && value > 0 && value < 100 ? value : 0;
}

function calculateDiscountPrice(oldPrice, percent) {
  const old = Number(String(oldPrice || '').replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(old) || !percent) return '';
  return numberBR(old * (1 - percent / 100));
}


function installmentData(html = '', price = '', priceArea = '') {
  // Só considera parcelamento realmente visível na área principal de preço.
  // Não usa JSON interno nem textos espalhados pela página, pois eles podem
  // pertencer a outras formas de pagamento ou recomendações.
  const source = priceArea || '';
  if (!source) return { installments: '', installmentAmount: '', installmentInterest: '', installmentTotal: '' };

  const cleanText = decodeHtml(source)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const match = cleanText.match(/(?:ou\s+)?(\d{1,2})\s*x\s*(?:de\s*)?R\$\s*([\d.]+(?:,\d{2})?)\s*(sem\s+juros|com\s+juros)/i)
    || cleanText.match(/(?:em\s*)?(\d{1,2})\s*parcelas?\s*(?:de\s*)?R\$\s*([\d.]+(?:,\d{2})?)\s*(sem\s+juros|com\s+juros)/i);

  if (!match) return { installments: '', installmentAmount: '', installmentInterest: '', installmentTotal: '' };
  const installments = Number(match[1]);
  const installmentAmount = numberBR(match[2]);
  if (!Number.isInteger(installments) || installments < 2 || installments > 48 || !installmentAmount) {
    return { installments: '', installmentAmount: '', installmentInterest: '', installmentTotal: '' };
  }
  const installmentInterest = /sem\s+juros/i.test(match[3]) ? 'sem juros' : 'com juros';
  const unit = Number(installmentAmount.replace(/\./g, '').replace(',', '.'));
  return {
    installments: String(installments),
    installmentAmount,
    installmentInterest,
    installmentTotal: Number.isFinite(unit) ? numberBR(unit * installments) : ''
  };
}


function jsonLdProduct(html = '') {
  const scripts = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  const visit = (value) => {
    if (!value) return null;
    if (Array.isArray(value)) {
      for (const item of value) { const found = visit(item); if (found) return found; }
      return null;
    }
    if (typeof value !== 'object') return null;
    const type = String(value['@type'] || '').toLowerCase();
    if (type === 'product') return value;
    for (const child of Object.values(value)) { const found = visit(child); if (found) return found; }
    return null;
  };
  for (const script of scripts) {
    const raw = script.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    try {
      const product = visit(JSON.parse(decodeHtml(raw)));
      if (!product) continue;
      const offers = Array.isArray(product.offers) ? product.offers[0] : (product.offers || {});
      const seller = offers.seller || product.seller || {};
      return {
        title: product.name || '',
        image: Array.isArray(product.image) ? product.image[0] : (product.image?.url || product.image || ''),
        price: numberBR(offers.price || offers.lowPrice || ''),
        oldPrice: numberBR(offers.highPrice || ''),
        seller: seller.name || seller.alternateName || ''
      };
    } catch { /* JSON-LD inválido; continua nos demais */ }
  }
  return {};
}

function mainPriceData(html = '') {
  const lower = html.toLowerCase();
  const anchors = ['ui-pdp-price__main-container', 'ui-pdp-price__second-line', 'ui-pdp-price'];
  let start = -1;
  for (const anchor of anchors) {
    start = lower.indexOf(anchor);
    if (start >= 0) break;
  }
  const area = start >= 0 ? html.slice(Math.max(0, start - 800), start + 22000) : html.slice(0, 60000);
  const amounts = [];
  const tags = area.match(/<(?:span|div)\b[^>]*(?:andes-money-amount|aria-label=["'][^"']*(?:reais?|R\$))[^>]*>/gi) || [];
  for (const tag of tags) {
    const aria = attr(tag, 'aria-label');
    const value = aria ? moneyFromAriaLabel(aria) : '';
    if (!value) continue;
    const normalizedTag = tag.toLowerCase();
    const previous = /previous|original|price-tag-previous|ui-pdp-price__original-value/.test(normalizedTag);
    amounts.push({ value, previous });
  }
  const unique = [];
  for (const item of amounts) if (!unique.some(x => x.value === item.value && x.previous === item.previous)) unique.push(item);
  return {
    current: unique.find(x => !x.previous)?.value || '',
    old: unique.find(x => x.previous)?.value || '',
    all: unique.map(x => x.value),
    area
  };
}

function sellerIdFrom(html = '') {
  return capture(html, [
    /"seller_id"\s*:\s*"?(\d{4,})/i,
    /"sellerId"\s*:\s*"?(\d{4,})/i,
    /seller_id=(\d{4,})/i,
    /\/users\/(\d{4,})/i
  ]);
}

function pageProduct(html, permalink) {
  const structured = jsonLdProduct(html);
  const title = structured.title || meta(html, 'og:title') || meta(html, 'twitter:title') || capture(html, [/<title[^>]*>([^<]+)<\/title>/i]);
  const image = structured.image || meta(html, 'og:image') || meta(html, 'twitter:image') || capture(html, [/"secure_url"\s*:\s*"([^"]+)"/i, /"thumbnail"\s*:\s*"([^"]+)"/i]);

  // Prioriza o bloco principal e o JSON-LD do produto. Isso evita capturar preços
  // de parcelas, recomendações ou de outra variação escondida na página.
  const main = mainPriceData(html);
  const visible = visiblePrices(html);
  const rawPrice = main.current || structured.price || visible.current || capture(html, [
    /"priceToPay"\s*:\s*\{[^{}]{0,900}?"(?:amount|value|decimal_price|decimalPrice)"\s*:\s*"?([\d.,]+)/i,
    /"(?:price_to_pay|sale_price|discounted_price|bestPrice|currentPrice)"\s*:\s*(?:\{[^{}]{0,600}?"(?:amount|value|decimal_price|decimalPrice)"\s*:\s*)?"?([\d.,]+)/i,
    /"offers"\s*:\s*\{[^{}]{0,1200}?"price"\s*:\s*"?([\d.,]+)/i,
    /andes-money-amount[^>]*aria-label=["'][^"']*?([\d.]+(?:,[\d]{2})?)[^"']*["']/i,
    /andes-money-amount__fraction[^>]*>\s*([\d.]+)\s*</i
  ]) || meta(html, 'product:price:amount') || meta(html, 'price');

  const rawOld = main.old || structured.oldPrice || visible.old || capture(html, [
    /"(?:original_price|originalPrice|price_before_discount|previous_price|regular_price)"\s*:\s*(?:\{[^{}]{0,600}?"(?:amount|value|decimal_price|decimalPrice)"\s*:\s*)?"?([\d.,]+)/i,
    /andes-money-amount--previous[^>]*[\s\S]{0,500}?andes-money-amount__fraction[^>]*>\s*([\d.]+)\s*</i
  ]);

  const seller = structured.seller || capture(html, [
    /"seller"\s*:\s*\{[^{}]{0,1800}?"(?:nickname|name|seller_name|official_store_name)"\s*:\s*"([^"]+)"/i,
    /"(?:seller_name|sellerName|official_store_name|officialStoreName|nickname)"\s*:\s*"([^"]+)"/i,
    /Vendido\s+por[\s\S]{0,900}?<a[^>]*>([\s\S]{0,160}?)<\/a>/i,
    /Vendido\s+por[\s\S]{0,500}?ui-pdp-seller__link-trigger[^>]*>([\s\S]{0,160}?)<\/[^>]+>/i,
    /Vendido\s+por\s*(?:<[^>]+>\s*){0,4}([^<\n]{2,80})/i,
    /seller_id=\d+[^>]*>([^<]{2,80})</i
  ]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  let finalSeller = seller;
  if (!finalSeller) {
    const plain = decodeHtml(html).replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    finalSeller = capture(plain, [/Vendido\s+por\s+([A-Z0-9._ -]{2,60}?)(?=\s+(?:MercadoLíder|MercadoLider|\+?\d|Devolução|Compra Garantida|$))/i]).trim();
  }

  const full = /"logistic_type"\s*:\s*"fulfillment"|"logisticType"\s*:\s*"fulfillment"|mercado\s*envios\s*full|\bFULL\b/i.test(html);
  let price = numberBR(rawPrice);
  let oldPrice = numberBR(rawOld);
  const discount = discountPercent(html);
  const installment = installmentData(html, price, main.area || visible.area);

  // Quando a página informa o desconto, usa o maior valor visível plausível como
  // preço anterior e calcula o preço atual apenas se o atual não foi encontrado.
  const candidateNumbers = (main.all || []).map(value => Number(value.replace(/\./g, '').replace(',', '.'))).filter(Number.isFinite);
  const currentNumber = Number(String(price || '').replace(/\./g, '').replace(',', '.'));
  const plausibleOld = candidateNumbers.filter(value => !Number.isFinite(currentNumber) || value > currentNumber).sort((a, b) => b - a)[0];
  if (!oldPrice && Number.isFinite(plausibleOld)) oldPrice = numberBR(plausibleOld);
  if ((!price || (oldPrice && price === oldPrice)) && oldPrice && discount) price = calculateDiscountPrice(oldPrice, discount);
  if (price && oldPrice && price === oldPrice) oldPrice = '';
  const currentN = Number(String(price || '').replace(/\./g, '').replace(',', '.'));
  const oldN = Number(String(oldPrice || '').replace(/\./g, '').replace(',', '.'));
  if (Number.isFinite(currentN) && Number.isFinite(oldN) && (oldN <= currentN || oldN > currentN * 10)) oldPrice = '';
  if (!title || (!image && !price)) return null;
  return { title: decodeHtml(title).replace(/\s*\|\s*Mercado Livre.*$/i, '').trim(), price, oldPrice, seller: finalSeller, full, image, permalink, ...installment };
}

async function request(url, options = {}) {
  return fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(18000), ...options });
}

async function resolveLanding(url) {
  let response = await request(url, { headers: PAGE_HEADERS });
  if (!response.ok) throw new Error(`O Mercado Livre respondeu com o código ${response.status}. Abra o anúncio no navegador, use Compartilhar > Copiar link e tente novamente.`);
  return response;
}

async function fetchSellerName(sellerId) {
  if (!sellerId) return '';
  try {
    const response = await request(`https://api.mercadolibre.com/users/${sellerId}`, {
      headers: { 'user-agent': PAGE_HEADERS['user-agent'], accept: 'application/json' }
    });
    if (!response.ok) return '';
    const seller = await response.json();
    return seller.nickname || seller.first_name || '';
  } catch { return ''; }
}

async function fetchApiItem(id) {
  const response = await request(`https://api.mercadolibre.com/items/${id}`, {
    headers: { 'user-agent': PAGE_HEADERS['user-agent'], accept: 'application/json' }
  });
  if (!response.ok) return null;
  const item = await response.json();
  const price = numberBR(item.price);
  if (!item.title || !price) return null;
  const seller = item.seller?.nickname || await fetchSellerName(item.seller_id || item.seller?.id);
  const logisticType = item.shipping?.logistic_type || item.shipping?.logisticType || '';
  return {
    id: item.id,
    title: item.title || '',
    price,
    oldPrice: numberBR(item.original_price),
    seller,
    full: logisticType === 'fulfillment' || (item.tags || []).some(tag => /fulfillment|full/i.test(tag)),
    installments: '',
    installmentAmount: '',
    installmentInterest: '',
    image: item.pictures?.[0]?.secure_url || item.pictures?.[0]?.url || item.secure_thumbnail || item.thumbnail || '',
    permalink: item.permalink || ''
  };
}

async function fetchItem(url) {
  const cleanedUrl = cleanProductUrl(url);
  let input;
  try {
    input = new URL(cleanedUrl);
  } catch {
    throw new Error('O link está incompleto ou inválido. No Mercado Livre, toque em Compartilhar > Copiar link e cole novamente.');
  }
  if (!['http:', 'https:'].includes(input.protocol)) throw new Error('Informe um link http ou https.');
  if (!ALLOWED_HOST.test(input.hostname)) throw new Error('Use um link do Mercado Livre ou meli.la.');

  let id = itemIdFrom(input.href);
  const landing = await resolveLanding(input.href);
  const finalUrl = landing.url;
  const html = await landing.text();
  id = itemIdFrom(finalUrl) || itemIdFrom(html);

  const fromPage = pageProduct(html, finalUrl);
  if (fromPage && !fromPage.seller) fromPage.seller = await fetchSellerName(sellerIdFrom(html));
  if (id) {
    const apiItem = await fetchApiItem(id);
    if (apiItem) {
      // Dados visíveis na página prevalecem para preço promocional, vendedor e FULL.
      return {
        ...apiItem,
        title: fromPage?.title || apiItem.title,
        price: fromPage?.price || apiItem.price,
        oldPrice: fromPage?.oldPrice || apiItem.oldPrice,
        seller: fromPage?.seller || apiItem.seller,
        full: Boolean(fromPage?.full || apiItem.full),
        installments: fromPage?.installments || apiItem.installments || '',
        installmentAmount: fromPage?.installmentAmount || apiItem.installmentAmount || '',
        installmentInterest: fromPage?.installmentInterest || apiItem.installmentInterest || '',
        image: fromPage?.image || apiItem.image,
        permalink: finalUrl || apiItem.permalink
      };
    }
  }

  if (fromPage) return fromPage;
  throw new Error('O anúncio abriu, mas o Mercado Livre não liberou os dados automaticamente. Preencha os campos manualmente e mantenha o link colado.');
}

async function proxyImage(source, res) {
  const imageUrl = new URL(source);
  if (!['http:', 'https:'].includes(imageUrl.protocol) || !ALLOWED_HOST.test(imageUrl.hostname)) {
    return send(res, 403, 'Imagem não permitida');
  }
  const response = await request(imageUrl.href, { headers: { 'user-agent': PAGE_HEADERS['user-agent'], accept: 'image/avif,image/webp,image/*,*/*;q=0.8' } });
  if (!response.ok) return send(res, response.status, 'Imagem indisponível');
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await response.arrayBuffer());
  return send(res, 200, buffer, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'OPTIONS') return send(res, 204, '');
    if (url.pathname === '/') {
      return send(res, 200, JSON.stringify({
        status: 'ok',
        message: 'Servidor PromoZap funcionando'
      }), { 'Content-Type': 'application/json; charset=utf-8' });
    }
    if (url.pathname === '/api/product') {
      const source = cleanProductUrl(url.searchParams.get('url'));
      if (!source) return send(res, 400, JSON.stringify({ error: 'Informe o link do produto.' }), { 'Content-Type': 'application/json; charset=utf-8' });
      const product = await fetchItem(source);
      if (product.image) product.imageProxy = `/api/image?url=${encodeURIComponent(product.image)}`;
      return send(res, 200, JSON.stringify(product), { 'Content-Type': 'application/json; charset=utf-8' });
    }
    if (url.pathname === '/api/image') {
      const source = url.searchParams.get('url');
      if (!source) return send(res, 400, 'Informe a imagem.');
      return proxyImage(source, res);
    }

    const relative = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = path.resolve(ROOT, `.${relative}`);
    if (!file.startsWith(ROOT + path.sep)) return send(res, 403, 'Acesso negado');
    fs.readFile(file, (error, data) => error
      ? send(res, 404, 'Arquivo não encontrado')
      : send(res, 200, data, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'public, max-age=300' }));
  } catch (error) {
    console.error(error);
    send(res, 422, JSON.stringify({ error: error.message || 'Não foi possível consultar o produto.' }), { 'Content-Type': 'application/json; charset=utf-8' });
  }
}).listen(PORT, '0.0.0.0', () => console.log(`PromoZap ML disponível em http://localhost:${PORT}`));
