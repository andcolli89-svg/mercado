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

console.log(`Web app V4.1 inicializado em ambiente de teste com ${elements.size} elementos simulados.`);
