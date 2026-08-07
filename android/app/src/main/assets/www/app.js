'use strict';

const AUTO_KEY = 'cbv122_automation';
const AUTO_RUN_KEY = 'cbv122_automation_running';
const AUTO_SENT_TODAY_KEY = 'cbv122_sent_today';
const AUTO_BURST_KEY = 'cbv122_burst_state';
const AUTO_NEXT_AT_KEY = 'cbv122_next_at';
let autoTimer = null;

function autoRead() {
  try {
    return {
      app:'business',
      group:'GRUPO DE OFERTAS CB #1 🛒',
      perRound:3,
      roundInterval:30,
      internalInterval:20,
      dailyLimit:80,
      openDelay:2500,
      groupDelay:1600,
      returnDelay:1400,
      attempts:3,
      clickStrategy:'fallback',
      stopOnError:true,
      ...JSON.parse(localStorage.getItem(AUTO_KEY) || '{}')
    };
  } catch (_) {
    return {
      app:'business',
      group:'GRUPO DE OFERTAS CB #1 🛒',
      perRound:3,
      roundInterval:30,
      internalInterval:20,
      dailyLimit:80,
      openDelay:2500,
      groupDelay:1600,
      returnDelay:1400,
      attempts:3,
      clickStrategy:'fallback',
      stopOnError:true
    };
  }
}

function autoSaveFromForm() {
  const config = {
    app: document.getElementById('automationApp')?.value || 'business',
    group: document.getElementById('automationGroup')?.value.trim() || '',
    perRound: Math.max(1, Number(document.getElementById('automationPerRound')?.value || 3)),
    roundInterval: Math.max(1, Number(document.getElementById('automationRoundInterval')?.value || 30)),
    internalInterval: Math.max(5, Number(document.getElementById('automationInternalInterval')?.value || 20)),
    dailyLimit: Math.max(1, Number(document.getElementById('automationDailyLimit')?.value || 80)),
    openDelay: Math.max(300, Number(document.getElementById('automationOpenDelay')?.value || 2500)),
    groupDelay: Math.max(200, Number(document.getElementById('automationGroupDelay')?.value || 1600)),
    returnDelay: Math.max(400, Number(document.getElementById('automationReturnDelay')?.value || 1400)),
    attempts: Math.max(1, Number(document.getElementById('automationAttempts')?.value || 3)),
    clickStrategy: document.getElementById('automationClickStrategy')?.value || 'fallback',
    stopOnError: Boolean(document.getElementById('automationStopOnError')?.checked)
  };
  localStorage.setItem(AUTO_KEY, JSON.stringify(config));
  return config;
}

function autoLoadForm() {
  const c = autoRead();
  const assign = (id,value) => {
    const node=document.getElementById(id);
    if(node) node.value=String(value);
  };
  assign('automationApp',c.app);
  assign('automationGroup',c.group);
  assign('automationPerRound',c.perRound);
  assign('automationRoundInterval',c.roundInterval);
  assign('automationInternalInterval',c.internalInterval);
  assign('automationDailyLimit',c.dailyLimit);
  assign('automationOpenDelay',c.openDelay);
  assign('automationGroupDelay',c.groupDelay);
  assign('automationReturnDelay',c.returnDelay);
  assign('automationAttempts',c.attempts);
  assign('automationClickStrategy',c.clickStrategy);

  const stop=document.getElementById('automationStopOnError');
  if(stop) stop.checked = c.stopOnError !== false;
}

function autoSetStatus(message,error=false) {
  const node=document.getElementById('automationStatus');
  if(node){
    node.textContent=message;
    node.className=`status ${error?'error':'success'}`;
  }
  const badge=document.getElementById('automationStateBadge');
  if(badge) {
    badge.textContent=localStorage.getItem(AUTO_RUN_KEY)==='true'?'Ativo':'Parado';
  }
}

function autoTodayCount() {
  try {
    const data=JSON.parse(localStorage.getItem(AUTO_SENT_TODAY_KEY)||'{}');
    const today=new Date().toISOString().slice(0,10);
    return data.date===today?Number(data.count||0):0;
  } catch (_) {
    return 0;
  }
}

function autoIncrementToday() {
  const today=new Date().toISOString().slice(0,10);
  localStorage.setItem(
    AUTO_SENT_TODAY_KEY,
    JSON.stringify({date:today,count:autoTodayCount()+1})
  );
}

function autoBurstState() {
  try {
    return {
      sentInRound:0,
      round:1,
      ...JSON.parse(localStorage.getItem(AUTO_BURST_KEY)||'{}')
    };
  } catch (_) {
    return {sentInRound:0,round:1};
  }
}

function autoSaveBurst(state) {
  localStorage.setItem(AUTO_BURST_KEY,JSON.stringify(state));
}

