
const apiServerInput = document.querySelector('#apiServer');
const serverStatus = document.querySelector('#serverStatus');
function normalizeServerUrl(value = '') { return String(value).trim().replace(/\/+$/, ''); }
function getApiBase() { return normalizeServerUrl(localStorage.getItem('promozapApiServer') || ''); }
function updateServerUi() { if (apiServerInput) apiServerInput.value = getApiBase(); }
function setServerStatus(text, state = '') { if (serverStatus) { serverStatus.textContent = text; serverStatus.className = `fetch-status ${state}`; } }
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const list = $('#linksList');
const tpl = $('#promoTemplate');
let style = 'comedia';
let deferredPrompt = null;

const jokes = {
  comedia: [
    'Nesse preço, até quem não precisava já colocou no carrinho! 😂',
    'Se continuar assim, o cartão vai pedir férias! 😂',
    'Barato desse jeito é quase fofoca: tem que compartilhar! 🤣',
    'Até o vizinho que não compra nada vai querer! 😅'
  ],
  urgente: [
    'Corre porque esse preço pode sumir! 🔥',
    'Oferta voando: aproveite antes que acabe! 🚨',
    'Preço de hoje, arrependimento de amanhã se perder! ⚠️'
  ],
  direto: [
    'Oferta encontrada com ótimo preço. ⚡',
    'Economia de verdade, sem enrolação. ✅',
    'Preço baixo para aproveitar agora. 💥'
  ],
  familia: [
    'Uma economia que cabe no orçamento da família! 👨‍👩‍👧',
    'Promoção boa para cuidar da casa e do bolso! 💛',
    'A família agradece e o bolso também! 😊'
  ]
};

const productJokes = [
  { test: /air\s*fryer|fritadeira/i, lines: ['Essa fritadeira deixa tudo crocante, menos o seu bolso! 😂', 'Batata sequinha e preço que não engordou! 🍟🤣', 'A dieta começa amanhã; essa Air Fryer entra no carrinho hoje! 😅'] },
  { test: /celular|smartphone|iphone|galaxy|motorola|xiaomi/i, lines: ['Celular novo para tirar foto até do boleto pago! 📱😂', 'A câmera é boa, mas o preço é ainda mais bonito! 🤳🔥', 'Seu celular velho já está fingindo que não viu esta promoção! 😅'] },
  { test: /tv|televis[aã]o|smart\s*tv/i, lines: ['Cinema em casa e pipoca sem preço de shopping! 📺🍿', 'Essa TV é tão grande que a promoção aparece em tela cheia! 😂'] },
  { test: /aspirador|rob[oô]\s*aspirador/i, lines: ['Ele limpa a casa enquanto você fiscaliza do sofá! 😂', 'Sujeira saindo e economia entrando! 🧹🔥'] },
  { test: /cafeteira|caf[eé]/i, lines: ['Café forte e preço fraquinho: combinação perfeita! ☕😂', 'Acorda até o sono e não assusta o bolso! ☕🔥'] },
  { test: /panela|cozinha|liquidificador|batedeira/i, lines: ['A receita pode dar errado, mas essa compra não! 😂', 'Preço de chef, gasto de aprendiz! 👨‍🍳🔥'] },
  { test: /t[eê]nis|sapato|sand[aá]lia|chinelo/i, lines: ['Seu pé já aprovou, falta só o carrinho confirmar! 👟😂', 'Confortável no pé e mais confortável ainda no bolso!'] },
  { test: /camisa|camiseta|vestido|cal[cç]a|roupa|jaqueta/i, lines: ['O guarda-roupa pediu e o bolso deixou! 👕😂', 'Look novo sem deixar a conta fora de moda! 🔥'] },
  { test: /furadeira|parafusadeira|serra|ferramenta/i, lines: ['Agora não tem desculpa para aquele reparo pendente! 🔧😂', 'Ferramenta forte, preço que não aperta! 🛠️🔥'] },
  { test: /perfume|col[oô]nia/i, lines: ['Cheiro de riqueza com preço de promoção! 😎✨', 'Vai deixar saudade até em quem passou longe! 😂'] },
  { test: /fralda|beb[eê]|infantil/i, lines: ['O bebê fica sequinho e o orçamento também! 👶😂', 'Promoção que os pais agradecem de verdade! 💛'] },
  { test: /meia|kit.*meia/i, lines: ['Meia boa é assim: some na máquina, mas aparece na promoção! 🧦😂', 'Seis pares para perder só três na lavanderia! 🤣'] }
];

