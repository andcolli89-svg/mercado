'use strict';
(function (global) {
  const S = global.CbV10Storage;
  const A = global.CbV10Affiliate;
  const DEFAULT_GROUP = 'GRUPO DE OFERTAS CB #1 🛒';

  function mode() {
    return localStorage.getItem(S.KEYS.mode) || 'safe';
  }

  function setMode(value) {
    const selected = value === 'experimental' ? 'experimental' : 'safe';
    localStorage.setItem(S.KEYS.mode, selected);
    return selected;
  }

  function group() {
    const config = S.object(S.KEYS.config);
    return String(config.group || global.CB_DEFAULT_GROUP || DEFAULT_GROUP).trim();
  }

  function assertReady(item) {
    if (!item) throw new Error('Oferta não encontrada.');
    if (!A.confirmed(item)) throw new Error('Confirme o afiliado usando “Usar link copiado”.');
    const text = String(item.message || item.finalText || item.text || '').trim();
    if (!text) throw new Error('A oferta não possui texto.');
    return text;
  }

  function safe(item) {
    const text = assertReady(item);
    if (!global.Android?.shareToWhatsAppBusiness) {
      throw new Error('Ponte do WhatsApp indisponível neste APK.');
    }
    global.Android.shareToWhatsAppBusiness(
      String(item.image || item.imageUrl || ''),
      text,
      group()
    );
    return { status: 'waiting_confirmation', openedAt: Date.now() };
  }

  function experimental(item) {
    const text = assertReady(item);
    if (!global.Android?.testAutomaticShare) {
      throw new Error('Piloto experimental indisponível neste APK.');
    }
    global.Android.testAutomaticShare(
      String(item.image || item.imageUrl || ''),
      text,
      group(),
      false
    );
    return { status: 'waiting_confirmation', openedAt: Date.now() };
  }

  function open(item) {
    return mode() === 'experimental' ? experimental(item) : safe(item);
  }

  global.CbV10Send = { mode, setMode, group, safe, experimental, open };
})(window);
