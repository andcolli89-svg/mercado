'use strict';
(function (global) {
  const listeners = new Map();
  const bus = {
    on(event, callback) {
      if (typeof callback !== 'function') return () => {};
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(callback);
      return () => listeners.get(event)?.delete(callback);
    },
    emit(event, payload) {
      for (const callback of listeners.get(event) || []) {
        try { callback(payload); }
        catch (error) { console.error('[CbEventBus]', event, error); }
      }
    },
    clear(event) {
      if (event) listeners.delete(event);
      else listeners.clear();
    }
  };
  global.CbEventBus = bus;
})(window);