function autoResetBurst() {
  autoSaveBurst({sentInRound:0,round:1});
  localStorage.removeItem(AUTO_NEXT_AT_KEY);
}

function autoPendingItem() {
  return read(K.queue).find(item => item.status==='pending' || !item.status);
}

function autoSendingItem() {
  return read(K.queue).find(item => item.status==='sending');
}

function autoMessageText(item) {
  return String(
    item?.message ||
    `${item?.title || ''}\n${item?.price ? money(item.price) : ''}\n${item?.link || ''}`
  ).trim();
}

function autoStrategyCode(strategy) {
  if(strategy==='coordinates') return 1;
  if(strategy==='fallback') return 2;
  return 0;
}

function autoStartItem(item) {
  if(!item) return false;
  const c=autoRead();

  if(!window.Android?.startAutomaticMessage) {
    autoSetStatus('APK sem a ponte da automação.',true);
    return false;
  }
  if(!c.group) {
    autoSetStatus('Configure o nome exato do grupo.',true);
    return false;
  }

  const started=Android.startAutomaticMessage(
    String(item.id),
    autoMessageText(item),
    c.group,
    c.app==='business',
    c.openDelay,
    c.groupDelay,
    c.returnDelay,
    c.attempts,
    c.stopOnError,
    autoStrategyCode(c.clickStrategy)
  );

  if(started) {
    localStorage.removeItem(AUTO_NEXT_AT_KEY);
    updateQueue(item.id,{status:'sending',lastError:''});
    autoSetStatus(`Enviando: ${item.title}`);
  } else {
    updateQueue(item.id,{
      status:'failed',
      lastError:'Não foi possível abrir o WhatsApp.'
    });
    autoSetStatus('Não foi possível abrir o WhatsApp.',true);
  }
  return started;
}

function autoScheduleNext(delayMs,message) {
  if(autoTimer) clearTimeout(autoTimer);
  const safeDelay=Math.max(1000,Number(delayMs)||1000);
  localStorage.setItem(AUTO_NEXT_AT_KEY,String(Date.now()+safeDelay));
  autoSetStatus(message);
  autoTimer=setTimeout(autoRunNext,safeDelay);
}

function autoRunNext() {
  if(localStorage.getItem(AUTO_RUN_KEY)!=='true') return;
  const c=autoRead();

  if(autoSendingItem()) {
    autoSetStatus('Aguardando a mensagem atual terminar.');
    return;
  }

  if(autoTodayCount() >= c.dailyLimit) {
    localStorage.setItem(AUTO_RUN_KEY,'false');
    autoSetStatus(`Limite diário de ${c.dailyLimit} atingido.`);
    return;
  }

  const pending=autoPendingItem();
  if(!pending) {
    localStorage.setItem(AUTO_RUN_KEY,'false');
    localStorage.removeItem(AUTO_NEXT_AT_KEY);
    autoSetStatus('Fila concluída.');
    return;
  }

  autoStartItem(pending);
}

function autoAfterSuccessfulSend() {
  const c=autoRead();
  const state=autoBurstState();
  state.sentInRound=Number(state.sentInRound||0)+1;

  const hasPending=Boolean(autoPendingItem());
  if(!hasPending) {
    autoSaveBurst(state);
    localStorage.setItem(AUTO_RUN_KEY,'false');
    autoSetStatus('Fila concluída.');
    return;
  }

  if(state.sentInRound >= c.perRound) {
    state.sentInRound=0;
    state.round=Number(state.round||1)+1;
    autoSaveBurst(state);
    autoScheduleNext(
      c.roundInterval*60000,
      `Rodada concluída. Próxima rodada em ${c.roundInterval} minuto(s).`
    );
  } else {
    autoSaveBurst(state);
    autoScheduleNext(
      c.internalInterval*1000,
      `${state.sentInRound}/${c.perRound} enviada(s) nesta rodada. Próxima em ${c.internalInterval} segundo(s).`
    );
  }
}

