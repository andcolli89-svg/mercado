'use strict';
(function (global) {
  const BATCH_KEY = 'cbofertas-v63-batch';
  const QUEUE_KEY = 'cbofertas-v6-queue';
  const PUBLICATIONS_KEY = 'cbofertas-publications';

  const byId = id => document.getElementById(id);
  const parse = (raw, fallback) => {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  };
  const readArray = key => {
    const value = parse(localStorage.getItem(key) || '[]', []);
    return Array.isArray(value) ? value : [];
  };
  const writeArray = (key, value) => {
    localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
  };
  const normalizeLink = value => String(value || '').trim().replace(/[),.;!?]+$/, '');

  function status(message, type = 'success') {
    try {
      if (typeof setStatus === 'function' && window.el?.topActionStatus) {
        setStatus(window.el.topActionStatus, message, type);
        return;
      }
    } catch (_) {}
    const node = byId('topActionStatus');
    if (node) {
      node.textContent = message;
      node.className = `status ${type}`;
    }
  }

  function currentData() {
    if (typeof captureForm !== 'function') throw new Error('O formulário da oferta ainda não está pronto.');
    const data = captureForm();
    const error = typeof validateCurrent === 'function' ? validateCurrent(data) : '';
    if (error) throw new Error(error);

    const message =
      (typeof buildMessagesForData === 'function' && buildMessagesForData(data)[0]) ||
      byId('finalText')?.value ||
      `${data.title || ''}\n${data.link || ''}`.trim();

    return {
      ...data,
      link: normalizeLink(data.link),
      message,
      finalText: message
    };
  }

  function duplicate(items, data) {
    const link = normalizeLink(data.link);
    return items.some(item => normalizeLink(item.link || item.originalLink) === link);
  }

  function addToBatch(data) {
    const items = typeof getV63Batch === 'function' ? getV63Batch() : readArray(BATCH_KEY);
    if (duplicate(items, data)) throw new Error('Esta oferta já está salva no Lote.');

    const affiliateReady =
      typeof isAffiliateLink === 'function'
        ? isAffiliateLink(data.link)
        : /^https:\/\/meli\.la\//i.test(data.link);

    items.push({
      ...data,
      batchId: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      status: affiliateReady ? 'affiliate_ready' : 'blocked_link',
      affiliateConfirmed: affiliateReady,
      source: 'current_offer'
    });

    if (typeof saveV63Batch === 'function') saveV63Batch(items);
    else writeArray(BATCH_KEY, items);
    return items.length;
  }

  function nextPilotTime(queue, config) {
    const now = Date.now();
    const pending = queue
      .map(item => Number(item.scheduledAt || 0))
      .filter(time => Number.isFinite(time) && time > now)
      .sort((a, b) => a - b);

    if (pending.length) {
      const last = pending[pending.length - 1];
      return last + Math.max(1, Number(config.item || 2)) * 60000;
    }

    const [hour, minute] = String(config.start || '08:00').split(':').map(Number);
    const date = new Date();
    date.setHours(hour || 8, minute || 0, 0, 0);
    if (date.getTime() <= now) date.setDate(date.getDate() + 1);
    return date.getTime();
  }

  function addToPilot(data) {
    const queue = typeof getV6Queue === 'function' ? getV6Queue() : readArray(QUEUE_KEY);
    if (duplicate(queue, data)) throw new Error('Esta oferta já está na fila do Piloto.');

    const config = typeof saveV6Config === 'function'
      ? saveV6Config()
      : { start: '08:00', item: 2, group: '', automatic: false, testMode: true };

    queue.push({
      ...data,
      queueId: `direct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      scheduledAt: nextPilotTime(queue, config),
      status: 'pending',
      source: 'current_offer',
      message: data.message
    });

    queue.sort((a, b) => Number(a.scheduledAt || 0) - Number(b.scheduledAt || 0));
    writeArray(QUEUE_KEY, queue);

    if (typeof renderV6Queue === 'function') renderV6Queue();
    if (typeof renderV62Report === 'function') renderV62Report();
    return queue[queue.length - 1];
  }

  function saveHistory(data) {
    const items = typeof getPublications === 'function'
      ? getPublications()
      : readArray(PUBLICATIONS_KEY);

    if (duplicate(items, data)) return false;

    items.unshift({
      ...data,
      id: typeof publicationId === 'function'
        ? publicationId()
        : `pub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      scheduleDate: '',
      scheduleTime: '',
      scheduledIds: [],
      scheduledAt: null
    });

    if (typeof savePublications === 'function') savePublications(items);
    else writeArray(PUBLICATIONS_KEY, items);
    if (typeof renderPublications === 'function') renderPublications();
    return true;
  }

  function clearAfterSuccess() {
    if (typeof clearForm === 'function') clearForm({ expand: false, status: false });
    if (typeof setEditorCollapsed === 'function') setEditorCollapsed(true);
  }

  async function handle(action) {
    try {
      const data = currentData();

      if (action === 'batch') {
        addToBatch(data);
        status('Oferta adicionada ao Lote.', 'success');
      }

      if (action === 'pilot') {
        const item = addToPilot(data);
        const time = new Date(item.scheduledAt).toLocaleString('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short'
        });
        status(`Oferta adicionada ao Piloto para ${time}.`, 'success');
      }

      if (action === 'save-pilot') {
        const saved = saveHistory(data);
        const item = addToPilot(data);
        const time = new Date(item.scheduledAt).toLocaleString('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short'
        });
        status(
          `${saved ? 'Oferta salva no histórico e' : 'Oferta já estava no histórico e foi'} adicionada ao Piloto para ${time}.`,
          'success'
        );
      }

      clearAfterSuccess();
    } catch (error) {
      status(error?.message || 'Não foi possível concluir esta ação.', 'error');
    }
  }

  document.addEventListener('click', event => {
    if (event.target.closest?.('#addCurrentToBatchBtn')) handle('batch');
    if (event.target.closest?.('#addCurrentToPilotBtn')) handle('pilot');
    if (event.target.closest?.('#saveCurrentAndPilotBtn')) handle('save-pilot');
  });
})(window);
