'use strict';
(function (global) {
  function parse(raw, fallback) {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }
  const storage = {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : parse(raw, fallback);
      } catch (_) { return fallback; }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        global.CbEventBus?.emit('storage:changed', { key, value });
        return true;
      } catch (error) {
        console.error('[CbStorage] set', key, error);
        return false;
      }
    },
    remove(key) {
      try { localStorage.removeItem(key); return true; }
      catch (_) { return false; }
    },
    transaction(key, fallback, updater) {
      const current = this.get(key, fallback);
      const next = updater(current);
      this.set(key, next);
      return next;
    }
  };
  global.CbStorage = storage;
})(window);
