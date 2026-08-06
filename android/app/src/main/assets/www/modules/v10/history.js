'use strict';
(function (global) {
  const S = global.CbV10Storage;

  function limit() {
    return Math.max(100, Math.min(2000, Number(localStorage.getItem(S.KEYS.historyLimit) || 500)));
  }

  function withoutCoupon(item) {
    const clean = { ...item };
    [
      'coupon','couponCode','couponText','couponValidUntil','couponDiscount',
      'couponMinPrice','appliedCoupon','activeCoupon','couponId'
    ].forEach(key => delete clean[key]);

    ['message','finalText','text','description'].forEach(key => {
      if (!clean[key]) return;
      clean[key] = String(clean[key])
        .split(/\r?\n/)
        .filter(line => !/(cupom|código promocional|use o código|desconto com código)/i.test(line))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    });
    return clean;
  }

  function add(item, extra = {}) {
    const items = S.array(S.KEYS.history);
    items.unshift(withoutCoupon({
      ...item,
      ...extra,
      status: 'sent',
      sentAt: Date.now(),
      updatedAt: Date.now()
    }));
    items.splice(limit());
    S.save(S.KEYS.history, items);
    global.renderPublications?.();
  }

  function trim() {
    const items = S.array(S.KEYS.history).map(withoutCoupon);
    items.splice(limit());
    S.save(S.KEYS.history, items);
    return items.length;
  }

  global.CbV10History = { limit, withoutCoupon, add, trim };
})(window);
