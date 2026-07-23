const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  style: 'divertido',
  image: '',
  full: false,
  previewIndex: 0,
  editingId: null,
  editorCollapsed: false,
  editingCouponId: null,
  lastAutoCouponCodes: [],
  radarItems: [],
  radarLoading: false,
  affiliateLinkReceived: false,
  receivedAffiliateLink: ''
};

const el = {
  apiServer: $('#apiServer'),
  serverStatus: $('#serverStatus'),
  topActionStatus: $('#topActionStatus'),
  editorArea: $('#editorArea'),
  editorCollapsedNotice: $('#editorCollapsedNotice'),
  newItemBtn: $('#newItemBtn'),
  fetchBtn: $('#fetchBtn'),
  saveItemBtn: $('#saveItemBtn'),
  clearBtn: $('#clearBtn'),
  link: $('#productLink'),
  title: $('#productTitle'),
  image: $('#productImage'),
  old: $('#oldPrice'),
  offer: $('#offerPrice'),
  installmentQty: $('#installmentQty'),
  installmentValue: $('#installmentValue'),
  installmentNoInterest: $('#installmentNoInterest'),
  interestLabel: $('#interestLabel'),
  installmentPreview: $('#installmentPreview'),
  freight: $('#freight'),
  coupon: $('#coupon'),
  seller: $('#seller'),
  clearCouponBtn: $('#clearCouponBtn'),
  offerCouponQuickList: $('#offerCouponQuickList'),
  openCouponManagerBtn: $('#openCouponManagerBtn'),
  couponManagerCard: $('#couponManagerCard'),
  couponCodeInput: $('#couponCodeInput'),
  couponCategoryInput: $('#couponCategoryInput'),
  couponTargetInput: $('#couponTargetInput'),
  couponTargetLabel: $('#couponTargetLabel'),
  couponMinPriceInput: $('#couponMinPriceInput'),
  couponMinDiscountInput: $('#couponMinDiscountInput'),
  couponExpiresInput: $('#couponExpiresInput'),
  couponPriorityInput: $('#couponPriorityInput'),
  saveCouponCodeBtn: $('#saveCouponCodeBtn'),
  cancelCouponEditBtn: $('#cancelCouponEditBtn'),
  couponSavedList: $('#couponSavedList'),
  couponLibraryCount: $('#couponLibraryCount'),
  couponLibraryStatus: $('#couponLibraryStatus'),
  activeCouponPreview: $('#activeCouponPreview'),
  applyCouponsToOfferBtn: $('#applyCouponsToOfferBtn'),
  sellerSuggestions: $('#sellerSuggestions'),
  phrase: $('#smartPhrase'),
  fetchStatus: $('#fetchStatus'),
  affiliateLinkBtn: $('#affiliateLinkBtn'),
  affiliateStatus: $('#affiliateStatus'),
  preview: $('#preview'),
  finalText: $('#finalText'),
  fullBadge: $('#fullBadge'),
  discountBadge: $('#discountBadge'),
  productFoundBadge: $('#productFoundBadge'),
  savingsValue: $('#savingsValue'),
  charCounter: $('#charCounter'),
  publicationQueue: $('#publicationQueue'),
  publicationCount: $('#publicationCount'),
  publicationStatus: $('#publicationStatus'),
  sendSavedBtn: $('#sendSavedBtn'),
  scheduleSavedBtn: $('#scheduleSavedBtn'),
  clearSavedBtn: $('#clearSavedBtn'),
  couponBlastCard: $('#couponBlastCard'),
  couponBlastImage: $('#couponBlastImage'),
  couponBlastImageFile: $('#couponBlastImageFile'),
  couponGroupName: $('#couponGroupName'),
  couponPageLink: $('#couponPageLink'),
  couponBlastText: $('#couponBlastText'),
  couponBlastStatus: $('#couponBlastStatus'),
  couponImagePlaceholder: $('#couponImagePlaceholder'),
  offersToolbar: $('#offersToolbar'),
  offersPage: $('#offersPage'),
  radarPage: $('#radarPage'),
  historyPage: $('#historyPage'),
  favoritesPage: $('#favoritesPage'),
  couponsPage: $('#couponsPage'),
  settingsPage: $('#settingsPage'),
  showOffersPageBtn: $('#showOffersPageBtn'),
  showRadarPageBtn: $('#showRadarPageBtn'),
  showHistoryPageBtn: $('#showHistoryPageBtn'),
  showFavoritesPageBtn: $('#showFavoritesPageBtn'),
  showCouponsPageBtn: $('#showCouponsPageBtn'),
  showSettingsPageBtn: $('#showSettingsPageBtn'),
  refreshRadarBtn: $('#refreshRadarBtn'),
  searchRadarBtn: $('#searchRadarBtn'),
  radarQuery: $('#radarQuery'),
  radarCategory: $('#radarCategory'),
  radarMinDiscount: $('#radarMinDiscount'),
  radarMaxPrice: $('#radarMaxPrice'),
  radarOnlyFull: $('#radarOnlyFull'),
  radarHideUsed: $('#radarHideUsed'),
  radarAutoOpen: $('#radarAutoOpen'),
  settingsRadarAuto: $('#settingsRadarAuto'),
  radarStatus: $('#radarStatus'),
  radarResults: $('#radarResults'),
  radarEmpty: $('#radarEmpty'),
  radarFoundCount: $('#radarFoundCount'),
  radarNewCount: $('#radarNewCount'),
  radarBestDiscount: $('#radarBestDiscount'),
  radarLastUpdate: $('#radarLastUpdate'),
  restoreHiddenRadarBtn: $('#restoreHiddenRadarBtn'),
  favoriteCurrentBtn: $('#favoriteCurrentBtn'),
  favoritesSearch: $('#favoritesSearch'),
  favoritesCount: $('#favoritesCount'),
  favoritesList: $('#favoritesList'),
  favoritesEmpty: $('#favoritesEmpty'),
  favoritesStatus: $('#favoritesStatus'),
  clearFavoritesBtn: $('#clearFavoritesBtn')
};

const funnyPhrases = {
  calcados: [
    'Esse calçado é tão bonito que até o chinelo velho começou a atualizar o currículo! 👟🤣',
    'Seu pé já colocou no carrinho. Agora só falta você parar de fingir que está pensando! 😂',
    'Passo firme, preço leve e o boleto andando de fininho! 👟😄',
    'Cuidado: depois desse tênis, até ir na padaria vira desfile! 🥖👟🤣',
    'O sapato antigo viu esta oferta e pediu aposentadoria por tempo de serviço! 😂',
    'Confortável no pé e educado com o bolso — raridade maior que meia sem par! 🧦🤣',
    'Esse preço está tão baixo que o cadarço precisou se abaixar para enxergar! 👟😂'
  ],
  roupas: [
    'O guarda-roupa pediu reforço e prometeu parar de dizer “não tenho nada para vestir”! 👕🤣',
    'Look novo sem o cartão precisar fazer terapia depois! 👗😂',
    'Essa roupa veste tão bem que até a câmera frontal vai colaborar! 📸🤣',
    'O espelho já curtiu; falta só você clicar no link! 👚😄',
    'Bonita, barata e não pede senha do Wi-Fi — praticamente perfeita! 😂',
    'Seu guarda-roupa abriu espaço sozinho quando viu esse preço! 👕🤣',
    'O boleto tentou reclamar, mas ficou sem argumento diante dessa oferta! 😄'
  ],
  cozinha: [
    'Essa oferta não cozinha sozinha, mas já deixa a preguiça sem desculpa! 🍳🤣',
    'Até a panela bateu palma quando viu esse preço! 🍲😂',
    'A dieta começa segunda; hoje a cozinha ganhou brinquedo novo! 😄',
    'Preço tão bom que até o arroz soltinho ficou emocionado! 🍚🤣',
    'Sua cozinha vai ficar chique e o miojo vai achar que virou gourmet! 🍜😂',
    'A louça não vai se lavar, mas pelo menos vai ficar com inveja! 🍽️🤣',
    'Esse item é o chef que faltava — e não pede salário! 👨‍🍳😄'
  ],
  casa: [
    'A casa pediu esse mimo e o bolso, num raro momento de união, concordou! 🏠🤣',
    'Sua sala vai ficar tão bonita que as visitas vão achar que erraram de endereço! 🛋️😂',
    'Decoração nova sem precisar vender o sofá antigo — progresso! 😄',
    'Até a poeira ficou nervosa quando viu essa novidade chegando! 🧹🤣',
    'A casa vai ficar chique e o boleto vai continuar morando no cantinho dele! 🏡😂',
    'Preço tão bom que até a tomada ficou chocada! 🔌🤣',
    'Seu lar merece; a bagunça talvez não, mas ela não manda em nada! 😄'
  ],
  tecnologia: [
    'Seu aparelho antigo fingiu que travou para não ver esta oferta! 📱🤣',
    'Tecnologia nova e o bolso ainda com bateria — milagre confirmado! 🔋😂',
    'Esse preço carregou mais rápido que celular com 1% de bateria! ⚡🤣',
    'O Wi-Fi ficou mais rápido só de ouvir falar desta oferta! 📶😄',
    'Seu celular velho já está apagando as fotos de vergonha! 📱😂',
    'Tão moderno que até você vai parecer que entende de tecnologia! 🤓🤣',
    'O cartão perguntou “tem certeza?” e o preço respondeu “relaxa”! 💳😄'
  ],
  beleza: [
    'O espelho já aprovou e nem pediu filtro! ✨🤣',
    'Autocuidado em dia e boleto sem olheiras — combinação rara! 💄😂',
    'Esse produto não resolve a vida, mas pelo menos deixa ela cheirosa! 🌸🤣',
    'Preço tão bonito que nem precisa de maquiagem! 😄',
    'O glow vem no produto; o susto não vem na fatura! ✨😂',
    'Até a nécessaire abriu espaço e disse “pode entrar”! 💅🤣',
    'Beleza por fora, paz financeira por dentro! 🧴😄'
  ],
  fitness: [
    'Agora só falta colocar a motivação no carrinho também! 💪🤣',
    'Queimar calorias sim; queimar dinheiro, hoje não! 🏃😂',
    'O projeto fitness ganhou equipamento. A disposição chega em outro frete! 😄',
    'Preço leve — diferente daquele último exercício de perna! 🏋️🤣',
    'Seu sofá não gostou nada desta oferta! 🛋️😂',
    'Comprar é a parte fácil; usar segunda-feira a gente conversa! 😅',
    'Até o boleto perdeu peso com esse desconto! 💪🤣'
  ],
  infantil: [
    'A criançada vai amar e o bolso, desta vez, não vai fazer birra! 🧸🤣',
    'Diversão garantida; silêncio não incluso no pacote! 😂',
    'O brinquedo já está animado. Os pais ainda estão calculando onde guardar! 🎈🤣',
    'Preço de criança comportada — aparece raramente! 😄',
    'Até o desenho animado perdeu a atenção para esta oferta! 📺😂',
    'Vai render sorriso, bagunça e provavelmente peças debaixo do sofá! 🧩🤣',
    'O pequeno pediu. O desconto fez a defesa dele! 🧒😄'
  ],
  pet: [
    'Seu pet não sabe ler o preço, mas já está cobrando a entrega! 🐾🤣',
    'O focinho aprovou e o bolso abanou o rabo! 🐶😂',
    'Mimo para o pet, porque claramente ele é o verdadeiro dono da casa! 🐱🤣',
    'Seu cachorro disse que precisa. A fonte é: vozes da cabeça dele! 😄',
    'O gato vai fingir indiferença e usar escondido de madrugada! 🐈😂',
    'Preço tão bom que até o peixe fez cara de surpresa! 🐟🤣',
    'Seu pet merece — afinal, ele trabalha duro dormindo o dia inteiro! 🐾😄'
  ],
  automotivo: [
    'Seu carro pediu esse presente e prometeu parar de acender luz misteriosa no painel! 🚗🤣',
    'Oferta que acelera a vontade e freia o gasto! 🏎️😂',
    'O carro agradece; o mecânico talvez fique com ciúmes! 🔧🤣',
    'Preço tão baixo que passou no radar sem levar multa! 🚘😄',
    'Seu veículo vai ficar tão feliz que talvez até pare de fazer aquele barulho estranho! 😂',
    'Mais carinho para o carro do que para muita planta de apartamento! 🌱🤣',
    'O tanque continua caro, mas pelo menos isto aqui ajuda a compensar! ⛽😄'
  ],
  default: [
    'O carrinho olhou para esta oferta e já começou a fazer pressão psicológica! 🛒🤣',
    'O boleto respirou fundo, viu o preço e decidiu não criar confusão! 😂',
    'Oferta boa assim até o cartão perde a timidez e sai da carteira sozinho! 💳🤣',
    'Não é fofoca: esse preço realmente caiu! 😄',
    'Seu “eu não vou comprar nada hoje” durou menos que bateria em 1%! 🔋😂',
    'O desconto chegou tão forte que derrubou até a desculpa para não comprar! 🤣',
    'Preço pequeno, vontade gigante e autocontrole em manutenção! 😄',
    'Atenção: esta oferta pode causar clique involuntário no botão comprar! 😂'
  ]
};