function jokeForProduct(title = '') {
  const group = productJokes.find(item => item.test.test(title));
  return rand(group?.lines || jokes[style]);
}

const rand = (items) => items[Math.floor(Math.random() * items.length)];
const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function normalizeMoney(value) {
  let raw = String(value || '').trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!raw) return '';
  if (raw.includes(',') && raw.includes('.')) {
    raw = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  } else if (raw.includes(',')) raw = raw.replace(',', '.');
  const number = Number(raw.replace(/[^\d.-]/g, ''));
  return Number.isFinite(number) ? number.toFixed(2).replace('.', ',') : String(value).trim();
}

const money = (value) => {
  const normalized = normalizeMoney(value);
  return normalized ? `R$ ${normalized}` : '';
};

function renumber() {
  const cards = $$('.promo-card');
  cards.forEach((card, index) => $('.promo-number', card).textContent = `Promoção ${index + 1}`);
  $('#countLabel').textContent = `${cards.length} produto${cards.length === 1 ? '' : 's'}`;
}

function setStatus(card, message, state = '') {
  const element = $('.fetch-status', card);
  element.textContent = message;
  element.className = `fetch-status ${state}`;
}

function setProductImage(card, url) {
  const image = $('.p-preview', card);
  if (!url) {
    image.removeAttribute('src');
    return;
  }
  image.src = url;
  image.onerror = () => setStatus(card, 'Os dados foram carregados, mas a imagem foi bloqueada. Você pode escolher uma imagem da galeria.', 'error');
}

async function fetchProduct(card) {
  const link = $('.p-link', card).value.trim();
  if (!link) return setStatus(card, 'Cole o link do anúncio primeiro.', 'error');
  const apiBase = getApiBase();
  if (!apiBase) return setStatus(card, 'Informe e salve o endereço do servidor de consulta no início da tela.', 'error');

  const button = $('.fetch-product', card);
  button.disabled = true;
  button.textContent = 'Buscando...';
  setStatus(card, 'Abrindo o link e consultando o Mercado Livre...');

  try {
    const response = await fetch(`${apiBase}/api/product?url=${encodeURIComponent(link)}`, { cache: 'no-store' });
    const product = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(product.error || 'Não foi possível buscar o produto.');

    const set = (selector, value) => { $(selector, card).value = value || ''; };
    set('.p-title', product.title);
    set('.p-old', product.oldPrice);
    set('.p-new', product.price);
    set('.p-store', product.seller || product.store);
    set('.p-installments', product.installments);
    set('.p-installment-value', product.installmentAmount);
    set('.p-installment-interest', product.installmentInterest);
    $('.p-full', card).checked = Boolean(product.full);
    if (product.image) {
      const proxyUrl = product.imageProxy
        ? (product.imageProxy.startsWith('/') ? `${apiBase}${product.imageProxy}` : product.imageProxy)
        : product.image;
      setProductImage(card, proxyUrl);
    }
    if (!$('.p-joke', card).value) $('.p-joke', card).value = jokeForProduct(product.title || '');

    setStatus(card, 'Produto preenchido. Confira preço, título e cupom antes de publicar.', 'success');
    generate();
  } catch (error) {
    const message = error instanceof TypeError
      ? 'Não consegui acessar o servidor. Abra o aplicativo pelo endereço publicado, e não diretamente pelo arquivo index.html.'
      : (error.message || 'A busca falhou. Você ainda pode preencher os campos manualmente.');
    setStatus(card, message, 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Buscar produto';
  }
}

function addPromo(data = {}, autoFetch = false) {
  const node = tpl.content.cloneNode(true);
  const card = $('.promo-card', node);
  list.appendChild(node);

  const set = (selector, value) => { $(selector, card).value = value || ''; };
  set('.p-link', data.link);
  set('.p-title', data.title);
  set('.p-old', data.old);
  set('.p-new', data.new);
  set('.p-store', data.store);
  set('.p-installments', data.installments);
  set('.p-installment-value', data.installmentValue);
  set('.p-installment-interest', data.installmentInterest);
  $('.p-full', card).checked = Boolean(data.full);
  set('.p-joke', data.joke);
  if (data.image) setProductImage(card, data.image);

  $('.remove', card).onclick = () => {
    card.remove();
    if (!$$('.promo-card').length) addPromo();
    renumber();
    generate();
  };
  $('.open-link', card).onclick = () => {
    const url = $('.p-link', card).value.trim();
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };
  $('.fetch-product', card).onclick = () => fetchProduct(card);
  $('.joke-btn', card).onclick = () => {
    $('.p-joke', card).value = jokeForProduct($('.p-title', card).value.trim());
    generate();
  };
  $('.p-file', card).onchange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setProductImage(card, reader.result);
      generate();
    };
    reader.readAsDataURL(file);
  };
  $('.p-link', card).addEventListener('paste', () => setTimeout(() => {
    if ($('.p-link', card).value.trim()) fetchProduct(card);
  }, 120));
  $$('input', card).forEach(input => input.addEventListener('input', generate));
  $('select.p-installment-interest', card).addEventListener('change', generate);
  $('.p-full', card).addEventListener('change', generate);

  renumber();
  if (autoFetch && data.link) setTimeout(() => fetchProduct(card), 80);
  return card;
}

