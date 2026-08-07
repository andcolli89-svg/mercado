'use strict';
(function (global) {
  const PAGES = {
    offers: 'offersPage',
    history: 'historyPage',
    coupons: 'couponsPage',
    batch: 'batchPage',
    automation: 'automationPage',
    settings: 'settingsPage',
    radar: 'radarPage',
    favorites: 'favoritesPage'
  };

  function closeMenu() {
    document.getElementById('sideMenu')?.classList.remove('open');
    document.getElementById('menuOverlay')?.classList.add('hidden');
    document.body.classList.remove('menu-open');
  }

  function openMenu() {
    document.getElementById('sideMenu')?.classList.add('open');
    document.getElementById('menuOverlay')?.classList.remove('hidden');
    document.body.classList.add('menu-open');
  }

  function show(name, keepScroll) {
    const pageName = PAGES[name] ? name : 'offers';
    const target = PAGES[pageName];

    Object.values(PAGES).forEach(id => {
      const page = document.getElementById(id);
      if (!page) return;
      const active = id === target;
      page.classList.toggle('hidden', !active);
      page.hidden = !active;
      page.setAttribute('aria-hidden', active ? 'false' : 'true');
    });

    document.querySelectorAll('[data-page]').forEach(button => {
      const active = button.dataset.page === pageName;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });

    sessionStorage.setItem('cbofertas-v10-page', pageName);
    closeMenu();

    if (!keepScroll) window.scrollTo(0, 0);

    try {
      if (pageName === 'history') global.renderPublications?.();
      if (pageName === 'batch') {
        global.renderV63Batch?.();
        global.CbV10?.renderBatch?.();
      }
      if (pageName === 'automation') global.renderV6Queue?.();
      if (pageName === 'coupons') global.renderCouponLibrary?.();
    } catch (_) {}
  }

  document.addEventListener('click', event => {
    const pageButton = event.target.closest?.('[data-page]');
    if (pageButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      show(pageButton.dataset.page);
      return;
    }

    if (event.target.closest?.('#menuBtn')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openMenu();
      return;
    }

    if (event.target.closest?.('#closeMenuBtn, #menuOverlay')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeMenu();
    }
  }, true);

  function init() {
    const saved = sessionStorage.getItem('cbofertas-v10-page');
    show(PAGES[saved] ? saved : 'offers', true);

    setInterval(() => {
      const visible = Object.values(PAGES).some(id => {
        const page = document.getElementById(id);
        return page && !page.hidden && !page.classList.contains('hidden');
      });
      if (!visible) show('offers', true);
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.CbV10Navigation = { show, openMenu, closeMenu };
})(window);