const DEFAULT_API_SERVER = 'https://mercado-yvqn.onrender.com';
const SERVER_MIGRATION_STORAGE_KEY = 'cbofertas-server-default-v310';
const GLOBAL_COUPON_STORAGE_KEY = 'cbofertas-global-coupon-v38';
const COUPON_LIST_STORAGE_KEY = 'cbofertas-coupon-list-v310';
const COUPON_LIBRARY_MIGRATION_KEY = 'cbofertas-coupon-library-migrated-v310';
const SELLER_HISTORY_STORAGE_KEY = 'cbofertas-seller-history-v310';
const PHRASE_HISTORY_STORAGE_KEY = 'cbofertas-phrase-history-v38';
const RADAR_PREFS_STORAGE_KEY = 'cbofertas-radar-prefs-v312';
const RADAR_USED_STORAGE_KEY = 'cbofertas-radar-used-v312';
const RADAR_HIDDEN_STORAGE_KEY = 'cbofertas-radar-hidden-v312';
const RADAR_PRICE_HISTORY_STORAGE_KEY = 'cbofertas-radar-price-history-v312';
const RADAR_LAST_LOAD_STORAGE_KEY = 'cbofertas-radar-last-load-v312';
const FAVORITES_STORAGE_KEY = 'cbofertas-favorites-v400';
const AFFILIATE_LIBRARY_STORAGE_KEY = 'cbofertas-affiliate-library-v500';

const COUPON_BLAST_STORAGE_KEY = 'cbofertas-coupon-blast';
const COUPON_CATEGORY_LABELS = {
  todo_site: 'Todo o site',
  moda: 'Moda',
  casa: 'Casa',
  saude_diversos: 'Saúde e diversos',
  diversos: 'Diversos',
  especifico: 'Produto específico'
};
const VALID_COUPON_CATEGORIES = new Set(Object.keys(COUPON_CATEGORY_LABELS));
const DEFAULT_COUPON_PAGE_LINK = 'https://www.mercadolivre.com.br/cupons?source_page=mperfil#nav-header';
const DEFAULT_COUPON_BLAST_TEXT = `🎟️ *CUPONS DISPONÍVEIS NO MERCADO LIVRE!*

{cupons}

Tem cupom novo esperando por você — o desconto está solto por aí! 😄

👇 *VEJA AS OFERTAS E CUPONS:*
{link}`;

function getCouponBlastConfig() {
  const saved = safeJson(localStorage.getItem(COUPON_BLAST_STORAGE_KEY) || '{}', {});
  return {
    groupName: String(saved.groupName || 'GRUPO DE OFERTAS CB #1'),
    pageLink: String(saved.pageLink || DEFAULT_COUPON_PAGE_LINK),
    text: String(saved.text || DEFAULT_COUPON_BLAST_TEXT),
    image: String(saved.image || '')
  };
}

function setCouponBlastImage(src = '') {
  const value = String(src || '');
  el.couponBlastImage.dataset.image = value;
  if (value) el.couponBlastImage.src = value;
  else el.couponBlastImage.removeAttribute('src');
  if (el.couponImagePlaceholder) el.couponImagePlaceholder.classList.toggle('hidden', Boolean(value));
}

function loadCouponBlastConfig() {
  const config = getCouponBlastConfig();
  const migrationKey = 'cbofertas-coupon-link-v37';
  if (!localStorage.getItem(migrationKey)) {
    config.pageLink = DEFAULT_COUPON_PAGE_LINK;
    try {
      localStorage.setItem(COUPON_BLAST_STORAGE_KEY, JSON.stringify(config));
      localStorage.setItem(migrationKey, '1');
    } catch { }
  }
  el.couponGroupName.value = config.groupName;
  el.couponPageLink.value = config.pageLink;
  el.couponBlastText.value = config.text;
  setCouponBlastImage(config.image);
}

function captureCouponBlastConfig() {
  return {
    groupName: el.couponGroupName.value.trim() || 'GRUPO DE OFERTAS CB #1',
    pageLink: el.couponPageLink.value.trim(),
    text: el.couponBlastText.value.trim() || DEFAULT_COUPON_BLAST_TEXT,
    image: String(el.couponBlastImage.dataset.image || '')
  };
}

function saveCouponBlastConfig(showStatus = true) {
  const config = captureCouponBlastConfig();
  try {
    localStorage.setItem(COUPON_BLAST_STORAGE_KEY, JSON.stringify(config));
    if (showStatus) setStatus(el.couponBlastStatus, 'Modelo de cupons salvo nesta página.', 'success');
    return config;
  } catch {
    setStatus(el.couponBlastStatus, 'A foto ficou grande demais. Escolha uma imagem menor.', 'error');
    return null;
  }
}

function buildCouponBlastMessage(config) {
  const link = String(config.pageLink || '').trim();
  const couponCodes = getActiveCouponCodes();
  const couponBlock = couponCodes.length
    ? `🎟️ *CUPONS ATIVOS:*\n${couponCodes.map((code) => `• *${code}*`).join('\n')}`
    : '🎟️ Consulte os cupons disponíveis no link abaixo.';
  let text = String(config.text || DEFAULT_COUPON_BLAST_TEXT).trim();
  if (text.includes('{cupons}')) text = text.replaceAll('{cupons}', couponBlock);
  else if (couponCodes.length && !couponCodes.some((code) => text.includes(code))) text = `${couponBlock}\n\n${text}`;
  if (text.includes('{link}')) text = text.replaceAll('{link}', link);
  else if (link && !text.includes(link)) text = `${text}\n\n👇 *VEJA AS OFERTAS E CUPONS:*\n${link}`;
  return text.trim();
}