function data() {
  return $$('.promo-card').map(card => ({
    link: $('.p-link', card).value.trim(),
    title: $('.p-title', card).value.trim(),
    old: $('.p-old', card).value.trim(),
    new: $('.p-new', card).value.trim(),
    store: $('.p-store', card).value.trim(),
    installments: $('.p-installments', card).value.trim(),
    installmentValue: $('.p-installment-value', card).value.trim(),
    installmentInterest: $('.p-installment-interest', card).value,
    full: $('.p-full', card).checked,
    joke: $('.p-joke', card).value.trim() || jokeForProduct($('.p-title', card).value.trim()),
    image: $('.p-preview', card).getAttribute('src') || ''
  })).filter(item => item.link || item.title || item.new);
}

function buildText(items) {
  const coupon = $('#globalCoupons').value.trim();
  return items.map(item => {
    let text = `🛍️ *${item.title || 'Oferta imperdível'}*\n\n_${item.joke}_\n\n`;
    if (item.old) text += `De ~${money(item.old)}~\n`;
    if (item.new) text += `Por *${money(item.new)}* 🔥\n`;
    if (coupon) text += `\n🎟️ Cupom: *${coupon}*\n`;
    if (item.link) text += `\n👉 _Pegar promoção:_\n*${item.link}*\n`;
    if (item.store) text += `\n🏪 Vendido por: *${item.store}*\n`;
    if (item.full) text += `🚚 *Entrega FULL* ⚡\n`;
    return text;
  }).join('\n------------------------------\n\n') + '\n⚠️ Preços e disponibilidade podem mudar a qualquer momento.';
}

function generate() {
  const items = data();
  const preview = $('#preview');
  if (!items.length) {
    preview.innerHTML = '<div class="empty">Adicione os dados de pelo menos uma promoção.</div>';
    $('#finalText').value = '';
    return;
  }
  const coupon = $('#globalCoupons').value.trim();
  preview.innerHTML = items.map(item => `<div class="preview-item">
    ${item.image ? `<img src="${esc(item.image)}" alt="Produto" loading="lazy">` : ''}
    <h3>🛍️ ${esc(item.title || 'Oferta imperdível')}</h3>
    <p><i>${esc(item.joke)}</i></p>
    ${item.old ? `<div>De <span class="old">${esc(money(item.old))}</span></div>` : ''}
    ${item.new ? `<div>Por <span class="new">${esc(money(item.new))}</span> 🔥</div>` : ''}
    ${item.installments && item.installmentValue ? `<div class="installment-line">💳 Em <b>${esc(item.installments)}x de ${esc(money(item.installmentValue))}</b>${item.installmentInterest ? ` <b>${esc(item.installmentInterest)}</b>` : ''}</div>` : ''}
    ${coupon ? `<p>🎟️ Cupom: <span class="coupon">${esc(coupon)}</span></p>` : ''}
    ${item.link ? `<p class="preview-link">👉 <i>Pegar promoção:</i><br><b>${esc(item.link)}</b></p>` : ''}
    ${item.store ? `<p>🏪 Vendido por: <b>${esc(item.store)}</b></p>` : ''}
    ${item.full ? `<p class="full-badge">🚚 <b>Entrega FULL</b> ⚡</p>` : ''}
  </div>`).join('');
  $('#finalText').value = buildText(items);
}

