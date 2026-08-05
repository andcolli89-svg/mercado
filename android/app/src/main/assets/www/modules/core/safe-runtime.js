'use strict';
(function (global) {
  const errors = [];
  function record(source, error) {
    const item = {
      source,
      message: error?.message || String(error || 'Erro desconhecido'),
      stack: error?.stack || '',
      at: Date.now()
    };
    errors.push(item);
    if (errors.length > 100) errors.shift();
    try { localStorage.setItem('cbofertas-v8-errors', JSON.stringify(errors)); } catch (_) {}
    console.error('[CbOfertas V8]', source, error);
    global.CbEventBus?.emit('runtime:error', item);
  }
  global.CbSafe = {
    run(source, callback, fallback = undefined) {
      try { return callback(); }
      catch (error) { record(source, error); return fallback; }
    },
    async runAsync(source, callback, fallback = undefined) {
      try { return await callback(); }
      catch (error) { record(source, error); return fallback; }
    },
    errors() { return [...errors]; },
    record
  };
  global.addEventListener('error', event => record('window.error', event.error || event.message));
  global.addEventListener('unhandledrejection', event => record('promise', event.reason));
})(window);
