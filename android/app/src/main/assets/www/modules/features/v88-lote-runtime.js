'use strict';
(function (global) {
  const BATCH_KEY = 'cbofertas-v63-batch';
  const DEFAULT_GROUP = 'GRUPO DE OFERTAS CB #1 🛒';

  const parse = (raw, fallback) => {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  };
  const readBatch = () => {
    const value = parse(localStorage.getItem(BATCH_KEY) || '[]', []);
    return Array.isArray(value) ? value : [];
  };
  const writeBatchRaw = items =>
    localStorage.setItem(BATCH_KEY, JSON.stringify(Array.isArray(items) ? items : []));

  const esc = value => {
    if (typeof global.escapeHtml === 'function') return global.escapeHtml(value);
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  function isAffiliateUrl(value) {
    try {
      return /(^|\.)meli\.la$/i.test(new URL(String(value || '').trim()).hostname);
    } catch (_) {
      return false;
    }
  }

  function isConfirmed(item) {
    return Boolean(
      item &&
      item.affiliateConfirmed === true &&
      item.affiliateConfirmationSource === 'use_copied_link' &&
      isAffiliateUrl(item.link)
    );
  }

  function migrateAffiliateState() {
    const items = readBatch();
    let changed = false;
    for (const item of items) {
      if (!isConfirmed(item)) {
        if (
          item.affiliateConfirmed !== false ||
          item.affiliateConfirmationSource ||
          Number(item.affiliateConfirmedAt || 0) !== 0
        ) {
          item.affiliateConfirmed = false;
          item.affiliateConfirmationSource = '';
          item.affiliateConfirmedAt = 0;
          item.status = 'blocked_link';
          changed = true;
        }
      }
    }
    if (changed) writeBatchRaw(items);
    return items;
  }

  function status(message, type = '') {
    if (typeof global.v6Status === 'function') {
      global.v6Status('batchStatus', message, type);
      return;
    }
    const node = document.getElementById('batchStatus');
    if (node) {
      node.textContent = message;
      node.className = `status ${type}`.trim();
    }
  }

  function groupName() {
    try {
      const config = parse(localStorage.getItem('cbofertas-v6-config') || '{}', {});
      return String(config.group || global.CB_DEFAULT_GROUP || DEFAULT_GROUP).trim();
    } catch (_) {
      return DEFAULT_GROUP;
    }
  }

  function sendNow(batchId) {
    const item = readBatch().find(entry => String(entry.batchId) === String(batchId));
    if (!item) return status('Oferta não encontrada no Lote.', 'error');

    if (!isConfirmed(item)) {
      return status(
        'Afiliado não confirmado. Toque em “Usar link copiado” antes de enviar.',
        'error'
      );
    }

    const text = String(item.message || item.finalText || '').trim();
    if (!text) return status('Esta oferta não possui texto para enviar.', 'error');

    if (!global.Android || typeof global.Android.shareToWhatsAppBusiness !== 'function') {
      return status('O envio direto funciona somente no aplicativo Android.', 'error');
    }

    try {
      global.Android.shareToWhatsAppBusiness(
        String(item.image || ''),
        text,
        groupName()
      );
      status(
        item.image
          ? 'WhatsApp Business aberto com foto e texto.'
          : 'WhatsApp Business aberto com o texto da oferta.',
        'success'
      );
    } catch (error) {
      status(error?.message || 'Não foi possível abrir o WhatsApp Business.', 'error');
    }
  }

  function render() {
    const items = migrateAffiliateState();
    const list = document.getElementById('batchItemsList');
    if (!list) return;

    const confirmed = items.filter(isConfirmed).length;
    const photos = items.filter(item => item.image).length;

    const summary = document.getElementById('batchSummary');
    if (summary) {
      summary.textContent = items.length
        ? `${items.length} anúncio(s) • ${confirmed} afiliado(s) confirmado(s) • ${items.length - confirmed} bloqueado(s) • ${photos} com foto`
        : 'Nenhum lote separado.';
    }

    const badge = document.getElementById('batchReadyBadge');
    if (badge) badge.textContent = `${confirmed} prontos`;

    list.innerHTML = items.length
      ? items.map((item, index) => {
          const confirmedManually = isConfirmed(item);
          const copied = Number(item.copiedAt || 0) > 0;
          const photoLabel = item.image ? 'com foto' : 'sem foto';
          return `
            <article class="batch-item ${confirmedManually ? 'ready' : 'blocked'} ${copied ? 'batch-copied' : ''}" data-v88-card="${esc(item.batchId)}">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                <input type="checkbox" data-v88-select="${esc(item.batchId)}" aria-label="Selecionar oferta">
                <strong style="font-size:12px;background:#0a9f43;color:#fff;border-radius:999px;padding:4px 9px">V8.8 NOVO</strong>
              </div>
              <button class="batch-thumb" type="button" data-batch-photo-open="${esc(item.batchId)}" ${item.image ? '' : 'disabled'}>
                ${item.image
                  ? `<img src="${esc(item.image)}" alt="Foto de ${esc(item.title || 'oferta')}">`
                  : '<span>🛍️</span>'}
              </button>
              <div class="batch-item-main">
                <b>${index + 1}. ${esc(item.title || 'Oferta')}</b>
                <small>${confirmedManually ? '✅ Afiliado confirmado pelo botão' : '⛔ Afiliado não confirmado'} • ${photoLabel}</small>
                <a class="batch-link" href="${esc(item.link || '#')}" data-batch-open-link="${esc(item.batchId)}">${esc(item.link || 'Sem link')}</a>
                <div class="batch-actions">
                  <button class="batch-send-now" type="button" data-v88-send="${esc(item.batchId)}">
                    📲 Enviar agora${item.image ? ' com foto' : ''}
                  </button>
                  <button type="button" data-batch-copy-ad="${esc(item.batchId)}">📋 Copiar anúncio</button>
                  <button type="button" data-batch-copy="${esc(item.batchId)}">🔗 Copiar link</button>
                  <button type="button" data-batch-generate="${esc(item.batchId)}">💰 Gerar link no ML</button>
                  <button type="button" data-batch-use-copy="${esc(item.batchId)}">✅ Usar link copiado</button>
                  <button type="button" data-batch-photo="${esc(item.batchId)}">🖼 Buscar foto</button>
                  <button class="danger" type="button" data-batch-delete="${esc(item.batchId)}">🗑 Excluir</button>
                </div>
              </div>
            </article>`;
        }).join('')
      : '<div class="empty">Cole anúncios acima e toque em Adicionar anúncios ao lote.</div>';
  }

  // Confirm only after the real "Usar link copiado" flow succeeds.
  const originalReplace = global.v63ReplaceAffiliateLink;
  if (typeof originalReplace === 'function') {
    global.v63ReplaceAffiliateLink = function (batchId, newLink) {
      originalReplace(batchId, newLink);
      const items = readBatch();
      const item = items.find(entry => String(entry.batchId) === String(batchId));
      if (item && isAffiliateUrl(item.link) && String(item.link) === String(newLink).trim()) {
        item.affiliateConfirmed = true;
        item.affiliateConfirmationSource = 'use_copied_link';
        item.affiliateConfirmedAt = Date.now();
        item.status = 'affiliate_ready';
        writeBatchRaw(items);
      }
      render();
    };
  }

  // Override the function used by the real Lote renderer.
  global.renderV63Batch = render;

  document.addEventListener('click', event => {
    const send = event.target.closest?.('[data-v88-send]');
    if (send) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      sendNow(send.dataset.v88Send);
    }
  }, true);

  function init() {
    migrateAffiliateState();
    render();
    const observer = new MutationObserver(() => {
      const list = document.getElementById('batchItemsList');
      if (list && !list.querySelector('[data-v88-card]')) render();
    });
    const list = document.getElementById('batchItemsList');
    if (list) observer.observe(list, { childList: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.CbV88Lote = { render, sendNow, migrateAffiliateState, isConfirmed };
})(window);
