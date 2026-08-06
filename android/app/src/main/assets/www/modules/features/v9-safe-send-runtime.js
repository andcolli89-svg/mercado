'use strict';
(function (global) {
  const QUEUE_KEY = 'cbofertas-v6-queue';
  const HISTORY_KEY = 'cbofertas-publications';
  const CONFIG_KEY = 'cbofertas-v6-config';
  const MODE_KEY = 'cbofertas-v9-send-mode';
  const RETRY_LIMIT_KEY = 'cbofertas-v9-retry-limit';
  const DIAG_KEY = 'cbofertas-v9-last-diagnostic';
  const DEFAULT_GROUP = 'GRUPO DE OFERTAS CB #1 🛒';

  const parse = (raw, fallback) => {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  };
  const readArray = key => {
    const value = parse(localStorage.getItem(key) || '[]', []);
    return Array.isArray(value) ? value : [];
  };
  const writeArray = (key, value) =>
    localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));

  function getMode() {
    return localStorage.getItem(MODE_KEY) || 'safe';
  }

  function setMode(mode) {
    const safe = mode === 'experimental' ? 'experimental' : 'safe';
    localStorage.setItem(MODE_KEY, safe);
    renderMode();
    return safe;
  }

  function groupName() {
    const config = parse(localStorage.getItem(CONFIG_KEY) || '{}', {});
    return String(config.group || global.CB_DEFAULT_GROUP || DEFAULT_GROUP).trim();
  }

  function retryLimit() {
    return Math.max(1, Math.min(5, Number(localStorage.getItem(RETRY_LIMIT_KEY) || 2)));
  }

  function queue() {
    return readArray(QUEUE_KEY);
  }

  function saveQueue(items) {
    writeArray(QUEUE_KEY, items);
    global.renderV6Queue?.();
    renderQueueSummary();
  }

  function statusLabel(status) {
    const map = {
      pending: 'Pendente',
      preparing: 'Preparando',
      waiting_confirmation: 'Aguardando confirmação',
      sent: 'Enviada',
      failed: 'Falhou'
    };
    return map[status] || 'Pendente';
  }

  function normalizeQueue() {
    const items = queue();
    let changed = false;
    for (const item of items) {
      if (!item.status) {
        item.status = 'pending';
        changed = true;
      }
      if (!Number.isFinite(Number(item.retryCount))) {
        item.retryCount = 0;
        changed = true;
      }
      if (!item.lastError) {
        item.lastError = '';
      }
    }
    if (changed) saveQueue(items);
    return items;
  }

  function recordDiagnostic(payload) {
    const entry = {
      at: Date.now(),
      mode: getMode(),
      group: groupName(),
      accessibility: Boolean(global.Android?.isAutomationServiceEnabled?.()),
      whatsappBridge: Boolean(global.Android?.shareToWhatsAppBusiness),
      queueSize: queue().length,
      ...payload
    };
    localStorage.setItem(DIAG_KEY, JSON.stringify(entry));
    renderDiagnostic();
    return entry;
  }

  function renderDiagnostic() {
    const node = document.getElementById('v9DiagnosticOutput');
    if (!node) return;
    const data = parse(localStorage.getItem(DIAG_KEY) || '{}', {});
    node.textContent = Object.keys(data).length
      ? [
          `Versão: V9.0`,
          `Modo: ${data.mode === 'experimental' ? 'Piloto experimental' : 'Seguro'}`,
          `Grupo: ${data.group || 'não configurado'}`,
          `Acessibilidade: ${data.accessibility ? 'ativa' : 'inativa'}`,
          `Ponte WhatsApp: ${data.whatsappBridge ? 'disponível' : 'indisponível'}`,
          `Fila: ${data.queueSize ?? 0}`,
          data.lastError ? `Último erro: ${data.lastError}` : 'Último erro: nenhum',
          data.at ? `Atualizado: ${new Date(data.at).toLocaleString('pt-BR')}` : ''
        ].filter(Boolean).join('\n')
      : 'Execute o diagnóstico para verificar o aparelho.';
  }

  function renderMode() {
    const safe = document.getElementById('v9SafeMode');
    const experimental = document.getElementById('v9ExperimentalMode');
    const badge = document.getElementById('v9ModeBadge');
    const mode = getMode();
    if (safe) safe.checked = mode === 'safe';
    if (experimental) experimental.checked = mode === 'experimental';
    if (badge) {
      badge.textContent = mode === 'safe' ? 'Modo Seguro ativo' : 'Piloto Experimental ativo';
      badge.className = `v9-mode-badge ${mode}`;
    }
  }

  function renderQueueSummary() {
    const node = document.getElementById('v9QueueSummary');
    if (!node) return;
    const items = normalizeQueue();
    const counts = items.reduce((acc, item) => {
      const key = item.status || 'pending';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    node.textContent = [
      `Pendentes: ${counts.pending || 0}`,
      `Preparando: ${counts.preparing || 0}`,
      `Aguardando confirmação: ${counts.waiting_confirmation || 0}`,
      `Falhas: ${counts.failed || 0}`
    ].join(' • ');
  }

  function itemById(id) {
    return queue().find(item => String(item.queueId || item.id || '') === String(id || ''));
  }

  function updateItem(id, patch) {
    const items = queue();
    const item = items.find(entry => String(entry.queueId || entry.id || '') === String(id || ''));
    if (!item) return null;
    Object.assign(item, patch, { updatedAt: Date.now() });
    saveQueue(items);
    return item;
  }

  function shareSafe(item) {
    if (!global.Android?.shareToWhatsAppBusiness) {
      throw new Error('Ponte do WhatsApp indisponível neste APK.');
    }
    global.Android.shareToWhatsAppBusiness(
      String(item.image || item.imageUrl || ''),
      String(item.message || item.finalText || item.text || ''),
      groupName()
    );
  }

  function openSafe(id) {
    const item = itemById(id);
    if (!item) return;

    try {
      updateItem(id, {
        status: 'preparing',
        lastError: '',
        retryCount: Number(item.retryCount || 0)
      });

      shareSafe(item);

      updateItem(id, {
        status: 'waiting_confirmation',
        openedAt: Date.now()
      });

      recordDiagnostic({ lastError: '' });
      toast('WhatsApp Business aberto. Selecione o grupo e toque em enviar.');
    } catch (error) {
      const retries = Number(item.retryCount || 0) + 1;
      updateItem(id, {
        status: 'failed',
        retryCount: retries,
        lastError: error?.message || 'Falha ao abrir o WhatsApp.'
      });
      recordDiagnostic({ lastError: error?.message || 'Falha ao abrir o WhatsApp.' });
      toast(error?.message || 'Falha ao abrir o WhatsApp.', true);
    }
  }

  function startExperimental(id) {
    const item = itemById(id);
    if (!item) return;

    if (!global.Android?.testAutomaticShare) {
      toast('Piloto experimental indisponível neste APK.', true);
      return;
    }

    try {
      updateItem(id, {
        status: 'preparing',
        lastError: ''
      });

      global.Android.testAutomaticShare(
        String(item.image || item.imageUrl || ''),
        String(item.message || item.finalText || item.text || ''),
        groupName(),
        false
      );

      updateItem(id, {
        status: 'waiting_confirmation',
        openedAt: Date.now()
      });

      recordDiagnostic({ lastError: '' });
    } catch (error) {
      updateItem(id, {
        status: 'failed',
        retryCount: Number(item.retryCount || 0) + 1,
        lastError: error?.message || 'Falha no Piloto experimental.'
      });
      recordDiagnostic({ lastError: error?.message || 'Falha no Piloto experimental.' });
      toast(error?.message || 'Falha no Piloto experimental.', true);
    }
  }

  function startItem(id) {
    if (getMode() === 'experimental') startExperimental(id);
    else openSafe(id);
  }

  function markSent(id) {
    const items = queue();
    const index = items.findIndex(item => String(item.queueId || item.id || '') === String(id || ''));
    if (index < 0) return;

    const [item] = items.splice(index, 1);
    const history = readArray(HISTORY_KEY);
    history.unshift({
      ...item,
      status: 'sent',
      sentAt: Date.now(),
      updatedAt: Date.now()
    });
    history.splice(500);
    writeArray(HISTORY_KEY, history);
    saveQueue(items);
    global.renderPublications?.();
    toast('Oferta marcada como enviada e removida da fila.');
  }

  function retryFailed(id) {
    const item = itemById(id);
    if (!item) return;

    if (Number(item.retryCount || 0) >= retryLimit()) {
      toast(`Limite de ${retryLimit()} tentativa(s) atingido.`, true);
      return;
    }
    updateItem(id, { status: 'pending', lastError: '' });
    startItem(id);
  }

  function toast(message, error = false) {
    const node = document.getElementById('v9SendStatus');
    if (node) {
      node.textContent = message;
      node.className = `status ${error ? 'error' : 'success'}`;
    }
  }

  function decorateQueue() {
    document.querySelectorAll('[data-queue-id], .queue-item, .automation-item').forEach(card => {
      if (card.querySelector('[data-v9-actions]')) return;

      const id = card.dataset.queueId ||
        card.querySelector('[data-queue-id]')?.dataset.queueId ||
        card.getAttribute('data-id');

      if (!id) return;
      const item = itemById(id);
      if (!item) return;

      const actions = document.createElement('div');
      actions.dataset.v9Actions = 'true';
      actions.className = 'v9-queue-actions';
      actions.innerHTML = `
        <span class="v9-status">${statusLabel(item.status)}</span>
        <button type="button" data-v9-send="${id}">📲 Enviar</button>
        ${item.status === 'waiting_confirmation'
          ? `<button type="button" data-v9-confirm="${id}">✅ Confirmar envio</button>`
          : ''}
        ${item.status === 'failed'
          ? `<button type="button" data-v9-retry="${id}">↻ Tentar novamente</button>`
          : ''}
      `;
      card.appendChild(actions);
    });
  }

  function runDiagnostic() {
    let error = '';
    if (!groupName()) error = 'Grupo não configurado.';
    else if (!global.Android?.shareToWhatsAppBusiness) error = 'Ponte do WhatsApp indisponível.';
    recordDiagnostic({ lastError: error });
    toast(error || 'Diagnóstico concluído.', Boolean(error));
  }

  document.addEventListener('change', event => {
    if (event.target?.id === 'v9SafeMode' && event.target.checked) setMode('safe');
    if (event.target?.id === 'v9ExperimentalMode' && event.target.checked) setMode('experimental');
    if (event.target?.id === 'v9RetryLimit') {
      localStorage.setItem(RETRY_LIMIT_KEY, String(event.target.value || 2));
    }
  });

  document.addEventListener('click', event => {
    const send = event.target.closest?.('[data-v9-send]');
    if (send) startItem(send.dataset.v9Send);

    const confirm = event.target.closest?.('[data-v9-confirm]');
    if (confirm) markSent(confirm.dataset.v9Confirm);

    const retry = event.target.closest?.('[data-v9-retry]');
    if (retry) retryFailed(retry.dataset.v9Retry);

    if (event.target.closest?.('#v9RunDiagnostic')) runDiagnostic();
  });

  function init() {
    normalizeQueue();
    renderMode();
    renderQueueSummary();
    renderDiagnostic();

    const retry = document.getElementById('v9RetryLimit');
    if (retry) retry.value = String(retryLimit());

    setInterval(() => {
      decorateQueue();
      renderQueueSummary();
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.CbV9 = {
    setMode,
    startItem,
    markSent,
    retryFailed,
    runDiagnostic
  };
})(window);
