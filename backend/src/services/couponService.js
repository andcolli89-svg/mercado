function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

function text(value) {
  return String(value || '').trim().toLowerCase();
}

function active(coupon, now = new Date()) {
  if (coupon.enabled === false) return false;
  if (!coupon.expiresAt) return true;
  const expiration = new Date(coupon.expiresAt);
  return Number.isFinite(expiration.getTime()) && expiration >= now;
}

function matchesKeywords(coupon, product) {
  const keywords = Array.isArray(coupon.keywords) ? coupon.keywords.map(text).filter(Boolean) : [];
  if (!keywords.length) return true;
  const haystack = text(`${product.title || ''} ${product.category || ''} ${product.itemId || ''}`);
  return keywords.some((keyword) => haystack.includes(keyword));
}

function estimateDiscount(coupon, currentPrice) {
  const price = money(currentPrice);
  if (price <= 0) return 0;

  if (coupon.type === 'percent') {
    const raw = price * (Number(coupon.value || 0) / 100);
    const cap = Number(coupon.maxDiscount || 0);
    return money(cap > 0 ? Math.min(raw, cap) : raw);
  }

  return money(Math.min(price, Number(coupon.value || 0)));
}

export function evaluateCoupons(product, coupons = [], now = new Date()) {
  const current = money(product?.price?.current?.amount || product?.price || 0);
  const platform = text(product?.platform || 'mercado_livre');

  const compatible = coupons
    .filter((coupon) => active(coupon, now))
    .filter((coupon) => !coupon.platform || text(coupon.platform) === platform)
    .filter((coupon) => current >= Number(coupon.minimumSpend || 0))
    .filter((coupon) => matchesKeywords(coupon, product))
    .map((coupon) => {
      const estimatedDiscount = estimateDiscount(coupon, current);
      return {
        ...coupon,
        estimatedDiscount,
        estimatedPrice: money(Math.max(0, current - estimatedDiscount)),
        confirmation: coupon.confirmed ? 'confirmed' : 'suggested',
      };
    })
    .filter((coupon) => coupon.estimatedDiscount > 0)
    .sort((a, b) => b.estimatedDiscount - a.estimatedDiscount);

  return {
    best: compatible[0] || null,
    compatible,
  };
}
