'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class FakeClassList {
  add() {}
  remove() {}
  toggle() { return false; }
  contains() { return false; }
}

class FakeElement {
  constructor() {
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.innerHTML = '';
    this.textContent = '';
    this.className = '';
    this.dataset = {};
    this.classList = new FakeClassList();
    this.files = [];
    this.src = '';
  }
  addEventListener() {}
  removeEventListener() {}
  scrollIntoView() {}
  focus() {}
  select() {}
  click() {}
  removeAttribute(name) { delete this[name]; }
  setAttribute(name, value) { this[name] = value; }
  closest() { return null; }
  querySelector() { return new FakeElement(); }
  querySelectorAll() { return []; }
}

const elements = new Map();
const getElement = selector => {
  if (!elements.has(selector)) elements.set(selector, new FakeElement());
  return elements.get(selector);
};

const storage = new Map();
const localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); },
  clear() { storage.clear(); }
};

const document = {
  body: new FakeElement(),
  documentElement: new FakeElement(),
  querySelector: getElement,
  querySelectorAll() { return []; },
  createElement() { return new FakeElement(); },
  execCommand() { return true; }
};

const windowObject = {
  document,
  localStorage,
  Android: undefined,
  scrollTo() {},
  open() {},
  addEventListener() {},
  removeEventListener() {}
};
windowObject.window = windowObject;

const context = vm.createContext({
  window: windowObject,
  document,
  localStorage,
  navigator: { clipboard: { readText: async () => '', writeText: async () => {} } },
  console,
  URL,
  URLSearchParams,
  fetch,
  Blob,
  File: globalThis.File || class File {},
  FileReader: class FileReader {},
  Image: class Image {},
  AbortSignal,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  alert() {},
  confirm() { return true; }
});

const appPath = path.resolve(__dirname, '../android/app/src/main/assets/www/app.js');
const source = fs.readFileSync(appPath, 'utf8');
vm.runInContext(source, context, { filename: appPath, timeout: 5000 });

if (!storage.has('cbofertas-theme')) {
  // A ausência é válida; apenas confirma que a inicialização chegou ao fim.
}
if (typeof windowObject.CbOfertasReceiveSharedLink !== 'function') {
  throw new Error('Fluxo de recebimento do link compartilhado não foi inicializado.');
}

const generatedText = vm.runInContext(`buildTextForData({
  title: 'Creatina Monohidratada',
  phrase: 'O shape não vem sozinho não.',
  offerPrice: '79,90',
  freight: 'Frete grátis'
}, { url: 'https://meli.la/exemplo' }, 1)`, context);
const generatedLines = generatedText.split('\n').filter(Boolean);
if (generatedLines[0] !== 'O shape não vem sozinho não.' || !generatedLines[1].includes('Creatina Monohidratada')) {
  throw new Error('A frase automática não está aparecendo uma única vez antes do título.');
}

const phrasePair = vm.runInContext(`[randomPhraseForTitle('creatina'), randomPhraseForTitle('creatina')]`, context);
if (phrasePair[0] === phrasePair[1]) throw new Error('A rotação de frases repetiu imediatamente a mesma frase.');

const affiliateResult = vm.runInContext(`(() => {
  saveAffiliateAssociation('MLB4812130742', 'https://meli.la/2ZY9J9V', '', 'Cadeira Presidente Python');
  return affiliateFor({ itemId: 'MLB4812130742', link: 'https://produto.mercadolivre.com.br/MLB-4812130742' });
})()`, context);
if (affiliateResult !== 'https://meli.la/2ZY9J9V') throw new Error('Biblioteca de Afiliados não reutilizou o link salvo por MLB.');

const shopeeSupport = vm.runInContext(`({
  accepted: isSupportedProductLink('https://shopee.com.br/Cadeira-i.123456.987654321'),
  id: extractItemId('https://shopee.com.br/Cadeira-i.123456.987654321'),
  affiliate: isAffiliateLink('https://s.shopee.com.br/exemplo')
})`, context);
if (!shopeeSupport.accepted || shopeeSupport.id !== 'SHP123456_987654321' || !shopeeSupport.affiliate) {
  throw new Error('O fluxo web da Shopee não foi inicializado corretamente.');
}

console.log(`Web app V5.2 inicializado em ambiente de teste com ${elements.size} elementos simulados, frase automática e afiliados validados.`);