function compressImageFile(file, maxWidth = 1000, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Imagem inválida.'));
      image.onload = () => {
        const scale = Math.min(1, maxWidth / image.width);
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function showPage(page = 'offers') {
  const validPage = ['offers', 'radar', 'history', 'favorites', 'coupons', 'settings'].includes(page) ? page : 'offers';
  const views = {
    offers: el.offersPage,
    radar: el.radarPage,
    history: el.historyPage,
    favorites: el.favoritesPage,
    coupons: el.couponsPage,
    settings: el.settingsPage
  };
  Object.entries(views).forEach(([name, node]) => node?.classList.toggle('hidden', name !== validPage));
  $$('.bottom-tab').forEach((button) => button.classList.toggle('active', button.dataset.page === validPage));
  closeSideMenu();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (validPage === 'radar' && !state.radarItems.length && radarPreferences().autoOpen) loadRadarOffers(false);
  if (validPage === 'favorites') renderFavorites();
}

function focusCouponBlastCard(message = '') {
  showPage('coupons');
  el.couponBlastCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (message) setStatus(el.couponBlastStatus, message, 'error');
}

async function sendCouponBlast() {
  const config = saveCouponBlastConfig(false);
  if (!config) return;
  if (!/^https?:\/\//i.test(config.pageLink)) {
    focusCouponBlastCard('Informe e salve o link da sua página de ofertas.');
    return;
  }
  if (!config.image) {
    focusCouponBlastCard('Escolha e salve a foto que será usada no aviso de cupons.');
    return;
  }

  const text = buildCouponBlastMessage(config);
  setStatus(el.couponBlastStatus, `Abrindo o WhatsApp Business. Selecione “${config.groupName}” e confirme o envio.`, 'success');

  if (window.Android?.shareToWhatsAppBusiness) {
    window.Android.shareToWhatsAppBusiness(config.image, text, config.groupName);
    return;
  }
  await shareSnapshot(text, config.image, true);
}

function normalizeServer(value = '') {
  return String(value).trim().replace(/\/+$/, '');
}

function apiBase() {
  return normalizeServer(localStorage.getItem('cbofertas-api') || DEFAULT_API_SERVER);
}

function isMercadoLivreProductLink(value = '') {
  try {
    const url = new URL(String(value).trim());
    const host = url.hostname.toLowerCase();
    return ['http:', 'https:'].includes(url.protocol)
      && (host === 'meli.la' || host.endsWith('.meli.la') || host.includes('mercadolivre.com') || host.includes('mercadolibre.com'));
  } catch {
    return false;
  }
}

function isAffiliateLink(value = '') {
  try { return /(^|\.)meli\.la$/i.test(new URL(String(value).trim()).hostname); } catch { return false; }
}

function extractItemId(value = '') {
  const raw = String(value || '');
  const wid = raw.match(/[?&#]wid=MLB-?(\d{6,})/i);
  if (wid) return `MLB${wid[1]}`;
  const item = raw.match(/\bMLB-?(\d{6,})\b/i);
  return item ? `MLB${item[1]}` : '';
}

function getAffiliateLibrary() {
  const saved = safeJson(localStorage.getItem(AFFILIATE_LIBRARY_STORAGE_KEY) || '{}', {});
  return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
}

function saveAffiliateAssociation(itemId, affiliateLink, catalogProductId = '') {
  const id = String(itemId || '').replace('-', '').toUpperCase();
  if (!id || !isAffiliateLink(affiliateLink)) return false;
  const library = getAffiliateLibrary();
  const record = { itemId: id, affiliateLink: String(affiliateLink).trim(), catalogProductId: String(catalogProductId || ''), updatedAt: Date.now() };
  library[id] = record;
  if (record.catalogProductId) library[record.catalogProductId] = record;
  localStorage.setItem(AFFILIATE_LIBRARY_STORAGE_KEY, JSON.stringify(library));
  return true;
}

function affiliateFor(item = {}) {
  const library = getAffiliateLibrary();
  const keys = [item.id, item.itemId, item.catalogProductId, extractItemId(item.link)].filter(Boolean);
  for (const key of keys) {
    const record = library[String(key).replace('-', '').toUpperCase()];
    if (record?.affiliateLink) return record.affiliateLink;
  }
  return '';
}

function applySavedAffiliate(item = {}) {
  const saved = affiliateFor(item);
  if (saved) {
    item.link = saved;
    state.affiliateLinkReceived = true;
    state.receivedAffiliateLink = saved;
  }
  return item;
}

function updateAffiliateUi() {
  if (!el.affiliateLinkBtn) return;
  const link = String(el.link?.value || '').trim();
  const ready = Boolean(state.affiliateLinkReceived && state.receivedAffiliateLink === link);
  el.affiliateLinkBtn.disabled = state.editorCollapsed || !isMercadoLivreProductLink(link);
  el.affiliateLinkBtn.classList.toggle('ready', ready);
  el.affiliateLinkBtn.textContent = ready ? '✅ Link de afiliado aplicado' : '💰 Gerar link de afiliado';
}

function openAffiliateGenerator() {
  const link = String(el.link?.value || '').trim();
  if (!isMercadoLivreProductLink(link)) {
    setStatus(el.affiliateStatus, 'Cole ou selecione primeiro um produto do Mercado Livre.', 'error');
    return;
  }
  setStatus(el.affiliateStatus, 'No Mercado Livre, toque em Compartilhar na faixa Ganhos e escolha CbOfertas.', 'success');
  if (window.Android?.openExternalLink) window.Android.openExternalLink(link);
  else window.open(link, '_blank');
}

window.CbOfertasReceiveSharedLink = async (sharedLink) => {
  const link = String(sharedLink || '').trim();
  if (!isMercadoLivreProductLink(link)) {
    setStatus(el.affiliateStatus, 'O compartilhamento recebido não contém um link válido do Mercado Livre.', 'error');
    return;
  }
  state.affiliateLinkReceived = isAffiliateLink(link);
  state.receivedAffiliateLink = state.affiliateLinkReceived ? link : '';
  el.link.value = link;
  state.previewIndex = 0;
  setEditorCollapsed(false);
  showPage('offers');
  renderCurrent();
  setStatus(el.affiliateStatus, state.affiliateLinkReceived ? 'Link oficial recebido. Identificando o anúncio e salvando na biblioteca...' : 'Link do produto recebido.', 'success');
  setStatus(el.topActionStatus, 'Link recebido do compartilhamento do Mercado Livre.', 'success');
  await fetchProduct();
};

function safeJson(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeCouponCode(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function splitCouponText(value = '') {
  const parts = String(value || '')
    .split(/\s*(?:,|;|\||\n|\bou\b)\s*/i)
    .map(normalizeCouponCode)
    .filter(Boolean);
  return [...new Set(parts)];
}

function normalizeCoupon(value = '') {
  return splitCouponText(value).join(' ou ');
}

function couponIsExpired(item = {}) {
  const expiresAt = String(item.expiresAt || '').trim();
  if (!expiresAt) return false;
  const endOfDay = new Date(`${expiresAt}T23:59:59`).getTime();
  return Number.isFinite(endOfDay) && endOfDay < Date.now();
}

function couponRuleSummary(item = {}) {
  const rules = [];
  const minPrice = parseMoney(item.minPrice);
  const minDiscount = Number(item.minDiscount || 0);
  if (Number.isFinite(minPrice) && minPrice > 0) rules.push(`mín. ${formatMoney(minPrice)}`);
  if (minDiscount > 0) rules.push(`desconto ≥ ${minDiscount}%`);
  if (item.expiresAt) rules.push(`até ${new Date(`${item.expiresAt}T12:00:00`).toLocaleDateString('pt-BR')}`);
  if (Number(item.priority || 1) > 1) rules.push(`prioridade ${Number(item.priority) === 3 ? 'máxima' : 'alta'}`);
  return rules;
}

function couponRecordDefaults(item = {}) {
  return {
    id: String(item?.id || couponRecordId()),
    code: normalizeCouponCode(item?.code || ''),
    active: item?.active !== false,
    category: VALID_COUPON_CATEGORIES.has(String(item?.category || '')) ? String(item.category) : 'todo_site',
    target: String(item?.target || '').trim(),
    minPrice: String(item?.minPrice || '').trim(),
    minDiscount: Math.max(0, Math.min(95, Number(item?.minDiscount || 0))),
    expiresAt: String(item?.expiresAt || '').trim(),
    priority: Math.max(1, Math.min(3, Number(item?.priority || 1))),
    createdAt: Number(item?.createdAt) || Date.now()
  };
}

function couponRecordId() {
  return `coupon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function migrateCouponLibrary() {
  if (localStorage.getItem(COUPON_LIBRARY_MIGRATION_KEY)) return;
  const existing = safeJson(localStorage.getItem(COUPON_LIST_STORAGE_KEY) || '[]', []);
  if (Array.isArray(existing) && existing.length) {
    try { localStorage.setItem(COUPON_LIBRARY_MIGRATION_KEY, '1'); } catch { }
    return;
  }

  const legacyCodes = [];
  splitCouponText(localStorage.getItem(GLOBAL_COUPON_STORAGE_KEY) || '').forEach((code) => legacyCodes.push(code));
  const publications = safeJson(localStorage.getItem('cbofertas-publications') || '[]', []);
  if (Array.isArray(publications)) {
    publications.forEach((item) => splitCouponText(item?.coupon || '').forEach((code) => legacyCodes.push(code)));
  }
  const unique = [...new Set(legacyCodes)];
  const migrated = unique.map((code) => ({ id: couponRecordId(), code, active: true, category: 'todo_site', target: '', createdAt: Date.now() }));
  try {
    localStorage.setItem(COUPON_LIST_STORAGE_KEY, JSON.stringify(migrated));
    localStorage.setItem(COUPON_LIBRARY_MIGRATION_KEY, '1');
  } catch { }
}

function getSavedCoupons() {
  migrateCouponLibrary();
  const saved = safeJson(localStorage.getItem(COUPON_LIST_STORAGE_KEY) || '[]', []);
  if (!Array.isArray(saved)) return [];
  return saved.map(couponRecordDefaults).filter((item) => item.code);
}

function saveSavedCoupons(items) {
  const clean = [];
  const seen = new Set();
  (Array.isArray(items) ? items : []).forEach((rawItem) => {
    const item = couponRecordDefaults(rawItem);
    if (!item.code || seen.has(item.code)) return;
    seen.add(item.code);
    clean.push(item);
  });
  localStorage.setItem(COUPON_LIST_STORAGE_KEY, JSON.stringify(clean.slice(0, 100)));
  return clean;
}

function getActiveCouponCodes() {
  return getSavedCoupons()
    .filter((item) => item.active && !couponIsExpired(item))
    .sort((a, b) => Number(b.priority || 1) - Number(a.priority || 1) || Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .map((item) => item.code);
}

function getActiveCouponText() {
  return getActiveCouponCodes().join(' ou ');
}

function simplifyCouponSearch(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function couponOfferCategory(title = '') {
  const baseCategory = category(title);
  if (baseCategory === 'calcados' || baseCategory === 'roupas') return 'moda';
  if (baseCategory === 'cozinha' || baseCategory === 'casa') return 'casa';
  if (baseCategory === 'beleza' || baseCategory === 'fitness' || /sa[uú]de|vitamina|farm[aá]cia|higiene|protetor solar|suplemento|col[aá]geno/i.test(title)) return 'saude_diversos';
  return 'diversos';
}

function couponTargetMatches(target = '', title = '', link = '') {
  const haystack = simplifyCouponSearch(`${title} ${link}`);
  const terms = String(target || '')
    .split(/[,;|\n]+/)
    .map(simplifyCouponSearch)
    .filter(Boolean);
  return terms.length > 0 && terms.some((term) => haystack.includes(term));
}

function couponMatchesOffer(item, title = '', link = '', offerPrice = '', oldPrice = '') {
  if (!item?.active || couponIsExpired(item)) return false;

  const couponCategory = VALID_COUPON_CATEGORIES.has(item.category) ? item.category : 'todo_site';
  const categoryMatches = couponCategory === 'todo_site'
    || (couponCategory === 'especifico' ? couponTargetMatches(item.target, title, link) : couponOfferCategory(title) === couponCategory);
  if (!categoryMatches) return false;

  const currentPrice = parseMoney(offerPrice);
  const requiredPrice = parseMoney(item.minPrice);
  if (Number.isFinite(requiredPrice) && requiredPrice > 0 && (!Number.isFinite(currentPrice) || currentPrice < requiredPrice)) return false;

  const requiredDiscount = Number(item.minDiscount || 0);
  if (requiredDiscount > 0) {
    const discount = discountFromData({ oldPrice, offerPrice });
    if (discount < requiredDiscount) return false;
  }
  return true;
}

function getAutomaticCouponCodes(title = '', link = '', offerPrice = '', oldPrice = '') {
  if (!String(title || '').trim()) return [];
  return getSavedCoupons()
    .filter((item) => couponMatchesOffer(item, title, link, offerPrice, oldPrice))
    .sort((a, b) => Number(b.priority || 1) - Number(a.priority || 1)
      || (b.category === 'especifico' ? 1 : 0) - (a.category === 'especifico' ? 1 : 0)
      || Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .map((item) => item.code);
}

function applyAutomaticCouponsForCurrentOffer({ replace = true, notify = false } = {}) {
  const automatic = getAutomaticCouponCodes(
    el.title?.value || '',
    el.link?.value || '',
    el.offer?.value || '',
    el.old?.value || ''
  );
  const current = replace ? [] : splitCouponText(el.coupon?.value || '');
  const next = [...new Set([...current, ...automatic])];
  state.lastAutoCouponCodes = automatic;
  if (el.coupon) el.coupon.value = next.join(' ou ');
  renderCurrent();
  if (notify) {
    const message = automatic.length
      ? `${automatic.length} cupom(ns) compatível(is) selecionado(s) por prioridade e regras.`
      : 'Nenhum cupom ativo atende às regras deste produto.';
    setStatus(el.topActionStatus, message, automatic.length ? 'success' : '');
  }
  return automatic;
}

function currentCouponText() {
  return normalizeCoupon(el.coupon?.value || '');
}

function getStoredGlobalCoupon() {
  return getActiveCouponText();
}

function setGlobalCoupon(value = '') {
  const codes = splitCouponText(value);
  const current = getSavedCoupons().map((item) => ({ ...item, active: false }));
  codes.forEach((code) => {
    const found = current.find((item) => item.code === code);
    if (found) found.active = true;
    else current.push(couponRecordDefaults({ code, active: true, category: 'todo_site' }));
  });
  saveSavedCoupons(current);
  if (el.coupon) el.coupon.value = codes.join(' ou ');
  renderCouponLibrary();
  return codes.join(' ou ');
}

function currentGlobalCoupon() {
  return currentCouponText();
}

function updateCouponFieldFromActive(force = false) {
  const active = getActiveCouponText();
  if (force || !currentCouponText()) el.coupon.value = active;
  renderCurrent();
}

function replaceCouponCodeInField(oldCode, newCode = '') {
  const codes = splitCouponText(el.coupon?.value || '');
  const next = codes
    .map((code) => code === oldCode ? normalizeCouponCode(newCode) : code)
    .filter(Boolean);
  el.coupon.value = [...new Set(next)].join(' ou ');
}

function updateCouponTargetVisibility() {
  const specific = el.couponCategoryInput?.value === 'especifico';
  el.couponTargetLabel?.classList.toggle('coupon-target-required', specific);
  if (el.couponTargetInput) {
    el.couponTargetInput.disabled = !specific;
    el.couponTargetInput.placeholder = specific
      ? 'Ex.: Air Fryer, tênis Adidas ou link do produto'
      : 'Usado somente para produto específico';
  }
}

function resetCouponEditor() {
  state.editingCouponId = null;
  if (el.couponCodeInput) el.couponCodeInput.value = '';
  if (el.couponCategoryInput) el.couponCategoryInput.value = 'todo_site';
  if (el.couponTargetInput) el.couponTargetInput.value = '';
  if (el.couponMinPriceInput) el.couponMinPriceInput.value = '';
  if (el.couponMinDiscountInput) el.couponMinDiscountInput.value = '';
  if (el.couponExpiresInput) el.couponExpiresInput.value = '';
  if (el.couponPriorityInput) el.couponPriorityInput.value = '1';
  updateCouponTargetVisibility();
  if (el.saveCouponCodeBtn) el.saveCouponCodeBtn.textContent = '＋ Adicionar cupom';
  el.cancelCouponEditBtn?.classList.add('hidden');
}

function renderOfferCouponChoices() {
  if (!el.offerCouponQuickList) return;
  const saved = getSavedCoupons();
  const selected = new Set(splitCouponText(el.coupon?.value || ''));
  if (!saved.length) {
    el.offerCouponQuickList.innerHTML = '<small class="coupon-quick-empty">Nenhum cupom salvo ainda.</small>';
    return;
  }
  el.offerCouponQuickList.innerHTML = saved.map((item) => `<button type="button" class="coupon-quick-chip ${selected.has(item.code) ? 'selected' : ''}" data-code="${escapeHtml(item.code)}" title="${escapeHtml(COUPON_CATEGORY_LABELS[item.category] || 'Todo o site')}">${selected.has(item.code) ? '✓ ' : ''}${escapeHtml(item.code)}</button>`).join('');
}

function renderSellerSuggestions() {
  if (!el.sellerSuggestions) return;
  const sellers = safeJson(localStorage.getItem(SELLER_HISTORY_STORAGE_KEY) || '[]', []);
  el.sellerSuggestions.innerHTML = (Array.isArray(sellers) ? sellers : [])
    .map((seller) => String(seller || '').trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((seller) => `<option value="${escapeHtml(seller)}"></option>`)
    .join('');
}

function rememberSeller(value = '') {
  const seller = String(value || '').trim();
  if (!seller) return;
  const saved = safeJson(localStorage.getItem(SELLER_HISTORY_STORAGE_KEY) || '[]', []);
  const list = [seller, ...(Array.isArray(saved) ? saved : []).filter((item) => String(item).toLowerCase() !== seller.toLowerCase())].slice(0, 20);
  try { localStorage.setItem(SELLER_HISTORY_STORAGE_KEY, JSON.stringify(list)); } catch { }
  renderSellerSuggestions();
}

function renderCouponLibrary() {
  if (!el.couponSavedList) return;
  const items = getSavedCoupons();
  const validActiveItems = items.filter((item) => item.active && !couponIsExpired(item));
  el.couponLibraryCount.textContent = String(items.length);
  const activeText = validActiveItems.map((item) => item.code).join(' ou ');
  el.activeCouponPreview.textContent = activeText || 'Nenhum cupom válido selecionado';
  el.applyCouponsToOfferBtn.disabled = !activeText;

  if (!items.length) {
    el.couponSavedList.innerHTML = '<div class="empty coupon-empty">Nenhum cupom salvo. Digite o primeiro código acima.</div>';
    renderOfferCouponChoices();
    return;
  }

  el.couponSavedList.innerHTML = items.map((item) => {
    const categoryLabel = COUPON_CATEGORY_LABELS[item.category] || COUPON_CATEGORY_LABELS.todo_site;
    const targetText = item.category === 'especifico' && item.target ? ` • ${escapeHtml(item.target)}` : '';
    const expired = couponIsExpired(item);
    const rules = couponRuleSummary(item);
    return `<article class="coupon-saved-item" data-id="${escapeHtml(item.id)}">
      <label class="coupon-active-toggle"><input type="checkbox" data-action="toggle" ${item.active ? 'checked' : ''}><span></span></label>
      <div class="coupon-saved-code">
        <b>${escapeHtml(item.code)}</b>
        <span class="coupon-category-badge">${escapeHtml(categoryLabel)}</span>
        <small>${expired ? 'Vencido — não será aplicado' : (item.active ? 'Habilitado para reconhecimento automático' : 'Desativado')}${targetText}</small>
        ${rules.length ? `<div class="coupon-rule-line">${rules.map((rule) => `<span class="coupon-rule-badge ${expired ? 'expired' : ''}">${escapeHtml(rule)}</span>`).join('')}</div>` : ''}
      </div>
      <button type="button" data-action="edit" class="coupon-item-button">✏️ Alterar</button>
      <button type="button" data-action="delete" class="coupon-item-button danger">🗑️ Excluir</button>
    </article>`;
  }).join('');
  renderOfferCouponChoices();
}

function saveCouponCode() {
  const code = normalizeCouponCode(el.couponCodeInput?.value || '');
  const couponCategory = VALID_COUPON_CATEGORIES.has(el.couponCategoryInput?.value) ? el.couponCategoryInput.value : 'todo_site';
  const couponTarget = String(el.couponTargetInput?.value || '').trim();
  const minPrice = String(el.couponMinPriceInput?.value || '').trim();
  const minDiscount = Math.max(0, Math.min(95, Number(el.couponMinDiscountInput?.value || 0)));
  const expiresAt = String(el.couponExpiresInput?.value || '').trim();
  const priority = Math.max(1, Math.min(3, Number(el.couponPriorityInput?.value || 1)));

  if (!code) return setStatus(el.couponLibraryStatus, 'Digite o código do cupom.', 'error');
  if (couponCategory === 'especifico' && !couponTarget) return setStatus(el.couponLibraryStatus, 'Informe o produto, palavras-chave ou link para o cupom específico.', 'error');
  if (minPrice && !Number.isFinite(parseMoney(minPrice))) return setStatus(el.couponLibraryStatus, 'Informe um valor mínimo válido.', 'error');

  const ruleData = { category: couponCategory, target: couponTarget, minPrice, minDiscount, expiresAt, priority };
  const items = getSavedCoupons();
  const duplicate = items.find((item) => item.code === code && item.id !== state.editingCouponId);
  if (duplicate) {
    Object.assign(duplicate, ruleData, { active: true });
    saveSavedCoupons(items);
    resetCouponEditor();
    renderCouponLibrary();
    if (el.title?.value.trim()) applyAutomaticCouponsForCurrentOffer({ replace: false });
    return setStatus(el.couponLibraryStatus, 'Esse cupom já estava salvo; as regras foram atualizadas.', 'success');
  }

  if (state.editingCouponId) {
    const item = items.find((entry) => entry.id === state.editingCouponId);
    if (!item) return resetCouponEditor();
    const oldCode = item.code;
    Object.assign(item, ruleData, { code, active: true });
    saveSavedCoupons(items);
    replaceCouponCodeInField(oldCode, code);
    setStatus(el.couponLibraryStatus, 'Cupom e regras alterados com sucesso.', 'success');
  } else {
    items.unshift(couponRecordDefaults({ code, active: true, ...ruleData, createdAt: Date.now() }));
    saveSavedCoupons(items);
    if (el.title?.value.trim()) applyAutomaticCouponsForCurrentOffer({ replace: false });
    setStatus(el.couponLibraryStatus, 'Cupom inteligente adicionado e ativado.', 'success');
  }
  resetCouponEditor();
  renderCouponLibrary();
  renderCurrent();
}

function beginCouponEdit(id) {
  const item = getSavedCoupons().find((entry) => entry.id === id);
  if (!item) return;
  state.editingCouponId = item.id;
  el.couponCodeInput.value = item.code;
  el.couponCategoryInput.value = item.category || 'todo_site';
  el.couponTargetInput.value = item.target || '';
  if (el.couponMinPriceInput) el.couponMinPriceInput.value = item.minPrice || '';
  if (el.couponMinDiscountInput) el.couponMinDiscountInput.value = item.minDiscount || '';
  if (el.couponExpiresInput) el.couponExpiresInput.value = item.expiresAt || '';
  if (el.couponPriorityInput) el.couponPriorityInput.value = String(item.priority || 1);
  updateCouponTargetVisibility();
  el.saveCouponCodeBtn.textContent = '✓ Salvar alteração';
  el.cancelCouponEditBtn.classList.remove('hidden');
  el.couponCodeInput.focus();
  el.couponManagerCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleCoupon(id, active) {
  const items = getSavedCoupons();
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  item.active = Boolean(active);
  saveSavedCoupons(items);
  if (el.title?.value.trim()) applyAutomaticCouponsForCurrentOffer({ replace: true });
  else renderCurrent();
  renderCouponLibrary();
  setStatus(el.couponLibraryStatus, item.active ? 'Cupom habilitado para reconhecimento automático.' : 'Cupom desativado.', 'success');
}

function deleteCoupon(id) {
  const items = getSavedCoupons();
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  if (!confirm(`Excluir o cupom “${item.code}”?`)) return;
  saveSavedCoupons(items.filter((entry) => entry.id !== id));
  replaceCouponCodeInField(item.code, '');
  if (state.editingCouponId === id) resetCouponEditor();
  renderCouponLibrary();
  renderCurrent();
  setStatus(el.couponLibraryStatus, 'Cupom excluído.', 'success');
}

function setStatus(node, text, type = '') {
  node.textContent = text;
  node.className = node === el.topActionStatus ? `top-action-status ${type}` : `status ${type}`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function parseMoney(value) {
  let raw = String(value || '').replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!raw) return NaN;
  if (raw.includes(',') && raw.includes('.')) {
    raw = raw.lastIndexOf(',') > raw.lastIndexOf('.')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '');
  } else {
    raw = raw.replace(',', '.');
  }
  return Number(raw.replace(/[^\d.-]/g, ''));
}

function formatMoney(value) {
  const number = typeof value === 'number' ? value : parseMoney(value);
  return Number.isFinite(number)
    ? number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '';
}

function category(title = '') {
  if (/t[eê]nis|sapato|sand[aá]lia|chinelo|bota|sapatilha|mocassim/i.test(title)) return 'calcados';
  if (/camiseta|camisa|vestido|cal[cç]a|bermuda|short|moletom|jaqueta|blusa|roupa|saia|cueca|suti[aã]/i.test(title)) return 'roupas';
  if (/air\s*fryer|panela|cafeteira|liquidificador|batedeira|micro-ondas|forno|cooktop|cozinha|talher|frigideira/i.test(title)) return 'cozinha';
  if (/sof[aá]|colch[aã]o|aspirador|geladeira|lavadora|ventilador|casa|decora[cç][aã]o|lumin[aá]ria|tapete/i.test(title)) return 'casa';
  if (/celular|smartphone|iphone|galaxy|xiaomi|tv|notebook|computador|fone|smartwatch|tablet|monitor|teclado|mouse/i.test(title)) return 'tecnologia';
  if (/perfume|maquiagem|creme|shampoo|condicionador|beleza|hidratante|batom|secador|prancha/i.test(title)) return 'beleza';
  if (/halter|academia|fitness|bicicleta|esteira|suplemento|whey|esporte|bola|treino/i.test(title)) return 'fitness';
  if (/brinquedo|beb[eê]|infantil|crian[cç]a|boneca|carrinho|fralda|ber[cç]o/i.test(title)) return 'infantil';
  if (/pet|cachorro|gato|ra[cç][aã]o|coleira|arranhador|aqu[aá]rio/i.test(title)) return 'pet';
  if (/carro|moto|automotivo|pneu|capacete|farol|bateria|ferramenta|chave de impacto/i.test(title)) return 'automotivo';
  return 'default';
}


function radarPreferences() {
  const saved = safeJson(localStorage.getItem(RADAR_PREFS_STORAGE_KEY) || '{}', {});
  return {
    query: String(saved.query || ''), category: String(saved.category || ''),
    minDiscount: Number.isFinite(Number(saved.minDiscount)) ? Number(saved.minDiscount) : 15,
    maxPrice: String(saved.maxPrice || ''), onlyFull: Boolean(saved.onlyFull),
    hideUsed: saved.hideUsed !== false, autoOpen: saved.autoOpen !== false
  };
}

function applyRadarPreferences() {
  const prefs = radarPreferences();
  if (el.radarQuery) el.radarQuery.value = prefs.query;
  if (el.radarCategory) el.radarCategory.value = prefs.category;
  if (el.radarMinDiscount) el.radarMinDiscount.value = String(prefs.minDiscount);
  if (el.radarMaxPrice) el.radarMaxPrice.value = prefs.maxPrice;
  if (el.radarOnlyFull) el.radarOnlyFull.checked = prefs.onlyFull;
  if (el.radarHideUsed) el.radarHideUsed.checked = prefs.hideUsed;
  if (el.radarAutoOpen) el.radarAutoOpen.checked = prefs.autoOpen;
  if (el.settingsRadarAuto) el.settingsRadarAuto.checked = prefs.autoOpen;
}

function saveRadarPreferences() {
  const prefs = {
    query: el.radarQuery?.value.trim() || '', category: el.radarCategory?.value || '',
    minDiscount: Math.max(0, Math.min(95, Number(el.radarMinDiscount?.value || 0))),
    maxPrice: el.radarMaxPrice?.value.trim() || '', onlyFull: Boolean(el.radarOnlyFull?.checked),
    hideUsed: Boolean(el.radarHideUsed?.checked), autoOpen: Boolean(el.radarAutoOpen?.checked)
  };
  try { localStorage.setItem(RADAR_PREFS_STORAGE_KEY, JSON.stringify(prefs)); } catch { }
  if (el.settingsRadarAuto) el.settingsRadarAuto.checked = prefs.autoOpen;
  return prefs;
}

function radarStoredSet(key) {
  return new Set(safeJson(localStorage.getItem(key) || '[]', []));
}

function saveRadarStoredSet(key, values) {
  try { localStorage.setItem(key, JSON.stringify([...values].slice(-1000))); } catch { }
}

function radarItemKey(item = {}) {
  return String(item.id || item.link || item.title || '').trim();
}

function recordRadarPrices(items = []) {
  const history = safeJson(localStorage.getItem(RADAR_PRICE_HISTORY_STORAGE_KEY) || '{}', {});
  const now = Date.now();
  items.forEach(item => {
    const key = radarItemKey(item);
    const price = parseMoney(item.price);
    if (!key || !Number.isFinite(price)) return;
    const entries = Array.isArray(history[key]) ? history[key].filter(x => Number.isFinite(Number(x?.price))) : [];
    const last = entries[entries.length - 1];
    if (!last || Math.abs(Number(last.price) - price) > 0.001 || now - Number(last.at || 0) > 6 * 60 * 60 * 1000) entries.push({ price, at: now });
    history[key] = entries.slice(-30);
  });
  try { localStorage.setItem(RADAR_PRICE_HISTORY_STORAGE_KEY, JSON.stringify(history)); } catch { }
}

function radarPriceSummary(item) {
  const history = safeJson(localStorage.getItem(RADAR_PRICE_HISTORY_STORAGE_KEY) || '{}', {});
  const entries = Array.isArray(history[radarItemKey(item)]) ? history[radarItemKey(item)] : [];
  const prices = entries.map(x => Number(x.price)).filter(Number.isFinite);
  if (!prices.length) return '';
  const min = Math.min(...prices);
  const current = parseMoney(item.price);
  if (Number.isFinite(current) && current <= min + 0.001 && prices.length > 1) return `🏆 Menor preço registrado: ${formatMoney(min)}`;
  return `Histórico local: menor ${formatMoney(min)} em ${prices.length} consulta(s)`;
}

function radarImageUrl(item) {
  const base = apiBase();
  const image = String(item.image || '');
  if (!image) return '';
  if (image.startsWith('/')) return `${base}${image}`;
  return image;
}

function renderRadarOffers() {
  if (!el.radarResults) return;
  const used = radarStoredSet(RADAR_USED_STORAGE_KEY);
  const hidden = radarStoredSet(RADAR_HIDDEN_STORAGE_KEY);
  const savedLinks = new Set(getPublications().map(item => String(item.link || '').replace(/[?#].*$/, '')));
  const favoriteKeys = new Set(getFavorites().map(item => item.key));
  const hideUsed = Boolean(el.radarHideUsed?.checked);
  const visible = state.radarItems.filter(item => !hidden.has(radarItemKey(item)) && !(hideUsed && used.has(radarItemKey(item))));
  el.radarFoundCount.textContent = String(state.radarItems.length);
  el.radarNewCount.textContent = String(state.radarItems.filter(item => !used.has(radarItemKey(item))).length);
  el.radarBestDiscount.textContent = `${Math.max(0, ...state.radarItems.map(item => Number(item.discount || 0)))}%`;
  const last = Number(localStorage.getItem(RADAR_LAST_LOAD_STORAGE_KEY) || 0);
  el.radarLastUpdate.textContent = last ? new Date(last).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
  el.radarEmpty.classList.toggle('hidden', visible.length > 0 || state.radarLoading);
  if (state.radarLoading) {
    el.radarResults.innerHTML = '<article class="card radar-loading-card"><strong>🔎 Procurando as melhores ofertas...</strong><p>O servidor está consultando e classificando as promoções.</p></article>';
    return;
  }
  if (!visible.length) { el.radarResults.innerHTML = ''; return; }
  el.radarResults.innerHTML = visible.map(item => {
    const key = radarItemKey(item);
    const image = radarImageUrl(item);
    const oldPrice = formatMoney(item.oldPrice);
    const price = formatMoney(item.price);
    const saving = formatMoney(item.savings);
    const alreadySaved = savedLinks.has(String(item.link || '').replace(/[?#].*$/, ''));
    const favorite = favoriteKeys.has(favoriteKey(item));
    const history = radarPriceSummary(item);
    return `<article class="radar-card ${used.has(key) ? 'used' : ''}" data-key="${escapeHtml(key)}">
      ${alreadySaved ? '<span class="already-saved">✓ SALVA</span>' : ''}
      <div class="radar-card-image">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.title || 'Produto')}" loading="lazy">` : '<span class="no-image">🛍️</span>'}</div>
      <div class="radar-card-main">
        <div class="radar-badges">${item.discount ? `<span class="radar-badge discount">🔥 ${item.discount}% OFF</span>` : ''}${item.full ? '<span class="radar-badge full">FULL</span>' : ''}<span class="radar-badge score">⭐ ${Number(item.score || 0)} pontos</span></div>
        <h3>${escapeHtml(item.title || 'Oferta')}</h3>
        <div class="radar-price-line"><strong>${escapeHtml(price || 'Preço sob consulta')}</strong>${oldPrice ? `<del>${escapeHtml(oldPrice)}</del>` : ''}</div>
        ${saving ? `<span class="radar-economy">Economia de ${escapeHtml(saving)}</span>` : ''}
        <div class="radar-meta"><span>${escapeHtml(item.category || 'diversos')}</span>${item.seller ? `<span>🏬 ${escapeHtml(item.seller)}</span>` : ''}${item.freeShipping ? '<span>🚚 Frete grátis</span>' : ''}</div>
        ${history ? `<div class="radar-history">${escapeHtml(history)}</div>` : ''}
        <div class="radar-card-actions">
          <button class="btn primary" data-radar-action="approve" type="button">✓ Usar oferta</button>
          <button class="btn outline" data-radar-action="open" type="button">↗ Abrir</button>
          <button class="radar-favorite-button ${favorite ? 'active' : ''}" data-radar-action="favorite" type="button">${favorite ? '★ Salvo' : '☆ Favorito'}</button>
          <button class="radar-hide-button" data-radar-action="hide" type="button" title="Ocultar">✕</button>
        </div>
      </div>
    </article>`;
  }).join('');
}

async function loadRadarOffers(forceRefresh = false) {
  const base = apiBase();
  if (!base) return setStatus(el.radarStatus, 'Configure o servidor antes de abrir o Radar.', 'error');
  const prefs = saveRadarPreferences();
  state.radarLoading = true;
  renderRadarOffers();
  setStatus(el.radarStatus, 'Consultando promoções e removendo resultados fracos...');
  if (el.searchRadarBtn) el.searchRadarBtn.disabled = true;
  if (el.refreshRadarBtn) el.refreshRadarBtn.disabled = true;
  try {
    const params = new URLSearchParams({ query: prefs.query, category: prefs.category, minDiscount: String(prefs.minDiscount || 0), maxPrice: String(parseMoney(prefs.maxPrice) || 0), onlyFull: prefs.onlyFull ? '1' : '0', limit: '36' });
    if (forceRefresh) params.set('refresh', '1');
    const response = await fetch(`${base}/api/radar?${params}`, { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'O servidor ainda não possui o Radar atualizado.');
    state.radarItems = Array.isArray(data.items) ? data.items : [];
    recordRadarPrices(state.radarItems);
    localStorage.setItem(RADAR_LAST_LOAD_STORAGE_KEY, String(Date.now()));
    const source = data.source ? ` Fonte: ${data.source}.` : '';
    setStatus(el.radarStatus, state.radarItems.length ? `${state.radarItems.length} oferta(s) classificadas.${source}` : 'Nenhuma promoção corresponde aos filtros atuais.', state.radarItems.length ? 'success' : 'error');
  } catch (error) {
    state.radarItems = [];
    setStatus(el.radarStatus, error.message || 'Não foi possível carregar o Radar.', 'error');
  } finally {
    state.radarLoading = false;
    if (el.searchRadarBtn) el.searchRadarBtn.disabled = false;
    if (el.refreshRadarBtn) el.refreshRadarBtn.disabled = false;
    renderRadarOffers();
  }
}

async function approveRadarOffer(item) {
  const used = radarStoredSet(RADAR_USED_STORAGE_KEY);
  used.add(radarItemKey(item));
  saveRadarStoredSet(RADAR_USED_STORAGE_KEY, used);
  clearForm({ expand: true, status: false });
  state.affiliateLinkReceived = false;
  state.receivedAffiliateLink = '';
  const linkedItem = applySavedAffiliate({ ...item });
  el.link.value = linkedItem.link || item.link || '';
  el.title.value = item.title || '';
  el.old.value = item.oldPrice || '';
  el.offer.value = item.price || '';
  if (el.seller) el.seller.value = item.seller || '';
  state.full = Boolean(item.full);
  el.freight.value = item.full ? 'Entrega FULL' : (item.freeShipping ? 'Frete grátis' : 'Consulte o frete');
  if (item.image) setImage(radarImageUrl(item));
  applyAutomaticCouponsForCurrentOffer({ replace: true });
  generatePhrase(true);
  renderCurrent();
  showPage('offers');
  setStatus(el.topActionStatus, 'Oferta aprovada pelo Radar. Conferindo preço, vendedor e disponibilidade...', 'success');
  if (item.link) await fetchProduct();
}

function hideRadarOffer(item) {
  const hidden = radarStoredSet(RADAR_HIDDEN_STORAGE_KEY);
  hidden.add(radarItemKey(item));
  saveRadarStoredSet(RADAR_HIDDEN_STORAGE_KEY, hidden);
  renderRadarOffers();
}

async function liveProductData(link) {
  const base = apiBase();
  if (!base || !link) return null;
  const response = await fetch(`${base}/api/product?url=${encodeURIComponent(link)}`, { cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível conferir a oferta.');
  return data;
}

async function verifyPublicationBeforeShare(publication) {
  if (!publication?.link) return publication;
  setStatus(el.publicationStatus, `Conferindo “${publication.title || 'Oferta'}” antes de enviar...`);
  try {
    const live = await liveProductData(publication.link);
    if (!live) return publication;
    const previousPrice = formatMoney(publication.offerPrice);
    const livePriceRaw = live.price || live.currentPrice || live.pixPrice || '';
    const livePrice = formatMoney(livePriceRaw);
    if (previousPrice && livePrice && previousPrice !== livePrice) {
      const accepted = confirm(`O preço mudou antes do envio.\n\nSalvo: ${previousPrice}\nAtual: ${livePrice}\n\nAtualizar a publicação e continuar?`);
      if (!accepted) { setStatus(el.publicationStatus, 'Envio cancelado para você revisar o preço.', 'error'); return null; }
    }
    const updated = { ...publication, title: live.title || publication.title, oldPrice: live.oldPrice || publication.oldPrice, offerPrice: livePriceRaw || publication.offerPrice, seller: String(live.seller || live.store || publication.seller || '').trim(), full: Boolean(live.full), updatedAt: Date.now(), lastVerifiedAt: Date.now() };
    const items = getPublications().map(item => item.id === updated.id ? updated : item);
    savePublications(items);
    renderPublications();
    return updated;
  } catch (error) {
    const continueAnyway = confirm(`${error.message || 'Não foi possível conferir a oferta.'}\n\nDeseja enviar usando os dados salvos?`);
    return continueAnyway ? publication : null;
  }
}


function intelligentEmoji(title = '') {
  return ({
    calcados: '👟', roupas: '👕', cozinha: '🍳', casa: '🏠', tecnologia: '📱',
    beleza: '✨', fitness: '💪', infantil: '🧸', pet: '🐾', automotivo: '🚗', default: '🛍️'
  })[category(title)];
}

function randomPhraseForTitle(title = '') {
  const groupKey = category(title);
  const group = funnyPhrases[groupKey] || funnyPhrases.default;
  const history = safeJson(localStorage.getItem(PHRASE_HISTORY_STORAGE_KEY) || '{}', {});
  const used = Array.isArray(history[groupKey]) ? history[groupKey].filter((phrase) => group.includes(phrase)) : [];
  let available = group.filter((phrase) => !used.includes(phrase));
  if (!available.length) available = [...group];
  const phrase = available[Math.floor(Math.random() * available.length)];
  const nextUsed = available.length === group.length && used.length >= group.length ? [phrase] : [...used, phrase];
  history[groupKey] = nextUsed.slice(-group.length);
  try { localStorage.setItem(PHRASE_HISTORY_STORAGE_KEY, JSON.stringify(history)); } catch { }
  return phrase;
}

function generatePhrase(force = false) {
  if (!force && el.phrase.value.trim()) return el.phrase.value.trim();
  const phrase = randomPhraseForTitle(el.title.value);
  el.phrase.value = phrase;
  return phrase;
}

function headingForStyle(style = state.style) {
  const headings = {
    divertido: '🔥😱💸 *OFERTA QUE O BOLETO NÃO VIU CHEGANDO*',
    premium: '✨👑 *OFERTA PREMIUM DO DIA*',
    grupo: '👥🔥 *ACHADINHO DO GRUPO*',
    familia: '🏠💚 *OFERTA PARA A FAMÍLIA*',
    ofertas: '🔥 *OFERTA IMPERDÍVEL*'
  };
  return headings[style] || headings.divertido;
}

function installmentInterestText(noInterest = el.installmentNoInterest.checked) {
  return noInterest ? 'sem juros' : 'com juros';
}

function discountFromData(data) {
  const oldPrice = parseMoney(data.oldPrice);
  const offerPrice = parseMoney(data.offerPrice);
  return Number.isFinite(oldPrice) && Number.isFinite(offerPrice) && oldPrice > offerPrice && oldPrice > 0
    ? Math.round((1 - offerPrice / oldPrice) * 100)
    : 0;
}

function currentInstallments() {
  const qty = Math.max(0, Math.min(48, Number.parseInt(el.installmentQty.value, 10) || 0));
  const value = parseMoney(el.installmentValue.value);
  return { qty, value };
}

function captureForm() {
  return {
    id: state.editingId || '',
    link: el.link.value.trim(),
    itemId: String(el.link.dataset.itemId || ''),
    catalogProductId: String(el.link.dataset.catalogProductId || ''),
    affiliateConfirmed: isAffiliateLink(el.link.value.trim()),
    title: el.title.value.trim(),
    image: state.image || '',
    full: state.full,
    style: state.style,
    oldPrice: el.old.value.trim(),
    offerPrice: el.offer.value.trim(),
    installmentQty: Math.max(0, Math.min(48, Number.parseInt(el.installmentQty.value, 10) || 0)),
    installmentValue: el.installmentValue.value.trim(),
    installmentNoInterest: el.installmentNoInterest.checked,
    freight: el.freight.value,
    seller: el.seller?.value.trim() || '',
    coupon: currentCouponText(),
    phrase: el.phrase.value.trim() || randomPhraseForTitle(el.title.value)
  };
}

function linksFromData(data) {
  const url = String(data.link || '').trim();
  return url ? [{ label: 'Oferta', url }] : [];
}

function buildTextForData(data, linkItem, totalMessages = 1) {
  const title = String(data.title || '').trim() || 'Oferta especial';
  const phrase = String(data.phrase || '').trim() || randomPhraseForTitle(title);
  const oldPrice = formatMoney(data.oldPrice);
  const offerPrice = formatMoney(data.offerPrice);
  const installmentQty = Math.max(0, Math.min(48, Number.parseInt(data.installmentQty, 10) || 0));
  const installmentValue = parseMoney(data.installmentValue);
  const percentage = discountFromData(data);
  const lines = [headingForStyle(data.style)];

  if (phrase) lines.push('', phrase);
  lines.push('', `${intelligentEmoji(title)} *${title}*`);
  if (oldPrice) lines.push('', `❌ De: ~${oldPrice}~`);
  if (offerPrice) lines.push(`✅ *Por: ${offerPrice}*`);
  if (installmentQty && Number.isFinite(installmentValue)) {
    lines.push(`💳 ${installmentQty}x de ${formatMoney(installmentValue)} ${installmentInterestText(Boolean(data.installmentNoInterest))}`);
  }
  if (percentage) lines.push(`🏷️ *${percentage}% OFF*`);
  if (data.freight) lines.push(`🚚 ${data.freight}`);
  if (data.seller) lines.push(`🏬 Vendido por: *${data.seller}*`);
  const couponText = normalizeCoupon(data.coupon || '');
  if (couponText) lines.push('', `🎟️ *${splitCouponText(couponText).length > 1 ? 'CUPONS' : 'CUPOM'}: ${couponText}*`);
  if (linkItem?.url) {
    lines.push('', '👇 *PEGAR OFERTA:*');
    lines.push(linkItem.url);
  }

  return lines.filter((line, index, array) => !(line === '' && array[index - 1] === '')).join('\n').trim();
}

function buildMessagesForData(data) {
  const links = linksFromData(data);
  if (!links.length) return [{ label: 'Oferta', url: '', text: buildTextForData(data, null, 1) }];
  return links.map((item) => ({ ...item, text: buildTextForData(data, item, 1) }));
}

function setImage(url) {
  state.image = url || '';
  if (!state.image) el.image.removeAttribute('src');
  else el.image.src = state.image;
}

function setSelectedStyle(style = 'divertido') {
  state.style = ['divertido', 'premium', 'grupo', 'familia', 'ofertas'].includes(style) ? style : 'divertido';
  $$('.style-chip').forEach((button) => button.classList.toggle('active', button.dataset.style === state.style));
}

function renderCurrent() {
  const data = captureForm();
  const messages = buildMessagesForData(data);
  state.previewIndex = Math.max(0, Math.min(state.previewIndex, messages.length - 1));
  const current = messages[state.previewIndex];
  el.finalText.value = current.text;

  const rawTitle = data.title || 'Oferta especial';
  const title = escapeHtml(rawTitle);
  const phrase = escapeHtml(data.phrase || randomPhraseForTitle(rawTitle));
  const oldPrice = escapeHtml(formatMoney(data.oldPrice));
  const offerPrice = escapeHtml(formatMoney(data.offerPrice));
  const installmentValue = parseMoney(data.installmentValue);
  const percentage = discountFromData(data);
  const couponText = normalizeCoupon(data.coupon || '');
  const coupon = escapeHtml(couponText);
  const seller = escapeHtml(data.seller || '');
  const oldNumber = parseMoney(data.oldPrice);
  const offerNumber = parseMoney(data.offerPrice);
  const savings = Number.isFinite(oldNumber) && Number.isFinite(offerNumber) && oldNumber > offerNumber
    ? oldNumber - offerNumber
    : 0;

  el.interestLabel.textContent = installmentInterestText(data.installmentNoInterest);
  el.installmentPreview.textContent = data.installmentQty && Number.isFinite(installmentValue)
    ? `${data.installmentQty}x de ${formatMoney(installmentValue)} ${installmentInterestText(data.installmentNoInterest)}`
    : '';
  el.discountBadge.textContent = percentage ? `🔥 ${percentage}% OFF` : '';
  el.discountBadge.classList.toggle('hidden', !percentage);
  el.fullBadge.classList.toggle('hidden', !data.full);
  el.productFoundBadge?.classList.toggle('hidden', !(data.title && Number.isFinite(offerNumber)));
  if (el.savingsValue) el.savingsValue.textContent = formatMoney(savings) || 'R$ 0,00';
  $('#copyBtn').textContent = '▣ Copiar Texto';
  $('#whatsappBtn').textContent = '◉ WhatsApp';

  const linkHtml = current.url
    ? `<div class="preview-links"><b>👇 PEGAR OFERTA</b><a class="offer-link" href="${escapeHtml(current.url)}">🔗 ${escapeHtml(current.url)}</a></div>`
    : '';

  el.preview.innerHTML = `<div class="message-bubble">
    <span class="offer-title">${escapeHtml(headingForStyle(data.style).replace(/\*/g, ''))}</span>
    ${phrase ? `<span class="smart-phrase">${phrase}</span>` : ''}
    <span class="product-name">${intelligentEmoji(rawTitle)} ${title}</span><br><br>
    ${oldPrice ? `❌ De: <span class="old">${oldPrice}</span><br>` : ''}
    ${offerPrice ? `✅ <span class="offer-price">Por: ${offerPrice}</span><br>` : ''}
    ${data.installmentQty && Number.isFinite(installmentValue) ? `💳 <span class="installment">${data.installmentQty}x de ${escapeHtml(formatMoney(installmentValue))} ${installmentInterestText(data.installmentNoInterest)}</span><br>` : ''}
    ${percentage ? `🏷️ <b>${percentage}% OFF</b><br>` : ''}
    ${data.freight ? `🚚 ${escapeHtml(data.freight)}<br>` : ''}
    ${seller ? `🏬 Vendido por: <b>${seller}</b><br>` : ''}
    ${coupon ? `<br>🎟️ <b>${splitCouponText(couponText).length > 1 ? 'CUPONS' : 'CUPOM'}: ${coupon}</b>` : ''}
    ${linkHtml}
  </div>`;
  renderOfferCouponChoices();
  if (el.charCounter) el.charCounter.textContent = `${el.finalText.value.length}/1200`;
  syncCurrentFavoriteButton();
  updateAffiliateUi();
}

function setEditorCollapsed(collapsed) {
  state.editorCollapsed = Boolean(collapsed);
  el.editorArea.classList.toggle('hidden', state.editorCollapsed);
  el.editorCollapsedNotice.classList.toggle('hidden', !state.editorCollapsed);
  el.fetchBtn.disabled = state.editorCollapsed;
  el.saveItemBtn.disabled = state.editorCollapsed;
  el.clearBtn.disabled = state.editorCollapsed;
  updateAffiliateUi();
}

function clearForm({ expand = true, status = true } = {}) {
  state.editingId = null;
  state.previewIndex = 0;
  state.full = false;
  state.affiliateLinkReceived = false;
  state.receivedAffiliateLink = '';
  setSelectedStyle('divertido');
  el.link.value = '';
  el.link.dataset.itemId = '';
  el.link.dataset.catalogProductId = '';
  el.title.value = '';
  el.old.value = '';
  el.offer.value = '';
  el.installmentQty.value = '';
  el.installmentValue.value = '';
  el.installmentNoInterest.checked = true;
  el.freight.value = 'Frete grátis';
  if (el.seller) el.seller.value = '';
  el.coupon.value = '';
  state.lastAutoCouponCodes = [];
  el.phrase.value = '';
  setImage('');
  el.saveItemBtn.textContent = '♡ Salvar no histórico';
  if (expand) setEditorCollapsed(false);
  generatePhrase(true);
  renderCurrent();
  setStatus(el.fetchStatus, '');
  if (status) setStatus(el.topActionStatus, 'Campos limpos. Pronto para uma nova oferta.', 'success');
}

function applyPublicationToForm(publication) {
  state.editingId = publication.id;
  state.previewIndex = 0;
  state.full = Boolean(publication.full);
  state.affiliateLinkReceived = false;
  state.receivedAffiliateLink = '';
  setSelectedStyle(publication.style || 'divertido');
  el.link.value = publication.link || '';
  el.title.value = publication.title || '';
  el.old.value = publication.oldPrice || '';
  el.offer.value = publication.offerPrice || '';
  el.installmentQty.value = publication.installmentQty || '';
  el.installmentValue.value = publication.installmentValue || '';
  el.installmentNoInterest.checked = publication.installmentNoInterest !== false;
  el.freight.value = publication.freight ?? 'Frete grátis';
  if (el.seller) el.seller.value = publication.seller || '';
  el.coupon.value = normalizeCoupon(publication.coupon || '');
  el.phrase.value = publication.phrase || randomPhraseForTitle(publication.title || '');
  setImage(publication.image || '');
  el.saveItemBtn.textContent = '✓ Atualizar oferta';
  setEditorCollapsed(false);
  renderCurrent();
  showPage('offers');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setStatus(el.topActionStatus, 'Item carregado para alteração. Salve novamente quando terminar.', 'success');
}


function favoriteKey(item = {}) {
  const link = String(item.link || '').trim().replace(/[?#].*$/, '').replace(/\/+$/, '');
  return link || String(item.id || item.title || '').trim().toLowerCase();
}

function normalizeFavorite(item = {}) {
  const offerPrice = String(item.offerPrice ?? item.price ?? '').trim();
  return {
    id: String(item.id || `fav-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    key: favoriteKey(item),
    title: String(item.title || 'Oferta').trim(),
    link: String(item.link || '').trim(),
    image: String(item.image || '').trim(),
    full: Boolean(item.full),
    oldPrice: String(item.oldPrice || '').trim(),
    offerPrice,
    installmentQty: Number(item.installmentQty || 0),
    installmentValue: String(item.installmentValue || '').trim(),
    installmentNoInterest: item.installmentNoInterest !== false,
    freight: String(item.freight || (item.freeShipping ? 'Frete grátis' : '')).trim(),
    seller: String(item.seller || '').trim(),
    coupon: normalizeCoupon(item.coupon || ''),
    phrase: String(item.phrase || '').trim(),
    style: String(item.style || 'divertido'),
    source: String(item.source || 'manual'),
    addedAt: Number(item.addedAt || Date.now())
  };
}

function getFavorites() {
  const saved = safeJson(localStorage.getItem(FAVORITES_STORAGE_KEY) || '[]', []);
  if (!Array.isArray(saved)) return [];
  const seen = new Set();
  return saved.map(normalizeFavorite).filter((item) => {
    if (!item.key || seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

function saveFavorites(items) {
  const normalized = (Array.isArray(items) ? items : []).map(normalizeFavorite).slice(0, 300);
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function isFavorite(item = {}) {
  const key = favoriteKey(item);
  return Boolean(key) && getFavorites().some((favorite) => favorite.key === key);
}

function favoriteFromRadar(item = {}) {
  return normalizeFavorite({
    ...item,
    image: radarImageUrl(item),
    offerPrice: item.price,
    freight: item.full ? 'Entrega FULL' : (item.freeShipping ? 'Frete grátis' : 'Consulte o frete'),
    source: 'radar'
  });
}

function toggleFavorite(item = {}, statusNode = el.favoritesStatus) {
  const favorite = normalizeFavorite(item);
  if (!favorite.key || !favorite.title) {
    if (statusNode) setStatus(statusNode, 'Informe ao menos o título ou o link para favoritar.', 'error');
    return false;
  }
  const items = getFavorites();
  const existingIndex = items.findIndex((entry) => entry.key === favorite.key);
  let added = false;
  if (existingIndex >= 0) {
    items.splice(existingIndex, 1);
  } else {
    items.unshift({ ...favorite, id: favorite.id || `fav-${Date.now()}`, addedAt: Date.now() });
    added = true;
  }
  saveFavorites(items);
  renderFavorites();
  renderRadarOffers();
  renderPublications();
  syncCurrentFavoriteButton();
  if (statusNode) setStatus(statusNode, added ? 'Produto adicionado aos favoritos.' : 'Produto removido dos favoritos.', 'success');
  return added;
}

function syncCurrentFavoriteButton() {
  if (!el.favoriteCurrentBtn) return;
  const data = captureForm();
  const active = isFavorite(data);
  el.favoriteCurrentBtn.textContent = active ? '★ Favoritado' : '☆ Favoritar';
  el.favoriteCurrentBtn.classList.toggle('active', active);
  el.favoriteCurrentBtn.disabled = !(data.title || data.link);
}

function applyFavoriteToForm(favorite) {
  const item = normalizeFavorite(favorite);
  clearForm({ expand: true, status: false });
  state.editingId = null;
  state.full = Boolean(item.full);
  state.affiliateLinkReceived = false;
  state.receivedAffiliateLink = '';
  setSelectedStyle(item.style || 'divertido');
  el.link.value = item.link || '';
  el.title.value = item.title || '';
  el.old.value = item.oldPrice || '';
  el.offer.value = item.offerPrice || '';
  el.installmentQty.value = item.installmentQty || '';
  el.installmentValue.value = item.installmentValue || '';
  el.installmentNoInterest.checked = item.installmentNoInterest !== false;
  el.freight.value = item.freight || 'Frete grátis';
  if (el.seller) el.seller.value = item.seller || '';
  el.coupon.value = normalizeCoupon(item.coupon || '');
  el.phrase.value = item.phrase || randomPhraseForTitle(item.title || '');
  setImage(item.image || '');
  el.saveItemBtn.textContent = '♡ Salvar no histórico';
  renderCurrent();
  showPage('offers');
  setStatus(el.topActionStatus, 'Favorito carregado. Confira os dados e salve no histórico quando desejar.', 'success');
}

function renderFavorites() {
  if (!el.favoritesList) return;
  const query = simplifyCouponSearch(el.favoritesSearch?.value || '');
  const items = getFavorites().filter((item) => !query || simplifyCouponSearch(item.title).includes(query));
  const total = getFavorites().length;
  if (el.favoritesCount) el.favoritesCount.textContent = String(total);
  if (el.clearFavoritesBtn) el.clearFavoritesBtn.disabled = total === 0;
  el.favoritesEmpty?.classList.toggle('hidden', items.length > 0);
  if (!items.length) {
    el.favoritesList.innerHTML = '';
    return;
  }
  el.favoritesList.innerHTML = items.map((item) => {
    const price = formatMoney(item.offerPrice);
    const image = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy">`
      : `<span>${intelligentEmoji(item.title)}</span>`;
    return `<article class="favorite-card" data-id="${escapeHtml(item.id)}">
      <div class="favorite-thumb">${image}</div>
      <div class="favorite-main">
        <h3>${escapeHtml(item.title)}</h3>
        <div class="favorite-price">${escapeHtml(price || 'Preço sob consulta')}</div>
        <div class="favorite-meta">${item.seller ? `<span>🏬 ${escapeHtml(item.seller)}</span>` : ''}${item.freight ? `<span>🚚 ${escapeHtml(item.freight)}</span>` : ''}<span>★ ${new Date(item.addedAt).toLocaleDateString('pt-BR')}</span></div>
        <div class="favorite-actions">
          <button data-action="use" type="button">✓ Usar oferta</button>
          <button data-action="open" type="button">↗ Abrir</button>
          <button data-action="remove" type="button" title="Remover">✕</button>
        </div>
      </div>
    </article>`;
  }).join('');
}

function validateCurrent(data) {
  if (!data.link) return 'Cole o link principal do produto.';
  if (!data.title) return 'Busque o anúncio ou informe o título do produto.';
  if (!Number.isFinite(parseMoney(data.offerPrice))) return 'Informe o preço final da oferta.';
  return '';
}

function publicationId() {
  return `pub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getPublications() {
  const items = safeJson(localStorage.getItem('cbofertas-publications') || '[]', []);
  return Array.isArray(items) ? items : [];
}

function savePublications(items) {
  localStorage.setItem('cbofertas-publications', JSON.stringify(items.slice(0, 100)));
}

function cancelScheduledIds(ids = []) {
  (Array.isArray(ids) ? ids : []).forEach((id) => {
    if (window.Android?.cancelScheduledMessage) window.Android.cancelScheduledMessage(String(id));
  });
}

function saveCurrentPublication() {
  const data = captureForm();
  rememberSeller(data.seller);
  const validationError = validateCurrent(data);
  if (validationError) {
    setEditorCollapsed(false);
    setStatus(el.topActionStatus, validationError, 'error');
    return;
  }

  const items = getPublications();
  const existingIndex = state.editingId ? items.findIndex((item) => item.id === state.editingId) : -1;
  const now = Date.now();

  if (existingIndex >= 0) {
    const previous = items[existingIndex];
    cancelScheduledIds(previous.scheduledIds);
    items[existingIndex] = {
      ...previous,
      ...data,
      id: previous.id,
      updatedAt: now,
      scheduledIds: [],
      scheduledAt: null
    };
    setStatus(el.topActionStatus, 'Oferta atualizada e salva no histórico.', 'success');
  } else {
    items.unshift({
      ...data,
      id: publicationId(),
      createdAt: now,
      updatedAt: now,
      scheduleDate: '',
      scheduleTime: '',
      scheduledIds: [],
      scheduledAt: null
    });
    setStatus(el.topActionStatus, 'Oferta salva no histórico. Toque em “Nova oferta” para cadastrar outra.', 'success');
  }

  savePublications(items);
  renderPublications();
  clearForm({ expand: false, status: false });
  setEditorCollapsed(true);
}

function localDateValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateTime(timestamp) {
  return new Date(timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function publicationMessageCount(publication) {
  return buildMessagesForData(publication).length;
}

function renderPublications() {
  const items = getPublications();
  const totalMessages = items.reduce((total, item) => total + publicationMessageCount(item), 0);
  el.publicationCount.textContent = String(items.length);
  el.sendSavedBtn.disabled = !items.length;
  el.scheduleSavedBtn.disabled = !items.length;
  el.clearSavedBtn.disabled = !items.length;

  if (!items.length) {
    el.publicationQueue.innerHTML = '<div class="empty publication-empty">Nenhum item salvo. Cadastre a primeira oferta e toque em <b>Salvar item</b>.</div>';
    return;
  }

  const today = localDateValue(new Date());
  el.publicationQueue.innerHTML = items.map((item, index) => {
    const messages = publicationMessageCount(item);
    const price = formatMoney(item.offerPrice);
    const scheduled = Array.isArray(item.scheduledIds) && item.scheduledIds.length > 0;
    const favorite = isFavorite(item);
    const image = item.image ? `<img src="${escapeHtml(item.image)}" alt="">` : `<span>${intelligentEmoji(item.title || '')}</span>`;
    return `<article class="publication-item" data-id="${escapeHtml(item.id)}">
      <div class="publication-summary">
        <div class="publication-thumb">${image}</div>
        <div class="publication-info">
          <small>ITEM ${index + 1}</small>
          <b>${escapeHtml(item.title || 'Oferta')}</b>
          <div><strong>${escapeHtml(price || 'Preço não informado')}</strong><span>${messages} mensagem(ns)</span></div>
        </div>
      </div>
      <div class="publication-schedule-fields">
        <label>Data da publicação<input class="publication-date" type="date" min="${today}" value="${escapeHtml(item.scheduleDate || '')}"></label>
        <label>Horário<input class="publication-time" type="time" value="${escapeHtml(item.scheduleTime || '')}"></label>
      </div>
      <div class="publication-schedule-state ${scheduled ? 'scheduled' : ''}">
        ${scheduled ? `✅ Agendado para ${escapeHtml(formatDateTime(item.scheduledAt || Date.now()))}` : 'Escolha data e horário para programar este item.'}
      </div>
      <div class="publication-item-actions">
        <button type="button" data-action="edit">✏️ Alterar</button>
        <button type="button" data-action="favorite">${favorite ? '★ Favorito' : '☆ Favoritar'}</button>
        <button type="button" data-action="schedule">📅 Agendar</button>
        <button type="button" data-action="send">📨 Enviar agora</button>
        <button type="button" data-action="delete" class="danger">🗑️ Excluir</button>
      </div>
    </article>`;
  }).join('');

  setStatus(el.publicationStatus, `${items.length} item(ns) salvo(s), totalizando ${totalMessages} mensagem(ns) separadas.`, 'success');
}

function updatePublicationScheduleField(id, field, value) {
  const items = getPublications();
  const item = items.find((publication) => publication.id === id);
  if (!item) return;
  if (Array.isArray(item.scheduledIds) && item.scheduledIds.length) {
    cancelScheduledIds(item.scheduledIds);
    item.scheduledIds = [];
    item.scheduledAt = null;
  }
  item[field] = value;
  item.updatedAt = Date.now();
  savePublications(items);
  renderPublications();
  setStatus(el.publicationStatus, 'Data ou horário atualizado. Toque em “Agendar” para confirmar.', 'success');
}

function deletePublication(id) {
  const items = getPublications();
  const item = items.find((publication) => publication.id === id);
  if (!item) return;
  if (!confirm(`Excluir “${item.title || 'Oferta'}” da lista?`)) return;
  cancelScheduledIds(item.scheduledIds);
  savePublications(items.filter((publication) => publication.id !== id));
  renderPublications();
  setStatus(el.publicationStatus, 'Item removido da lista.', 'success');
}

async function imageToFile(src) {
  try {
    const response = await fetch(src);
    const blob = await response.blob();
    return new File([blob], 'cbofertas-produto.jpg', { type: blob.type || 'image/jpeg' });
  } catch {
    return null;
  }
}

async function shareSnapshot(text, image = '', preferWhatsapp = false) {
  if (preferWhatsapp && window.Android?.shareToWhatsAppBusiness) {
    window.Android.shareToWhatsAppBusiness(image || '', text || '', '');
    return;
  }
  if (window.Android?.shareImageAndText) {
    window.Android.shareImageAndText(image || '', text || '');
    return;
  }
  try {
    const file = image ? await imageToFile(image) : null;
    const payload = { title: 'CbOfertas', text: text || '' };
    if (file && navigator.canShare?.({ files: [file] })) payload.files = [file];
    if (!navigator.share) throw new Error('unsupported');
    await navigator.share(payload);
  } catch (error) {
    if (error.name !== 'AbortError' && preferWhatsapp) location.href = `https://wa.me/?text=${encodeURIComponent(text || '')}`;
  }
}

async function shareQueueItems(queueItems, preferWhatsapp = true) {
  const normalized = (Array.isArray(queueItems) ? queueItems : [])
    .map((item) => ({ text: String(item?.text || '').trim(), image: String(item?.image || '') }))
    .filter((item) => item.text);
  if (!normalized.length) return;

  if (window.Android?.shareSavedMessagesSeparately) {
    window.Android.shareSavedMessagesSeparately(JSON.stringify(normalized), Boolean(preferWhatsapp));
    return;
  }

  const sameImage = normalized.every((item) => item.image === normalized[0].image);
  if (sameImage && window.Android?.shareMessagesSeparately) {
    window.Android.shareMessagesSeparately(normalized[0].image || '', JSON.stringify(normalized.map((item) => item.text)), Boolean(preferWhatsapp));
    return;
  }

  if (normalized.length > 1) alert('Neste navegador, as mensagens serão abertas uma por vez. A primeira será aberta agora.');
  await shareSnapshot(normalized[0].text, normalized[0].image, preferWhatsapp);
}

function queueForPublication(publication) {
  return buildMessagesForData(publication).map((message) => ({ text: message.text, image: publication.image || '' }));
}

async function sendPublication(id) {
  const publication = getPublications().find((item) => item.id === id);
  if (!publication) return;
  const verified = await verifyPublicationBeforeShare(publication);
  if (!verified) return;
  setStatus(el.publicationStatus, 'Oferta conferida. Abrindo o WhatsApp Business...', 'success');
  shareQueueItems(queueForPublication(verified), true);
}

function sendAllPublications() {
  const items = getPublications();
  if (!items.length) return setStatus(el.publicationStatus, 'Nenhum item salvo para enviar.', 'error');
  const queue = items.flatMap(queueForPublication);
  setStatus(el.publicationStatus, `${queue.length} mensagem(ns) serão abertas separadamente. Confirme cada envio no WhatsApp.`, 'success');
  shareQueueItems(queue, true);
}

function scheduleTimestamp(publication) {
  if (!publication.scheduleDate || !publication.scheduleTime) return NaN;
  return new Date(`${publication.scheduleDate}T${publication.scheduleTime}:00`).getTime();
}

function schedulePublicationInList(items, publication) {
  const startWhen = scheduleTimestamp(publication);
  if (!Number.isFinite(startWhen)) throw new Error(`Escolha data e horário para “${publication.title || 'Oferta'}”.`);
  if (startWhen <= Date.now() + 30000) throw new Error(`Escolha um horário futuro para “${publication.title || 'Oferta'}”.`);

  cancelScheduledIds(publication.scheduledIds);
  const messages = buildMessagesForData(publication);
  const image = /^https?:/i.test(publication.image || '') ? publication.image : '';
  const scheduledIds = [];

  try {
    messages.forEach((message, index) => {
      const when = startWhen + index * 2 * 60000;
      const id = `saved-${publication.id}-${Date.now()}-${index}`;
      const title = messages.length > 1
        ? `${publication.title || 'Oferta'} — ${message.label || `Mensagem ${index + 1}`}`
        : publication.title || 'Oferta agendada';
      if (window.Android?.scheduleMessage) {
        const result = String(window.Android.scheduleMessage(id, when, title, message.text, image));
        if (result !== 'ok') throw new Error(result || 'Não foi possível agendar.');
      } else {
        setTimeout(() => {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('CbOfertas', { body: `${title} está pronta para compartilhar.` });
          }
        }, when - Date.now());
      }
      scheduledIds.push(id);
    });
  } catch (error) {
    cancelScheduledIds(scheduledIds);
    throw error;
  }

  publication.scheduledIds = scheduledIds;
  publication.scheduledAt = startWhen;
  publication.updatedAt = Date.now();
  return messages.length;
}

function scheduleOnePublication(id) {
  const items = getPublications();
  const publication = items.find((item) => item.id === id);
  if (!publication) return;
  try {
    if (window.Android?.requestNotificationPermission) window.Android.requestNotificationPermission();
    const count = schedulePublicationInList(items, publication);
    savePublications(items);
    renderPublications();
    setStatus(el.publicationStatus, `${count} mensagem(ns) de “${publication.title}” agendada(s).`, 'success');
  } catch (error) {
    setStatus(el.publicationStatus, error.message || 'Não foi possível agendar.', 'error');
  }
}

function scheduleAllPublications() {
  const items = getPublications();
  if (!items.length) return setStatus(el.publicationStatus, 'Nenhum item salvo para agendar.', 'error');
  const withDate = items.filter((item) => item.scheduleDate && item.scheduleTime);
  if (!withDate.length) return setStatus(el.publicationStatus, 'Defina uma data e um horário em pelo menos um item.', 'error');

  const invalid = withDate.find((publication) => {
    const timestamp = scheduleTimestamp(publication);
    return !Number.isFinite(timestamp) || timestamp <= Date.now() + 30000;
  });
  if (invalid) return setStatus(el.publicationStatus, `Escolha um horário futuro para “${invalid.title || 'Oferta'}”.`, 'error');

  const newlyScheduledIds = [];
  try {
    if (window.Android?.requestNotificationPermission) window.Android.requestNotificationPermission();
    let total = 0;
    withDate.forEach((publication) => {
      total += schedulePublicationInList(items, publication);
      newlyScheduledIds.push(...(publication.scheduledIds || []));
    });
    savePublications(items);
    renderPublications();
    setStatus(el.publicationStatus, `${total} mensagem(ns) agendada(s) em ${withDate.length} item(ns).`, 'success');
  } catch (error) {
    cancelScheduledIds(newlyScheduledIds);
    setStatus(el.publicationStatus, error.message || 'Não foi possível concluir os agendamentos.', 'error');
  }
}

function clearAllPublications() {
  const items = getPublications();
  if (!items.length) return;
  if (!confirm('Apagar todos os itens salvos e cancelar seus agendamentos?')) return;
  items.forEach((item) => cancelScheduledIds(item.scheduledIds));
  savePublications([]);
  renderPublications();
  setStatus(el.publicationStatus, 'Lista salva apagada.', 'success');
}

async function fetchProduct() {
  const link = el.link.value.trim();
  const base = apiBase();
  if (!link) return setStatus(el.fetchStatus, 'Cole o link do produto.', 'error');
  if (!base) return setStatus(el.fetchStatus, 'Abra “Configurar servidor” e salve o endereço.', 'error');

  el.fetchBtn.disabled = true;
  el.fetchBtn.textContent = '⏳ Buscando';
  el.title.value = '';
  el.old.value = '';
  el.offer.value = '';
  el.installmentQty.value = '';
  el.installmentValue.value = '';
  if (el.seller) el.seller.value = '';
  setImage('');
  setStatus(el.fetchStatus, 'Consultando o anúncio...');

  try {
    const response = await fetch(`${base}/api/product?url=${encodeURIComponent(link)}`, { cache: 'no-store' });
    const product = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(product.error || 'Falha ao consultar o produto.');
    const affiliateLink = product.affiliateLink || (isAffiliateLink(link) ? link : affiliateFor(product));
    if (affiliateLink) {
      saveAffiliateAssociation(product.id || product.source?.itemId, affiliateLink, product.catalogProductId);
      el.link.value = affiliateLink;
      state.affiliateLinkReceived = true;
      state.receivedAffiliateLink = affiliateLink;
      setStatus(el.affiliateStatus, '✅ Link afiliado confirmado e salvo para reutilização automática.', 'success');
    }
    el.link.dataset.itemId = product.id || product.source?.itemId || '';
    el.link.dataset.catalogProductId = product.catalogProductId || '';
    el.title.value = product.title || '';
    el.old.value = product.oldPrice || product.previousPrice || '';
    el.offer.value = product.price || product.currentPrice || product.pixPrice || '';
    if (!Number.isFinite(parseMoney(el.offer.value))) throw new Error('O produto foi encontrado, mas o preço atual não foi confirmado.');
    el.installmentQty.value = product.installments || '';
    el.installmentValue.value = product.installmentAmount || '';
    if (el.seller) {
      el.seller.value = String(product.seller || product.store || '').trim();
      if (el.seller.value) rememberSeller(el.seller.value);
    }
    applyAutomaticCouponsForCurrentOffer({ replace: true });
    const interest = String(product.installmentInterest || '').toLowerCase();
    el.installmentNoInterest.checked = !interest.includes('com juros');
    state.full = Boolean(product.full);
    el.freight.value = state.full ? 'Entrega FULL' : (product.freeShipping ? 'Frete grátis' : 'Consulte o frete');
    const imageUrl = product.imageProxy
      ? (product.imageProxy.startsWith('/') ? `${base}${product.imageProxy}` : product.imageProxy)
      : product.image;
    if (imageUrl) setImage(imageUrl);
    generatePhrase(true);
    state.previewIndex = 0;
    renderCurrent();
    const autoCouponCount = state.lastAutoCouponCodes.length;
    setStatus(el.fetchStatus, autoCouponCount ? `Produto encontrado e ${autoCouponCount} cupom(ns) compatível(is) selecionado(s).` : 'Produto encontrado. Nenhum cupom compatível foi identificado.', 'success');
    setStatus(el.topActionStatus, 'Busca concluída. Confira os dados da oferta.', 'success');
  } catch (error) {
    setStatus(el.fetchStatus, error.message || 'Não foi possível buscar o anúncio.', 'error');
  } finally {
    el.fetchBtn.disabled = state.editorCollapsed;
    el.fetchBtn.innerHTML = '⌕ <span>Buscar</span>';
  }
}

window.CbOfertasOpenScheduled = (text, image) => {
  el.finalText.value = text || '';
  if (image) setImage(image);
  shareSnapshot(text || '', image || '', true);
};

if (!localStorage.getItem(SERVER_MIGRATION_STORAGE_KEY)) {
  try {
    localStorage.setItem('cbofertas-api', DEFAULT_API_SERVER);
    localStorage.setItem(SERVER_MIGRATION_STORAGE_KEY, '1');
  } catch { }
}
el.apiServer.value = apiBase();

$('#saveServerBtn').onclick = () => {
  const value = normalizeServer(el.apiServer.value);
  if (!/^https?:\/\//i.test(value)) return setStatus(el.serverStatus, 'Digite um endereço começando com http:// ou https://', 'error');
  localStorage.setItem('cbofertas-api', value);
  setStatus(el.serverStatus, 'Servidor salvo.', 'success');
};

$('#testServerBtn').onclick = async () => {
  const value = normalizeServer(el.apiServer.value);
  if (!value) return setStatus(el.serverStatus, 'Informe o servidor.', 'error');
  setStatus(el.serverStatus, 'Testando...');
  try {
    const response = await fetch(`${value}/`, { cache: 'no-store' });
    if (!response.ok) throw new Error();
    localStorage.setItem('cbofertas-api', value);
    setStatus(el.serverStatus, 'Conexão funcionando.', 'success');
  } catch {
    setStatus(el.serverStatus, 'Não foi possível conectar.', 'error');
  }
};


$('#sendCouponBlastBtn').onclick = sendCouponBlast;
$('#saveCouponBlastBtn').onclick = () => saveCouponBlastConfig(true);
$('#removeCouponBlastImageBtn').onclick = () => {
  setCouponBlastImage('');
  saveCouponBlastConfig(false);
  setStatus(el.couponBlastStatus, 'Foto removida do modelo.', 'success');
};
el.couponBlastImageFile.onchange = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  setStatus(el.couponBlastStatus, 'Preparando a foto...');
  try {
    const compressed = await compressImageFile(file);
    setCouponBlastImage(compressed);
    saveCouponBlastConfig(false);
    setStatus(el.couponBlastStatus, 'Foto salva no programa.', 'success');
  } catch (error) {
    setStatus(el.couponBlastStatus, error.message || 'Não foi possível salvar a foto.', 'error');
  } finally {
    event.target.value = '';
  }
};
[el.couponGroupName, el.couponPageLink, el.couponBlastText].forEach((node) => {
  node.addEventListener('change', () => saveCouponBlastConfig(false));
});

el.showOffersPageBtn.onclick = () => showPage('offers');
el.showRadarPageBtn.onclick = () => showPage('radar');
el.showHistoryPageBtn.onclick = () => showPage('history');
el.showFavoritesPageBtn.onclick = () => showPage('favorites');
el.showCouponsPageBtn.onclick = () => showPage('coupons');
el.showSettingsPageBtn.onclick = () => showPage('settings');
$$('[data-page]').forEach((button) => {
  if (!button.classList.contains('bottom-tab')) button.addEventListener('click', () => showPage(button.dataset.page));
});


el.searchRadarBtn.onclick = () => loadRadarOffers(true);
el.refreshRadarBtn.onclick = () => loadRadarOffers(true);
el.restoreHiddenRadarBtn.onclick = () => {
  saveRadarStoredSet(RADAR_HIDDEN_STORAGE_KEY, new Set());
  renderRadarOffers();
  setStatus(el.radarStatus, 'Ofertas ocultadas foram restauradas.', 'success');
};
[el.radarQuery, el.radarCategory, el.radarMinDiscount, el.radarMaxPrice, el.radarOnlyFull, el.radarHideUsed, el.radarAutoOpen].forEach(node => {
  node?.addEventListener('change', () => { saveRadarPreferences(); renderRadarOffers(); });
});
el.radarQuery?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); loadRadarOffers(true); } });
el.settingsRadarAuto?.addEventListener('change', () => {
  if (el.radarAutoOpen) el.radarAutoOpen.checked = el.settingsRadarAuto.checked;
  saveRadarPreferences();
});
el.radarResults?.addEventListener('click', async event => {
  const button = event.target.closest('[data-radar-action]');
  if (!button) return;
  const card = button.closest('.radar-card');
  const item = state.radarItems.find(candidate => radarItemKey(candidate) === card?.dataset.key);
  if (!item) return;
  if (button.dataset.radarAction === 'approve') await approveRadarOffer(item);
  if (button.dataset.radarAction === 'open' && item.link) window.open(affiliateFor(item) || item.link, '_blank');
  if (button.dataset.radarAction === 'favorite') toggleFavorite(favoriteFromRadar(item), el.radarStatus);
  if (button.dataset.radarAction === 'hide') hideRadarOffer(item);
});

el.newItemBtn.onclick = () => {
  clearForm({ expand: true, status: false });
  showPage('offers');
  setStatus(el.topActionStatus, 'Novo item aberto. Cole o link e toque em Buscar.', 'success');
  setTimeout(() => el.link.focus(), 100);
};
el.fetchBtn.onclick = fetchProduct;
el.affiliateLinkBtn?.addEventListener('click', openAffiliateGenerator);
el.saveItemBtn.onclick = saveCurrentPublication;
el.favoriteCurrentBtn.onclick = () => toggleFavorite(captureForm(), el.topActionStatus);
el.clearBtn.onclick = () => clearForm({ expand: true, status: true });
$('#openLinkBtn').onclick = () => { if (el.link.value.trim()) window.open(el.link.value.trim(), '_blank'); };
$('#pasteLinkBtn').onclick = async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      el.link.value = text.trim();
      renderCurrent();
      if (apiBase()) fetchProduct();
    }
  } catch {
    el.link.focus();
    setStatus(el.fetchStatus, 'Toque e segure no campo para colar o link.', 'error');
  }
};
$('#phraseBtn').onclick = () => { generatePhrase(true); renderCurrent(); };
$$('.style-chip').forEach((button) => button.addEventListener('click', () => {
  setSelectedStyle(button.dataset.style);
  renderCurrent();
}));
$('#imageFile').onchange = (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { setImage(reader.result); renderCurrent(); };
  reader.readAsDataURL(file);
};