function autoProcessResult() {
  if(!window.Android?.getAutomationLastResult) return;

  let raw='';
  try {
    raw=Android.getAutomationLastResult() || '';
  } catch (_) {}

  if(!raw) return;

  let result;
  try {
    result=JSON.parse(raw);
  } catch (_) {
    return;
  }

  try {
    Android.clearAutomationLastResult();
  } catch (_) {}

  if(result.status==='sent') {
    const queue=read(K.queue);
    const index=queue.findIndex(
      item=>String(item.id)===String(result.jobId)
    );

    if(index>=0) {
      const [item]=queue.splice(index,1);
      save(K.queue,queue);

      const history=read(K.history);
      history.unshift({
        ...item,
        message:cleanCoupons(item.message),
        status:'sent',
        sentAt:Date.now(),
        automatic:true
      });
      history.splice(settings().historyLimit);
      save(K.history,history);

      autoIncrementToday();
      renderQueue();
      renderHistory();

      if(localStorage.getItem(AUTO_RUN_KEY)==='true') {
        autoAfterSuccessfulSend();
      } else {
        autoSetStatus('Mensagem enviada automaticamente.');
      }
    } else {
      // Resultado de uma mensagem de teste.
      autoSetStatus('Teste enviado e automação validada.');
    }
  } else if(result.status==='failed') {
    if(result.jobId) {
      updateQueue(result.jobId,{
        status:'failed',
        lastError:result.message||'Falha na automação.'
      });
    }

    autoSetStatus(result.message||'Falha na automação.',true);

    if(autoRead().stopOnError) {
      localStorage.setItem(AUTO_RUN_KEY,'false');
      localStorage.removeItem(AUTO_NEXT_AT_KEY);
    } else {
      autoScheduleNext(
        autoRead().internalInterval*1000,
        'Falha registrada. Tentando a próxima mensagem.'
      );
    }
  } else if(result.status==='stopped') {
    localStorage.setItem(AUTO_RUN_KEY,'false');
    localStorage.removeItem(AUTO_NEXT_AT_KEY);
    autoSetStatus('Automação interrompida.');
  }
}

function autoRefreshCalibration() {
  if(!window.Android?.getCalibrationData) return;

  try {
    const data=JSON.parse(Android.getCalibrationData()||'{}');
    const assign=(id,value)=>{
      const node=document.getElementById(id);
      if(node && document.activeElement!==node) node.value=String(value||0);
    };

    assign('calibrationGroupX',data.groupX);
    assign('calibrationGroupY',data.groupY);
    assign('calibrationSendX',data.sendX);
    assign('calibrationSendY',data.sendY);

    const statusNode=document.getElementById('calibrationStatus');
    if(statusNode && data.result) {
      try {
        const result=JSON.parse(data.result);
        statusNode.textContent=result.message||data.result;
        statusNode.className=`status ${
          result.status==='failed'?'error':'success'
        }`;
      } catch (_) {
        statusNode.textContent=data.result;
      }
    }
  } catch (_) {}
}

function autoDiagnostic() {
  const c=autoRead();
  const burst=autoBurstState();
  const out=document.getElementById('automationDiagnostic');
  let service=false;

  try {
    service=Boolean(Android?.isAutomationServiceEnabled?.());
  } catch (_) {}

  const nextAt=Number(localStorage.getItem(AUTO_NEXT_AT_KEY)||0);
  const nextText=nextAt>Date.now()
    ? new Date(nextAt).toLocaleTimeString('pt-BR')
    : 'agora';

  if(out) out.textContent=[
    'Versão: 12.2.0',
    `Acessibilidade: ${service?'ativa':'inativa'}`,
    `Aplicativo: ${c.app==='business'?'WhatsApp Business':'WhatsApp comum'}`,
    `Destino: ${c.group || 'não configurado'}`,
    `Rodada: ${c.perRound} mensagem(ns)`,
    `Intervalo interno: ${c.internalInterval} segundo(s)`,
    `Intervalo entre rodadas: ${c.roundInterval} minuto(s)`,
    `Progresso da rodada: ${burst.sentInRound}/${c.perRound}`,
    `Próxima execução: ${nextText}`,
    `Estratégia: ${c.clickStrategy}`,
    `Limite diário: ${c.dailyLimit}`,
    `Enviadas hoje: ${autoTodayCount()}`,
    `Fila pendente: ${read(K.queue).filter(i=>i.status==='pending'||!i.status).length}`
  ].join('\n');

  const count=document.getElementById('queueTransferCount');
  if(count) count.textContent=String(read(K.queue).length);
}

function autoResume() {
  if(localStorage.getItem(AUTO_RUN_KEY)!=='true') return;
  if(autoSendingItem()) return;

  const nextAt=Number(localStorage.getItem(AUTO_NEXT_AT_KEY)||0);
  if(nextAt>Date.now()) {
    autoScheduleNext(
      nextAt-Date.now(),
      `Fila retomada. Próxima execução às ${new Date(nextAt).toLocaleTimeString('pt-BR')}.`
    );
  } else {
    autoRunNext();
  }
}


const K = {
  offers: 'cbv12_offers',
  batch: 'cbv12_batch',
  queue: 'cbv12_queue',
  history: 'cbv12_history',
  report: 'cbv12_report',
  campaigns: 'cbv12_campaigns',
  settings: 'cbv12_settings'
};

