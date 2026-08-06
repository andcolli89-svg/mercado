'use strict';
(function (global) {
  const KEYS = Object.freeze({
    batch: 'cbofertas-v63-batch',
    queue: 'cbofertas-v6-queue',
    history: 'cbofertas-publications',
    config: 'cbofertas-v6-config',
    mode: 'cbofertas-v10-send-mode',
    historyLimit: 'cbofertas-v10-history-limit',
    diagnostic: 'cbofertas-v10-diagnostic'
  });

  function parse(raw, fallback) {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function array(key) {
    const value = parse(localStorage.getItem(key) || '[]', []);
    return Array.isArray(value) ? value : [];
  }

  function object(key) {
    const value = parse(localStorage.getItem(key) || '{}', {});
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function id(item) {
    return String(item?.queueId || item?.batchId || item?.id || '');
  }

  function cleanLink(value) {
    return String(value || '').trim().replace(/[),.;!?]+$/, '');
  }

  global.CbV10Storage = { KEYS, parse, array, object, save, id, cleanLink };
})(window);
