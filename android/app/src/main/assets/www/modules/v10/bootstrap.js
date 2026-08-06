'use strict';
(function (global) {
  const S = global.CbV10Storage;
  const A = global.CbV10Affiliate;
  const Q = global.CbV10Queue;
  const Send = global.CbV10Send;
  const H = global.CbV10History;

  const esc = value => String(value ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  function status(message, error = false) {
    const node = document.getElementById('v10Status') || document.getElementById('batchStatus');
    if (node) {
      node.textContent = message;
      node.className = `status ${error ? 'error' : 'success'}`;
    }
  }

  function renderBatch() {
    const items = A.migrateBatch();
    const list = document.getElementById('batchItemsList');
    if (!list) return;

    const confirmed = items.filter(A.confirmed).length;
    const summary = document.getElementById('batchSummary');
    if (summary) summary.textContent =
      `${items.length} anúncio(s) • ${confirmed} confirmado(s) • ${items.length-confirmed} bloqueado(s)`;

    list.innerHTML = items.length ? items.map((item, index) => `
      <article class="batch-item ${A.confirmed(item) ? 'ready' : 'blocked'}" data-v10-card="${esc(S.id(item))}">
        <div style="display:flex;align-items:center;gap:8px">
          <input type="checkbox" data-v10-select="${esc(S.id(item))}">
          <strong style="background:#087f38;color:white;border-radius:999px;padding:4px 9px;font-size:12px">V10</strong>
        </div>
        <button class="batch-thumb" type="button" ${item.image ? '' : 'disabled'}>
          ${item.image ? `<img src="${esc(item.image)}" alt="Foto">` : '<span>🛍️</span>'}
        </button>
        <div class="batch-item-main">
          <b>${index+1}. ${esc(item.title || 'Oferta')}</b>
          <small>${A.confirmed(item) ? '✅ Afiliado confirmado manualmente' : '⛔ Afiliado não confirmado'} • ${item.image ? 'foto pronta' : 'sem foto'}</small>
          <a class="batch-link" href="${esc(item.link || '#')}">${esc(item.link || 'Sem link')}</a>
          <div class="batch-actions">
            <button type="button" data-v10-send="${esc(S.id(item))}">📲 Enviar agora</button>
            <button type="button" data-v10-pilot="${esc(S.id(item))}">🤖 Adicionar ao Piloto</button>
            <button type="button" data-batch-use-copy="${esc(S.id(item))}">✅ Usar link copiado</button>
            <button type="button" data-batch-photo="${esc(S.id(item))}">🖼 Buscar foto</button>
            <button class="danger" type="button" data-batch-delete="${esc(S.id(item))}">🗑 Excluir</button>
          </div>
        </div>
      </article>`).join('') : '<div class="empty">Nenhuma oferta no Lote.</div>';
  }

  function selectedBatch() {
    const ids = new Set([...document.querySelectorAll('[data-v10-select]:checked')]
      .map(input => String(input.dataset.v10Select)));
    return S.array(S.KEYS.batch).filter(item => ids.has(S.id(item)));
  }

  function renderQueueActions() {
    const items = Q.list();
    document.querySelectorAll('[data-queue-id], .queue-item, .automation-item').forEach(card => {
      if (card.querySelector('[data-v10-queue-actions]')) return;
      const id = card.dataset.queueId || card.getAttribute('data-id');
      const item = items.find(entry => S.id(entry) === String(id));
      if (!item) return;

      const area = document.createElement('div');
      area.dataset.v10QueueActions = 'true';
      area.className = 'v10-queue-actions';
      area.innerHTML = `
        <strong>${esc(item.status || 'pending')}</strong>
        <button type="button" data-v10-queue-send="${esc(id)}">📲 Enviar</button>
        ${item.status === 'waiting_confirmation' ? `<button type="button" data-v10-confirm="${esc(id)}">✅ Confirmar envio</button>` : ''}
        ${item.status === 'failed' ? `<button type="button" data-v10-retry="${esc(id)}">↻ Tentar novamente</button>` : ''}
      `;
      card.appendChild(area);
    });
  }

  function panel() {
    if (document.getElementById('v10ControlPanel')) return;
    const page = document.getElementById('automationPage') || document.querySelector('main');
    if (!page) return;

    const section = document.createElement('section');
    section.id = 'v10ControlPanel';
    section.className = 'card';
    section.innerHTML = `
      <div class="setting-title"><span>🛡️</span><div><h2>CbOfertas V10</h2><p>Envio seguro como padrão e automação experimental separada.</p></div></div>
      <label class="check-row"><input type="radio" name="v10mode" value="safe" id="v10Safe"><span><b>Modo Seguro</b> — você escolhe o grupo e confirma o envio.</span></label>
      <label class="check-row"><input type="radio" name="v10mode" value="experimental" id="v10Experimental"><span><b>Piloto Experimental</b> — usa acessibilidade.</span></label>
      <div class="actions two-buttons">
        <button id="v10SelectAll" class="btn secondary" type="button">Selecionar Lote</button>
        <button id="v10SendSelected" class="btn primary" type="button">Enviar selecionadas</button>
      </div>
      <label class="field"><span>Limite do histórico</span><select id="v10HistoryLimit"><option>100</option><option>250</option><option selected>500</option><option>1000</option></select></label>
      <button id="v10Diagnostic" class="btn outline full" type="button">🔎 Diagnóstico</button>
      <pre id="v10DiagnosticOutput" class="status" style="white-space:pre-wrap"></pre>
      <p id="v10Status" class="status">V10 carregada.</p>
    `;
    page.prepend(section);

    document.getElementById(Send.mode() === 'experimental' ? 'v10Experimental' : 'v10Safe').checked = true;
    document.getElementById('v10HistoryLimit').value =
      String(localStorage.getItem(S.KEYS.historyLimit) || 500);
  }

  async function useCopied(batchId) {
    let value = '';
    try { value = String(global.Android?.getClipboardText?.() || '').trim(); } catch (_) {}
    if (!value) {
      try { value = String(await navigator.clipboard.readText()).trim(); } catch (_) {}
    }
    if (!value) value = String(prompt('Cole o link afiliado meli.la:', 'https://meli.la/') || '').trim();
    if (!value) return;
    A.confirm(batchId, value);
    renderBatch();
    status('Afiliado confirmado pelo botão “Usar link copiado”.');
  }

  document.addEventListener('change', event => {
    if (event.target?.name === 'v10mode') {
      Send.setMode(event.target.value);
      status(event.target.value === 'safe' ? 'Modo Seguro ativo.' : 'Piloto Experimental ativo.');
    }
    if (event.target?.id === 'v10HistoryLimit') {
      localStorage.setItem(S.KEYS.historyLimit, event.target.value);
      H.trim();
    }
  });

  document.addEventListener('click', async event => {
    const use = event.target.closest?.('[data-batch-use-copy]');
    if (use) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await useCopied(use.dataset.batchUseCopy);
      return;
    }

    const send = event.target.closest?.('[data-v10-send]');
    if (send) {
      const item = S.array(S.KEYS.batch).find(entry => S.id(entry) === send.dataset.v10Send);
      try { Send.open(item); status('WhatsApp aberto. Confirme o envio manualmente.'); }
      catch (error) { status(error.message, true); }
      return;
    }

    const pilot = event.target.closest?.('[data-v10-pilot]');
    if (pilot) {
      const item = S.array(S.KEYS.batch).find(entry => S.id(entry) === pilot.dataset.v10Pilot);
      try {
        if (!A.confirmed(item)) throw new Error('Confirme o afiliado antes de adicionar ao Piloto.');
        const added = Q.append([item]);
        status(added ? 'Oferta adicionada ao Piloto.' : 'Oferta já estava no Piloto.', !added);
      } catch (error) { status(error.message, true); }
      return;
    }

    const qsend = event.target.closest?.('[data-v10-queue-send]');
    if (qsend) {
      try { Q.start(qsend.dataset.v10QueueSend); status('WhatsApp aberto.'); }
      catch (error) { status(error.message, true); }
      return;
    }

    const confirm = event.target.closest?.('[data-v10-confirm]');
    if (confirm) {
      try { Q.confirm(confirm.dataset.v10Confirm); status('Enviada e removida da fila.'); }
      catch (error) { status(error.message, true); }
      return;
    }

    const retry = event.target.closest?.('[data-v10-retry]');
    if (retry) {
      try { Q.retry(retry.dataset.v10Retry); }
      catch (error) { status(error.message, true); }
      return;
    }

    if (event.target.closest?.('#v10SelectAll')) {
      document.querySelectorAll('[data-v10-select]').forEach(input => input.checked = true);
    }

    if (event.target.closest?.('#v10SendSelected')) {
      const items = selectedBatch();
      if (!items.length) return status('Selecione pelo menos uma oferta.', true);
      for (const item of items) {
        try { Send.open(item); break; }
        catch (error) { status(error.message, true); return; }
      }
    }

    if (event.target.closest?.('#v10Diagnostic')) {
      const output = document.getElementById('v10DiagnosticOutput');
      output.textContent = [
        'Versão: 10.0.0',
        `Modo: ${Send.mode()}`,
        `Grupo: ${Send.group()}`,
        `Acessibilidade: ${global.Android?.isAutomationServiceEnabled?.() ? 'ativa' : 'inativa'}`,
        `Ponte WhatsApp: ${global.Android?.shareToWhatsAppBusiness ? 'disponível' : 'indisponível'}`,
        `Lote: ${S.array(S.KEYS.batch).length}`,
        `Fila: ${Q.list().length}`,
        `Histórico: ${S.array(S.KEYS.history).length}`
      ].join('\n');
    }
  }, true);

  function init() {
    panel();
    Q.normalize();
    renderBatch();
    setInterval(() => {
      if (!document.querySelector('[data-v10-card]') && document.getElementById('batchItemsList')) renderBatch();
      renderQueueActions();
    }, 900);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  global.CbV10 = { renderBatch, panel };
})(window);
