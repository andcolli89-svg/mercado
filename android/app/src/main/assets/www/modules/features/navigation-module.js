'use strict';
(function (global) {
  const pageMap = {
    offers: 'offersPage',
    history: 'historyPage',
    coupons: 'couponsPage',
    batch: 'batchPage',
    automation: 'automationPage',
    settings: 'settingsPage'
  };

  function open(pageName) {
    const targetId = pageMap[pageName];
    if (!targetId) return false;
    Object.values(pageMap).forEach(id => {
      const page = document.getElementById(id);
      if (page) {
        page.hidden = id !== targetId;
        page.classList.toggle('active', id === targetId);
      }
    });
    document.querySelectorAll('[data-page]').forEach(button => {
      button.classList.toggle('active', button.dataset.page === pageName);
    });
    global.CbEventBus?.emit('navigation:changed', pageName);
    return true;
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-page]');
    if (!button) return;
    event.preventDefault();
    open(button.dataset.page);
  }, true);

  global.CbNavigation = { open, pages: { ...pageMap } };
})(window);
