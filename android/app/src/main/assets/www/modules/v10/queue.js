'use strict';
(function (global) {
  const S = global.CbV10Storage;
  const H = global.CbV10History;
  const Send = global.CbV10Send;

  function list() {
    return S.array(S.KEYS.queue);
  }

  function save(items) {
    S.save(S.KEYS.queue, items);
    global.renderV6Queue?.();
    return items;
  }

  function normalize() {
    const items = list();
    items.forEach(item => {
      if (!item.status) item.status = 'pending';
      item.retryCount = Number(item.retryCount || 0);
      item.lastError = String(item.lastError || '');
    });
    return save(items);
  }

  function update(id, patch) {
    const items = list();
    const item = items.find(entry => S.id(entry) === String(id));
    if (!item) return null;
    Object.assign(item, patch, { updatedAt: Date.now() });
    save(items);
    return item;
  }

  function start(id) {
    const item = list().find(entry => S.id(entry) === String(id));
    if (!item) throw new Error('Oferta não encontrada na fila.');

    update(id, { status: 'preparing', lastError: '' });
    try {
      const result = Send.open(item);
      return update(id, result);
    } catch (error) {
      update(id, {
        status: 'failed',
        retryCount: Number(item.retryCount || 0) + 1,
        lastError: error?.message || 'Falha ao abrir o WhatsApp.'
      });
      throw error;
    }
  }

  function confirm(id) {
    const items = list();
    const index = items.findIndex(entry => S.id(entry) === String(id));
    if (index < 0) throw new Error('Oferta não encontrada.');

    const [item] = items.splice(index, 1);
    H.add(item, { sentMode: Send.mode() });
    save(items);
    return item;
  }

  function retry(id) {
    update(id, { status: 'pending', lastError: '' });
    return start(id);
  }

  function append(items) {
    const current = list();
    const links = new Set(current.map(item => S.cleanLink(item.link)));
    let added = 0;
    for (const item of items) {
      const link = S.cleanLink(item.link);
      if (!link || links.has(link)) continue;
      current.push({
        ...item,
        queueId: `v10-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        status: 'pending',
        retryCount: 0,
        lastError: ''
      });
      links.add(link);
      added++;
    }
    save(current);
    return added;
  }

  global.CbV10Queue = { list, save, normalize, update, start, confirm, retry, append };
})(window);