[el.link, el.title, el.old, el.offer, el.installmentQty, el.installmentValue, el.phrase, el.seller]
  .forEach((node) => node.addEventListener('input', () => {
    if (node === el.link || node === el.title) state.previewIndex = 0;
    if (node === el.link && String(el.link.value || '').trim() !== state.receivedAffiliateLink) {
      state.affiliateLinkReceived = false;
      state.receivedAffiliateLink = '';
      setStatus(el.affiliateStatus, '');
    }
    renderCurrent();
  }));

el.seller.addEventListener('change', () => rememberSeller(el.seller.value));

el.coupon.addEventListener('input', renderCurrent);
el.coupon.addEventListener('change', () => {
  el.coupon.value = normalizeCoupon(el.coupon.value);
  renderCurrent();
  setStatus(el.topActionStatus, currentCouponText() ? 'Cupons desta oferta atualizados.' : 'Esta oferta ficou sem cupom.', 'success');
});
el.clearCouponBtn.onclick = () => {
  if (!currentCouponText()) return;
  el.coupon.value = '';
  renderCurrent();
  setStatus(el.topActionStatus, 'Cupons removidos somente desta oferta.', 'success');
};

el.openCouponManagerBtn.onclick = () => {
  showPage('coupons');
  el.couponManagerCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
el.saveCouponCodeBtn.onclick = saveCouponCode;
el.cancelCouponEditBtn.onclick = () => {
  resetCouponEditor();
  setStatus(el.couponLibraryStatus, 'Alteração cancelada.');
};
el.couponCodeInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    saveCouponCode();
  }
});
el.couponCategoryInput?.addEventListener('change', updateCouponTargetVisibility);
updateCouponTargetVisibility();
el.applyCouponsToOfferBtn.onclick = () => {
  el.coupon.value = getActiveCouponText();
  renderCurrent();
  showPage('offers');
  setStatus(el.topActionStatus, currentCouponText() ? 'Cupons ativos aplicados à oferta.' : 'Nenhum cupom ativo para aplicar.', currentCouponText() ? 'success' : 'error');
};
el.couponSavedList.addEventListener('change', (event) => {
  const checkbox = event.target.closest('[data-action="toggle"]');
  if (!checkbox) return;
  const item = checkbox.closest('.coupon-saved-item');
  toggleCoupon(item?.dataset.id || '', checkbox.checked);
});
el.couponSavedList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = button.closest('.coupon-saved-item')?.dataset.id || '';
  if (button.dataset.action === 'edit') beginCouponEdit(id);
  if (button.dataset.action === 'delete') deleteCoupon(id);
});
el.offerCouponQuickList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-code]');
  if (!button) return;
  const code = normalizeCouponCode(button.dataset.code || '');
  const selected = splitCouponText(el.coupon.value);
  const next = selected.includes(code) ? selected.filter((item) => item !== code) : [...selected, code];
  el.coupon.value = next.join(' ou ');
  renderCurrent();
});