const $ = id => document.getElementById(id);
const read = (key, fallback=[]) => {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch (_) { return fallback; }
};
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = value => Number(String(value ?? '').replace(/[^\d,.-]/g,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.')) || 0;
const money = value => Number(value || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const cleanCoupons = text => String(text || '').split(/\r?\n/).filter(line => !/cupom|use o código|código promocional/i.test(line)).join('\n').replace(/\n{3,}/g,'\n\n').trim();

let parsedReport = [];

function status(id, message, error=false) {
  const node = $(id);
  if (!node) return;
  node.textContent = message;
  node.className = `status ${error ? 'error' : 'success'}`;
}

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  $(`${name}Page`)?.classList.add('active');
  document.querySelectorAll('[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === name));
  $('drawer').classList.remove('open');
  $('overlay').classList.remove('show');
  if (name === 'dashboard') renderDashboard();
  if (name === 'offers') renderOffers();
  if (name === 'batch') renderBatch();
  if (name === 'queue') renderQueue();
  if (name === 'history') renderHistory();
  if (name === 'campaigns') renderCampaigns();
}

document.addEventListener('click', event => {
  const page = event.target.closest('[data-page]');
  if (page) {
    event.preventDefault();
    showPage(page.dataset.page);
  }
});
$('menuBtn').onclick = () => { $('drawer').classList.add('open'); $('overlay').classList.add('show'); };
$('overlay').onclick = () => { $('drawer').classList.remove('open'); $('overlay').classList.remove('show'); };

function settings() {
  return {...{historyLimit:500,defaultGroup:'GRUPO DE OFERTAS CB #1 🛒'}, ...read(K.settings,{})};
}

function offerCard(item, mode='offers') {
  const checked = mode === 'batch' ? `<input type="checkbox" data-batch-check="${esc(item.id)}">` : '';
  const image = item.image ? `<img src="${esc(item.image)}" alt="">` : `<div style="width:72px;height:72px;background:#eef2ee;border-radius:10px;display:grid;place-items:center">🛍️</div>`;
  let actions = '';
  if (mode === 'offers') {
    actions = `<div class="item-actions">
      <button data-add-batch="${esc(item.id)}">Adicionar ao lote</button>
      <button data-add-queue="${esc(item.id)}">Adicionar à fila</button>
      <button data-send-offer="${esc(item.id)}" class="whatsapp">WhatsApp</button>
      <button data-delete-offer="${esc(item.id)}" class="danger">Excluir</button>
    </div>`;
  }
  return `<article class="item">${checked}${image}<div><b>${esc(item.title)}</b><small>${esc(item.link)}</small><div class="tags"><span class="tag">${money(item.price)}</span><span class="tag">${esc(item.category||'Sem categoria')}</span><span class="tag">${esc(item.channel||'Sem canal')}</span></div></div>${actions}</article>`;
}

function renderOffers() {
  const items = read(K.offers);
  $('offerCount').textContent = items.length;
  $('offerList').innerHTML = items.length ? items.map(i => offerCard(i)).join('') : '<p>Nenhuma oferta salva.</p>';
  $('campaignOffer').innerHTML = '<option value="">Selecione...</option>' + items.map(i => `<option value="${esc(i.id)}">${esc(i.title)}</option>`).join('');
}

$('saveOffer').onclick = () => {
  const title = $('offerTitle').value.trim();
  const link = $('offerLink').value.trim();
  if (!title || !link) return status('offerStatus','Informe título e link.',true);
  const items = read(K.offers);
  items.unshift({
    id: uid(), title, link,
    price: num($('offerPrice').value),
    category: $('offerCategory').value.trim(),
    channel: $('offerChannel').value.trim(),
    image: $('offerImage').value.trim(),
    message: $('offerMessage').value.trim(),
    createdAt: Date.now()
  });
  save(K.offers, items);
  ['offerTitle','offerLink','offerPrice','offerCategory','offerChannel','offerImage','offerMessage'].forEach(id => $(id).value='');
  status('offerStatus','Oferta salva.');
  renderOffers();
};

$('clearOfferForm').onclick = () => ['offerTitle','offerLink','offerPrice','offerCategory','offerChannel','offerImage','offerMessage'].forEach(id => $(id).value='');

document.addEventListener('click', event => {
  const del = event.target.closest('[data-delete-offer]');
  if (del) {
    save(K.offers, read(K.offers).filter(i => i.id !== del.dataset.deleteOffer));
    renderOffers();
  }
  const batch = event.target.closest('[data-add-batch]');
  if (batch) addToUniqueList(K.batch, findOffer(batch.dataset.addBatch));
  const queue = event.target.closest('[data-add-queue]');
  if (queue) addQueue(findOffer(queue.dataset.addQueue));
  const send = event.target.closest('[data-send-offer]');
  if (send) shareOffer(findOffer(send.dataset.sendOffer));
});

function findOffer(id) {
  return read(K.offers).find(i => i.id === id);
}

function addToUniqueList(key, item) {
  if (!item) return;
  const items = read(key);
  if (!items.some(i => i.id === item.id)) items.push(item);
  save(key, items);
}

function renderBatch() {
  const items = read(K.batch);
  $('batchList').innerHTML = items.length ? items.map(i => offerCard(i,'batch')).join('') : '<p>Nenhuma oferta no lote.</p>';
}

$('selectAllBatch').onclick = () => document.querySelectorAll('[data-batch-check]').forEach(c => c.checked = true);
$('clearBatchSelection').onclick = () => document.querySelectorAll('[data-batch-check]').forEach(c => c.checked = false);
function selectedBatch() {
  const ids = new Set([...document.querySelectorAll('[data-batch-check]:checked')].map(c => c.dataset.batchCheck));
  return read(K.batch).filter(i => ids.has(i.id));
}
$('batchToQueue').onclick = () => {
  const items = selectedBatch();
  if (!items.length) return status('batchStatus','Selecione pelo menos uma oferta.',true);
  items.forEach(addQueue);
  status('batchStatus',`${items.length} oferta(s) adicionada(s) à fila.`);
};
$('batchSendNow').onclick = () => {
  const item = selectedBatch()[0];
  if (!item) return status('batchStatus','Selecione uma oferta.',true);
  shareOffer(item);
};

function addQueue(item) {
  if (!item) return;
  const queue = read(K.queue);
  if (!queue.some(q => q.offerId === item.id && q.status !== 'sent')) {
    queue.push({id:uid(),offerId:item.id,...item,status:'pending',createdAt:Date.now(),retryCount:0});
    save(K.queue,queue);
  }
}

function renderQueue() {
  const items = read(K.queue);
  $('queueList').innerHTML = items.length ? items.map(item => `<article class="item">
    <div><b>${esc(item.title)}</b><small>Status: ${esc(item.status)}</small><small>${item.lastError ? esc(item.lastError) : ''}</small></div>
    <div class="item-actions">
      <button data-queue-send="${esc(item.id)}" class="whatsapp">Abrir WhatsApp</button>
      ${item.status === 'waiting_confirmation' ? `<button data-queue-confirm="${esc(item.id)}" class="primary">Confirmar envio</button>` : ''}
      ${item.status === 'failed' ? `<button data-queue-retry="${esc(item.id)}">Tentar novamente</button>` : ''}
      <button data-queue-delete="${esc(item.id)}" class="danger">Excluir</button>
    </div>
  </article>`).join('') : '<p>Fila vazia.</p>';
}

function updateQueue(id, patch) {
  const items = read(K.queue);
  const item = items.find(i => i.id === id);
  if (item) Object.assign(item, patch, {updatedAt:Date.now()});
  save(K.queue,items);
  renderQueue();
}

function shareOffer(item) {
  if (!item) return;
  const text = item.message || `${item.title}\n${item.price ? money(item.price) : ''}\n${item.link}`.trim();
  try {
    if (window.Android?.shareToWhatsAppBusiness) Android.shareToWhatsAppBusiness(text);
    else if (navigator.share) navigator.share({text});
    else navigator.clipboard.writeText(text);
  } catch (_) {}
}

document.addEventListener('click', event => {
  const send = event.target.closest('[data-queue-send]');
  if (send) {
    const item = read(K.queue).find(i => i.id === send.dataset.queueSend);
    try {
      shareOffer(item);
      updateQueue(item.id,{status:'waiting_confirmation',lastError:''});
    } catch (error) {
      updateQueue(item.id,{status:'failed',lastError:error.message,retryCount:Number(item.retryCount||0)+1});
    }
  }
  const confirm = event.target.closest('[data-queue-confirm]');
  if (confirm) {
    const queue = read(K.queue);
    const index = queue.findIndex(i => i.id === confirm.dataset.queueConfirm);
    if (index >= 0) {
      const [item] = queue.splice(index,1);
      save(K.queue,queue);
      const history = read(K.history);
      history.unshift({...item,message:cleanCoupons(item.message),status:'sent',sentAt:Date.now()});
      history.splice(settings().historyLimit);
      save(K.history,history);
      renderQueue();
    }
  }
  const retry = event.target.closest('[data-queue-retry]');
  if (retry) updateQueue(retry.dataset.queueRetry,{status:'pending',lastError:''});
  const del = event.target.closest('[data-queue-delete]');
  if (del) { save(K.queue,read(K.queue).filter(i=>i.id!==del.dataset.queueDelete)); renderQueue(); }
});

function renderHistory() {
  const items = read(K.history);
  $('historyList').innerHTML = items.length ? items.map(item => `<article class="item"><div><b>${esc(item.title)}</b><small>${new Date(item.sentAt).toLocaleString('pt-BR')}</small><small>${esc(item.message||'')}</small></div></article>`).join('') : '<p>Histórico vazio.</p>';
}
$('clearHistory').onclick = () => { if (confirm('Apagar histórico?')) { save(K.history,[]); renderHistory(); } };

function detectSep(text) {
  const first = text.split(/\r?\n/)[0] || '';
  return [';',',','\t'].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
}
function norm(s) {
  return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
}
function splitCsv(line, sep) {
  return line.split(sep).map(v => v.trim().replace(/^"|"$/g,'').replace(/""/g,'"'));
}
function findCol(headers, terms) {
  return headers.findIndex(h => terms.some(t => norm(h).includes(norm(t))));
}
function parseReport(text) {
  const lines = text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const sep = detectSep(text);
  const headers = splitCsv(lines[0],sep);
  const idx = {
    product:findCol(headers,['produto','item','titulo','anuncio','nome']),
    clicks:findCol(headers,['cliques','clicks']),
    sales:findCol(headers,['vendas','unidades vendidas','pedidos','quantidade']),
    revenue:findCol(headers,['faturamento','receita','vendas brutas','valor vendido']),
    commission:findCol(headers,['comissao','ganhos','receita afiliado']),
    channel:findCol(headers,['canal','etiqueta','tag','campanha'])
  };
  return lines.slice(1).map((line,index)=>{
    const c = splitCsv(line,sep);
    return {
      id:`report-${Date.now()}-${index}`,
      product:c[idx.product] || `Produto ${index+1}`,
      clicks:num(c[idx.clicks]),
      sales:num(c[idx.sales]),
      revenue:num(c[idx.revenue]),
      commission:num(c[idx.commission]),
      channel:c[idx.channel] || 'Sem canal'
    };
  });
}
function previewReport(rows) {
  $('reportPreview').innerHTML = rows.length ? `<table><thead><tr><th>Produto</th><th>Cliques</th><th>Vendas</th><th>Faturamento</th><th>Comissão</th><th>Canal</th></tr></thead><tbody>${rows.slice(0,30).map(r=>`<tr><td>${esc(r.product)}</td><td>${r.clicks}</td><td>${r.sales}</td><td>${money(r.revenue)}</td><td>${money(r.commission)}</td><td>${esc(r.channel)}</td></tr>`).join('')}</tbody></table>` : '<p>Nenhum dado.</p>';
}
$('reportFile').onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  parsedReport = parseReport(await file.text());
  previewReport(parsedReport);
  status('importStatus',`${parsedReport.length} linha(s) reconhecida(s).`);
};
$('importReport').onclick = () => {
  if (!parsedReport.length) return status('importStatus','Selecione um arquivo válido.',true);
  save(K.report,parsedReport);
  status('importStatus','Relatório importado.');
  renderDashboard();
};
$('clearReport').onclick = () => { save(K.report,[]); parsedReport=[]; previewReport([]); renderDashboard(); };

function aggregate(rows,key) {
  const map = new Map();
  for (const r of rows) {
    const name = r[key] || 'Sem informação';
    const current = map.get(name) || {name,clicks:0,sales:0,revenue:0,commission:0};
    current.clicks += num(r.clicks);
    current.sales += num(r.sales);
    current.revenue += num(r.revenue);
    current.commission += num(r.commission);
    map.set(name,current);
  }
  return [...map.values()];
}
function ranking(items,metric) {
  return items.sort((a,b)=>b[metric]-a[metric]).slice(0,10).map((x,i)=>`<div class="rank"><b>${i+1}</b><span>${esc(x.name)}</span><strong>${metric==='revenue'||metric==='commission'?money(x[metric]):x[metric]}</strong></div>`).join('') || '<p>Nenhum dado.</p>';
}
function renderDashboard() {
  const offers = read(K.offers);
  const rows = read(K.report);
  const total = rows.reduce((a,r)=>({clicks:a.clicks+num(r.clicks),sales:a.sales+num(r.sales),revenue:a.revenue+num(r.revenue),commission:a.commission+num(r.commission)}),{clicks:0,sales:0,revenue:0,commission:0});
  $('mOffers').textContent = offers.length;
  $('mClicks').textContent = total.clicks;
  $('mSales').textContent = total.sales;
  $('mRevenue').textContent = money(total.revenue);
  $('mCommission').textContent = money(total.commission);
  const products = aggregate(rows,'product');
  $('topClicks').innerHTML = ranking([...products],'clicks');
  $('topSales').innerHTML = ranking([...products],'sales');
  const channels = aggregate(rows,'channel').sort((a,b)=>b.revenue-a.revenue);
  $('channelStats').innerHTML = channels.length ? `<table><thead><tr><th>Canal</th><th>Cliques</th><th>Vendas</th><th>Faturamento</th><th>Comissão</th></tr></thead><tbody>${channels.map(c=>`<tr><td>${esc(c.name)}</td><td>${c.clicks}</td><td>${c.sales}</td><td>${money(c.revenue)}</td><td>${money(c.commission)}</td></tr>`).join('')}</tbody></table>` : '<p>Nenhum dado.</p>';
}

function renderCampaigns() {
  renderOffers();
  const items = read(K.campaigns);
  $('campaignList').innerHTML = items.length ? items.map(c=>`<article class="item"><div><b>${esc(c.offerTitle)}</b><small>${esc(c.channel)}</small><small>${esc(c.trackingUrl)}</small></div><div class="item-actions"><button data-copy-campaign="${esc(c.trackingUrl)}">Copiar</button></div></article>`).join('') : '<p>Nenhuma campanha.</p>';
}
$('createCampaign').onclick = () => {
  const offer = findOffer($('campaignOffer').value);
  const channel = $('campaignChannel').value.trim();
  const base = $('trackerBase').value.trim().replace(/\/$/,'');
  if (!offer || !channel || !base) return status('campaignStatus','Preencha todos os campos.',true);
  const campaigns = read(K.campaigns);
  const id = uid().slice(0,8);
  campaigns.unshift({id,offerId:offer.id,offerTitle:offer.title,target:offer.link,channel,trackingUrl:`${base}/r/${id}`,createdAt:Date.now()});
  save(K.campaigns,campaigns);
  renderCampaigns();
  status('campaignStatus','Campanha criada.');
};
document.addEventListener('click', async event => {
  const copy = event.target.closest('[data-copy-campaign]');
  if (copy) {
    await navigator.clipboard.writeText(copy.dataset.copyCampaign);
    status('campaignStatus','Link copiado.');
  }
});

function loadSettings() {
  const s = settings();
  $('historyLimit').value = String(s.historyLimit);
  $('defaultGroup').value = s.defaultGroup;
}
$('historyLimit').onchange = () => save(K.settings,{...settings(),historyLimit:Number($('historyLimit').value)});
$('defaultGroup').onchange = () => save(K.settings,{...settings(),defaultGroup:$('defaultGroup').value.trim()});

$('exportBackup').onclick = () => {
  const data = {version:'12.0.0'};
  Object.entries(K).forEach(([name,key]) => data[name] = read(key, name==='settings'?{}:[]));
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'cbofertas-v12-backup.json';
  a.click();
  URL.revokeObjectURL(a.href);
};
$('restoreBackup').onchange = async event => {
  try {
    const data = JSON.parse(await event.target.files[0].text());
    Object.entries(K).forEach(([name,key]) => save(key,data[name] || (name==='settings'?{}:[])));
    status('settingsStatus','Backup restaurado.');
    location.reload();
  } catch (_) {
    status('settingsStatus','Backup inválido.',true);
  }
};
$('resetAll').onclick = () => {
  if (!confirm('Apagar todos os dados?')) return;
  Object.values(K).forEach(key => localStorage.removeItem(key));
  location.reload();
};

renderOffers();
renderBatch();
renderQueue();
renderHistory();
renderCampaigns();
renderDashboard();
loadSettings();


document.addEventListener('DOMContentLoaded', () => {
  autoLoadForm();
  autoRefreshCalibration();
  autoDiagnostic();
  autoSetStatus(
    localStorage.getItem(AUTO_RUN_KEY)==='true'
      ? 'Automação ativa.'
      : 'Configure e calibre o perfil deste aparelho.'
  );

  document.querySelectorAll(
    '#automationApp,#automationGroup,#automationPerRound,' +
    '#automationRoundInterval,#automationInternalInterval,' +
    '#automationDailyLimit,#automationOpenDelay,' +
    '#automationGroupDelay,#automationReturnDelay,' +
    '#automationAttempts,#automationClickStrategy,' +
    '#automationStopOnError'
  ).forEach(node => node?.addEventListener('change', () => {
    autoSaveFromForm();
    autoDiagnostic();
  }));

  document.getElementById('openAccessibility')?.addEventListener('click', () => {
    try {
      Android.openAccessibilitySettings();
    } catch (_) {
      autoSetStatus('Abra Configurações > Acessibilidade.',true);
    }
  });

  document.getElementById('calibrateGroup')?.addEventListener('click', () => {
    autoSaveFromForm();
    const c=autoRead();
    try {
      const opened=Android.startCalibration(
        'group',
        c.app==='business'
      );
      if(opened) {
        document.getElementById('calibrationStatus').textContent=
          'No WhatsApp, toque uma vez no grupo ou contato desejado.';
      }
    } catch (_) {
      autoSetStatus('Não foi possível iniciar a calibração.',true);
    }
  });

  document.getElementById('calibrateSend')?.addEventListener('click', () => {
    autoSaveFromForm();
    const c=autoRead();
    if(!confirm(
      'A calibração do botão Enviar fará um envio real. Use uma conversa de teste. Continuar?'
    )) return;

    try {
      const opened=Android.startCalibration(
        'send',
        c.app==='business'
      );
      if(opened) {
        document.getElementById('calibrationStatus').textContent=
          'Selecione uma conversa de teste e toque no botão Enviar.';
      }
    } catch (_) {
      autoSetStatus('Não foi possível iniciar a calibração.',true);
    }
  });

  document.getElementById('saveManualCalibration')?.addEventListener('click', () => {
    try {
      Android.saveCalibrationCoordinates(
        Number(document.getElementById('calibrationGroupX')?.value||0),
        Number(document.getElementById('calibrationGroupY')?.value||0),
        Number(document.getElementById('calibrationSendX')?.value||0),
        Number(document.getElementById('calibrationSendY')?.value||0)
      );
      autoRefreshCalibration();
    } catch (_) {
      autoSetStatus('Não foi possível salvar as coordenadas.',true);
    }
  });

  document.getElementById('clearCalibration')?.addEventListener('click', () => {
    try {
      Android.clearCalibration();
      autoRefreshCalibration();
    } catch (_) {}
  });

  document.getElementById('testAutomation')?.addEventListener('click', () => {
    autoSaveFromForm();

    let service=false;
    try {
      service=Boolean(Android?.isAutomationServiceEnabled?.());
    } catch (_) {}

    if(!service) {
      return autoSetStatus(
        'Ative primeiro o serviço de Acessibilidade.',
        true
      );
    }

    const test={
      id:'test-'+Date.now(),
      title:'Teste CbOfertas',
      message:'✅ Teste de automação do CbOfertas V12.2',
      link:''
    };
    autoStartItem(test);
  });

  document.getElementById('startAutomaticQueue')?.addEventListener('click', () => {
    autoSaveFromForm();

    let service=false;
    try {
      service=Boolean(Android?.isAutomationServiceEnabled?.());
    } catch (_) {}

    if(!service) {
      return autoSetStatus(
        'Ative primeiro o serviço de Acessibilidade.',
        true
      );
    }

    if(!autoPendingItem()) {
      return autoSetStatus(
        'Não existem mensagens pendentes na fila.',
        true
      );
    }

    autoResetBurst();
    localStorage.setItem(AUTO_RUN_KEY,'true');
    autoSetStatus('Fila automática ativada. Enviando a primeira mensagem.');
    autoRunNext();
  });

  document.getElementById('stopAutomaticQueue')?.addEventListener('click', () => {
    localStorage.setItem(AUTO_RUN_KEY,'false');
    localStorage.removeItem(AUTO_NEXT_AT_KEY);
    if(autoTimer) clearTimeout(autoTimer);

    try {
      Android.stopAutomation();
    } catch (_) {}

    autoSetStatus('Automação interrompida.');
  });

  document.getElementById('exportQueue')?.addEventListener('click', () => {
    const payload={
      type:'cbofertas-queue',
      version:'12.2.0',
      exportedAt:new Date().toISOString(),
      queue:read(K.queue),
      automation:autoRead()
    };

    const blob=new Blob(
      [JSON.stringify(payload,null,2)],
      {type:'application/json'}
    );
    const link=document.createElement('a');
    link.href=URL.createObjectURL(blob);
    link.download=`cbofertas-fila-${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);

    status('queueTransferStatus','Fila exportada.');
  });

  document.getElementById('importQueueFile')?.addEventListener('change', async event => {
    const file=event.target.files?.[0];
    if(!file) return;

    try {
      const payload=JSON.parse(await file.text());
      const imported=Array.isArray(payload)
        ? payload
        : Array.isArray(payload.queue)
          ? payload.queue
          : [];

      if(!imported.length) {
        throw new Error('O arquivo não contém ofertas.');
      }

      const mode=document.getElementById('importQueueMode')?.value||'merge';
      let queue=mode==='replace'?[]:read(K.queue);

      const known=new Set(
        queue.map(item=>String(item.link||item.offerId||item.id||''))
      );

      let added=0;
      for(const source of imported) {
        const key=String(source.link||source.offerId||source.id||'');
        if(key && known.has(key)) continue;

        queue.push({
          ...source,
          id:source.id||uid(),
          status:'pending',
          lastError:'',
          importedAt:Date.now()
        });

        if(key) known.add(key);
        added++;
      }

      save(K.queue,queue);

      if(payload.automation && mode==='replace') {
        localStorage.setItem(AUTO_KEY,JSON.stringify({
          ...autoRead(),
          ...payload.automation
        }));
        autoLoadForm();
      }

      renderQueue();
      autoDiagnostic();
      status(
        'queueTransferStatus',
        `${added} oferta(s) importada(s).`
      );
    } catch (error) {
      status(
        'queueTransferStatus',
        error.message||'Arquivo de fila inválido.',
        true
      );
    } finally {
      event.target.value='';
    }
  });

  setInterval(() => {
    autoProcessResult();
    autoRefreshCalibration();
    autoDiagnostic();
  }, 1200);

  autoResume();
});

