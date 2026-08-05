'use strict';
(function (global) {
  const KEY = 'cbofertas-affiliate-library-v500';
  const normalize = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  function load() {
    return normalize(global.CbStorage?.get(KEY, {}) || {});
  }

  function save(library) {
    const value = normalize(library);
    global.CbStorage?.set(KEY, value);
    global.CbEventBus?.emit('affiliate:saved', value);
    return value;
  }

  function add(originalLink, affiliateLink) {
    const original = String(originalLink || '').trim();
    const affiliate = String(affiliateLink || '').trim();
    if (!original || !affiliate) return false;
    const library = load();
    library[original] = { affiliateLink: affiliate, updatedAt: Date.now() };
    save(library);
    return true;
  }

  global.CbAffiliate = { load, save, add };
  // Compatibilidade definitiva com a função que faltava na V7.3.
  global.saveAffiliateLibrary = save;
})(window);