el.installmentNoInterest.addEventListener('change', renderCurrent);
el.title.addEventListener('change', () => {
  generatePhrase(true);
  state.previewIndex = 0;
  applyAutomaticCouponsForCurrentOffer({ replace: true });
});
[el.old, el.offer].forEach((node) => node.addEventListener('change', () => {
  applyAutomaticCouponsForCurrentOffer({ replace: true });
}));
el.freight.addEventListener('change', renderCurrent);
el.link.addEventListener('paste', () => setTimeout(() => {
  if (el.link.value.trim() && apiBase()) fetchProduct();
}, 180));

$('#copyBtn').onclick = async () => {
  renderCurrent();
  try {
    await navigator.clipboard.writeText(el.finalText.value);
  } catch {
    el.finalText.select();
    document.execCommand('copy');
  }
  alert(`Mensagem ${state.previewIndex + 1} copiada!`);
};

$('#whatsappBtn').onclick = () => {
  const data = captureForm();
  shareQueueItems(buildMessagesForData(data).map((message) => ({ text: message.text, image: data.image })), true);
};

$('#shareBtn').onclick = () => {
  const data = captureForm();
  shareQueueItems(buildMessagesForData(data).map((message) => ({ text: message.text, image: data.image })), false);
};

el.publicationQueue.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const article = button.closest('.publication-item');
  const id = article?.dataset.id;
  if (!id) return;
  const action = button.dataset.action;
  if (action === 'edit') {
    const item = getPublications().find((publication) => publication.id === id);
    if (item) applyPublicationToForm(item);
  } else if (action === 'delete') deletePublication(id);
  else if (action === 'favorite') {
    const item = getPublications().find((publication) => publication.id === id);
    if (item) toggleFavorite(item, el.publicationStatus);
  } else if (action === 'send') sendPublication(id);
  else if (action === 'schedule') scheduleOnePublication(id);
});

