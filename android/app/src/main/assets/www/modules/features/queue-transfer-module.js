'use strict';
(function (global) {
  const EXPORTS_KEY = 'cbofertas-v8-saved-exports';

  function normalizePayload(value) {
    if (!value || typeof value !== 'object') throw new Error('Arquivo de fila inválido.');
    const queue = Array.isArray(value.queue) ? value.queue : [];
    return {
      format: 'cbofertas',
      version: value.version || '8.0',
      createdAt: Number(value.createdAt || Date.now()),
      config: value.config && typeof value.config === 'object' ? value.config : {},
      coupons: Array.isArray(value.coupons) ? value.coupons : [],
      affiliateLibrary: value.affiliateLibrary && typeof value.affiliateLibrary === 'object'
        ? value.affiliateLibrary : {},
      queue
    };
  }

  function saveSnapshot(payload, name = '') {
    const normalized = normalizePayload(payload);
    const list = global.CbStorage?.get(EXPORTS_KEY, []) || [];
    list.unshift({
      id: 'exp-' + Date.now(),
      name: name || `Fila ${new Date().toLocaleString('pt-BR')}`,
      createdAt: Date.now(),
      itemCount: normalized.queue.length,
      payload: normalized
    });
    if (list.length > 30) list.length = 30;
    global.CbStorage?.set(EXPORTS_KEY, list);
    return list[0];
  }

  async function readFile(file) {
    if (!file) throw new Error('Selecione um arquivo .cbofertas.');
    const text = await file.text();
    return normalizePayload(JSON.parse(text));
  }

  function applyImported(payload) {
    const normalized = normalizePayload(payload);
    if (normalized.affiliateLibrary) global.saveAffiliateLibrary(normalized.affiliateLibrary);
    if (Array.isArray(normalized.coupons)) {
      global.CbStorage?.set('cbofertas-coupons-v4', normalized.coupons);
    }
    global.CbStorage?.set('cbofertas-v6-queue', normalized.queue);
    global.CbEventBus?.emit('queue:imported', normalized);
    return normalized;
  }

  global.CbQueueTransfer = {
    normalizePayload, saveSnapshot, readFile, applyImported,
    saved() { return global.CbStorage?.get(EXPORTS_KEY, []) || []; },
    clear() { global.CbStorage?.set(EXPORTS_KEY, []); }
  };
})(window);