async function imageToFile(src, index) {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    const type = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
    const extension = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
    return new File([blob], `promocao-${index + 1}.${extension}`, { type });
  } catch {
    return null;
  }
}

$('#addLinkBtn').onclick = () => addPromo();
$('#generateAllBtn').onclick = generate;
const couponField = $('#globalCoupons');
couponField.value = localStorage.getItem('promozap-global-coupons') || couponField.value;
couponField.addEventListener('input', () => {
  localStorage.setItem('promozap-global-coupons', couponField.value);
  generate();
});

$$('.chip').forEach(button => button.onclick = () => {
  $$('.chip').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  style = button.dataset.style;
});

$('#pasteLinksBtn').onclick = () => {
  const raw = prompt('Cole os links, um por linha:');
  if (!raw) return;
  const links = [...new Set(raw.split(/\s+/).map(value => value.trim()).filter(value => /^https?:\/\//i.test(value)))];
  if (!links.length) return alert('Nenhum link válido foi encontrado.');
  if ($$('.promo-card').length === 1 && !data().length) list.innerHTML = '';
  links.forEach(link => addPromo({ link }, true));
  renumber();
};

$('#copyBtn').onclick = async () => {
  generate();
  const text = $('#finalText').value;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    $('#finalText').select();
    document.execCommand('copy');
  }
  alert('Texto copiado!');
};

$('#whatsappBtn').onclick = () => {
  generate();
  const text = $('#finalText').value;
  location.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
};

$('#shareBtn').onclick = async () => {
  generate();
  const items = data();
  const files = (await Promise.all(items.map((item, index) => item.image ? imageToFile(item.image, index) : null))).filter(Boolean);
  try {
    if (!navigator.share) throw new Error('unsupported');
    const payload = { title: 'PromoZap ML', text: $('#finalText').value };
    if (files.length && navigator.canShare?.({ files })) payload.files = files;
    await navigator.share(payload);
  } catch (error) {
    if (error.name !== 'AbortError') alert('O celular não permitiu compartilhar imagem e texto juntos. O texto pode ser enviado pelo botão do WhatsApp e a imagem separadamente.');
  }
};

$('#saveBtn').onclick = () => {
  generate();
  const history = JSON.parse(localStorage.getItem('ofertasHistory') || '[]');
  history.unshift({ date: new Date().toLocaleString('pt-BR'), text: $('#finalText').value });
  localStorage.setItem('ofertasHistory', JSON.stringify(history.slice(0, 15)));
  renderHistory();
  alert('Salvo no histórico!');
};

function renderHistory() {
  const history = JSON.parse(localStorage.getItem('ofertasHistory') || '[]');
  $('#history').innerHTML = history.length ? history.map((item, index) => `<div class="history-item">
    <div><b>Postagem com promoções</b><br><small>${esc(item.date)}</small></div>
    <button data-i="${index}">Abrir</button>
  </div>`).join('') : '<div class="empty">Nenhuma postagem salva.</div>';
  $$('#history button').forEach(button => button.onclick = () => {
    $('#finalText').value = history[Number(button.dataset.i)].text;
    $('#finalText').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredPrompt = event;
  $('#installBtn').classList.remove('hidden');
});
$('#installBtn').onclick = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $('#installBtn').classList.add('hidden');
};

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(console.warn));
}

addPromo();
renderHistory();


document.addEventListener('DOMContentLoaded', () => {
  updateServerUi();
  document.querySelector('#saveServerBtn')?.addEventListener('click', () => {
    const value = normalizeServerUrl(apiServerInput?.value);
    if (!/^https?:\/\//i.test(value)) return setServerStatus('Digite um endereço começando com http:// ou https://', 'error');
    localStorage.setItem('promozapApiServer', value);
    setServerStatus('Servidor salvo neste aparelho.', 'success');
  });
  document.querySelector('#testServerBtn')?.addEventListener('click', async () => {
    const value = normalizeServerUrl(apiServerInput?.value);
    if (!value) return setServerStatus('Informe o endereço do servidor.', 'error');
    setServerStatus('Testando conexão...');
    try {
      const r = await fetch(`${value}/`, { cache: 'no-store' });
      if (!r.ok) throw new Error();
      localStorage.setItem('promozapApiServer', value);
      setServerStatus('Conexão funcionando.', 'success');
    } catch { setServerStatus('Não foi possível acessar esse servidor.', 'error'); }
  });
});