el.publicationQueue.addEventListener('change', (event) => {
  const article = event.target.closest('.publication-item');
  const id = article?.dataset.id;
  if (!id) return;
  if (event.target.classList.contains('publication-date')) updatePublicationScheduleField(id, 'scheduleDate', event.target.value);
  if (event.target.classList.contains('publication-time')) updatePublicationScheduleField(id, 'scheduleTime', event.target.value);
});

el.favoritesSearch?.addEventListener('input', renderFavorites);
el.favoritesList?.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  const card = button?.closest('.favorite-card');
  if (!button || !card) return;
  const item = getFavorites().find((favorite) => favorite.id === card.dataset.id);
  if (!item) return;
  if (button.dataset.action === 'use') applyFavoriteToForm(item);
  if (button.dataset.action === 'open' && item.link) window.open(item.link, '_blank');
  if (button.dataset.action === 'remove') toggleFavorite(item, el.favoritesStatus);
});
el.clearFavoritesBtn?.addEventListener('click', () => {
  const items = getFavorites();
  if (!items.length) return;
  if (!confirm(`Remover os ${items.length} favorito(s) salvos?`)) return;
  saveFavorites([]);
  renderFavorites();
  renderRadarOffers();
  renderPublications();
  syncCurrentFavoriteButton();
  setStatus(el.favoritesStatus, 'Lista de favoritos apagada.', 'success');
});

