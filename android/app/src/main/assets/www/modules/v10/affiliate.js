'use strict';
(function (global) {
  const S = global.CbV10Storage;

  function isMeli(value) {
    try { return /(^|\.)meli\.la$/i.test(new URL(S.cleanLink(value)).hostname); }
    catch (_) { return false; }
  }

  function confirmed(item) {
    return Boolean(
      item &&
      item.affiliateConfirmed === true &&
      item.affiliateConfirmationSource === 'use_copied_link' &&
      isMeli(item.link)
    );
  }

  function normalize(item) {
    if (!confirmed(item)) {
      item.affiliateConfirmed = false;
      item.affiliateConfirmationSource = '';
      item.affiliateConfirmedAt = 0;
      if (item.status === 'affiliate_ready') item.status = 'blocked_link';
    }
    return item;
  }

  function migrateBatch() {
    const items = S.array(S.KEYS.batch).map(normalize);
    S.save(S.KEYS.batch, items);
    return items;
  }

  function confirm(batchId, newLink) {
    const link = S.cleanLink(newLink);
    if (!isMeli(link)) throw new Error('Cole um link meli.la válido.');

    const items = S.array(S.KEYS.batch);
    const item = items.find(entry => S.id(entry) === String(batchId));
    if (!item) throw new Error('Oferta não encontrada.');

    const previous = String(item.link || '');
    let text = String(item.message || item.finalText || '');

    if (previous && text.includes(previous)) text = text.split(previous).join(link);
    else text = text.replace(/https?:\/\/(?:[\w.-]+\.)?(?:meli\.la|mercadolivre\.com\.br|mercadolibre\.com)[^\s<>()]*/gi, link);

    item.link = link;
    item.message = text;
    item.finalText = text;
    item.affiliateConfirmed = true;
    item.affiliateConfirmationSource = 'use_copied_link';
    item.affiliateConfirmedAt = Date.now();
    item.status = 'affiliate_ready';

    S.save(S.KEYS.batch, items);
    return item;
  }

  global.CbV10Affiliate = { isMeli, confirmed, normalize, migrateBatch, confirm };
})(window);
