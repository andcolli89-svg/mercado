'use strict';
(function (global) {
  function setVersion() {
    document.querySelectorAll('.about-card b').forEach(node => node.textContent = 'CbOfertas V8.0');
    const subtitle = document.querySelector('header p, .brand-subtitle');
    if (subtitle && /Criador de Ofertas/i.test(subtitle.textContent || '')) {
      subtitle.textContent = 'V8 • Criador de Ofertas Inteligente';
    }
  }

  function boot() {
    global.CbSafe?.run('startup.version', setVersion);
    global.CbSafe?.run('startup.navigation', () => {
      const active = document.querySelector('[data-page].active')?.dataset.page || 'offers';
      global.CbNavigation?.open(active);
    });
    global.CbEventBus?.emit('app:ready', { version: '8.0.0', at: Date.now() });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