$('#quickSaveBtn').onclick = saveCurrentPublication;
$('#regenerateSideBtn').onclick = () => { generatePhrase(true); renderCurrent(); };
$('#copySideBtn').onclick = () => $('#copyBtn').click();
$('#settingsNewItemBtn').onclick = () => {
  clearForm({ expand: true, status: false });
  showPage('offers');
  setTimeout(() => el.link.focus(), 120);
};
$('#menuNewItemBtn').onclick = () => {
  clearForm({ expand: true, status: false });
  showPage('offers');
  setTimeout(() => el.link.focus(), 120);
};
$('#menuClearBtn').onclick = () => {
  clearForm({ expand: true, status: true });
  showPage('offers');
};
el.finalText.addEventListener('input', () => {
  if (el.charCounter) el.charCounter.textContent = `${el.finalText.value.length}/1200`;
});

function openSideMenu() {
  $('#sideMenu').classList.add('open');
  $('#menuOverlay').classList.remove('hidden');
}
function closeSideMenu() {
  $('#sideMenu')?.classList.remove('open');
  $('#menuOverlay')?.classList.add('hidden');
}
$('#menuBtn').onclick = openSideMenu;
$('#closeMenuBtn').onclick = closeSideMenu;
$('#menuOverlay').onclick = closeSideMenu;

function applyTheme(theme) {
  const dark = theme === 'dark';
  document.body.classList.toggle('dark', dark);
  $('#themeToggleBtn').textContent = dark ? '☀' : '☾';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#17301e' : '#dff7cf');
}
const savedTheme = localStorage.getItem('cbofertas-theme') || 'light';
applyTheme(savedTheme);
$('#themeToggleBtn').onclick = () => {
  const next = document.body.classList.contains('dark') ? 'light' : 'dark';
  localStorage.setItem('cbofertas-theme', next);
  applyTheme(next);
};

el.sendSavedBtn.onclick = sendAllPublications;
el.scheduleSavedBtn.onclick = scheduleAllPublications;
el.clearSavedBtn.onclick = clearAllPublications;

applyRadarPreferences();
loadCouponBlastConfig();
renderCouponLibrary();
renderSellerSuggestions();
renderFavorites();
el.coupon.value = '';
showPage('offers');
clearForm({ expand: true, status: false });
renderPublications();
setStatus(el.topActionStatus, 'Cole um link para começar. O servidor já está configurado.');
