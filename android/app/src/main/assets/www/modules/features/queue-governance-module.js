'use strict';
(function (global) {
  const HISTORY='cbofertas-publications', QUEUE='cbofertas-v6-queue',
        BATCH='cbofertas-v63-batch', LIMIT='cbofertas-history-limit',
        CONFIG='cbofertas-v6-config';

  const byId=id=>(document&&typeof document.getElementById==='function'?document.getElementById(id):null);
  const parse=(v,f)=>{try{return JSON.parse(v)}catch(_){return f}};
  const read=k=>{const v=parse(localStorage.getItem(k)||'[]',[]);return Array.isArray(v)?v:[]};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v||[]));
  const idOf=i=>String(i?.queueId||i?.batchId||i?.id||'');
  const linkOf=i=>String(i?.link||i?.originalLink||'').trim();

  function historyLimit(){return Math.max(50,Math.min(2000,Number(localStorage.getItem(LIMIT)||500)))}
  function stripCoupon(item){
    const clean={...item};
    ['coupon','couponCode','couponText','couponValidUntil','couponDiscount',
     'couponMinPrice','appliedCoupon','activeCoupon','couponId'].forEach(k=>delete clean[k]);
    ['message','finalText','text','description'].forEach(k=>{
      if(!clean[k])return;
      clean[k]=String(clean[k]).split(/\r?\n/)
        .filter(line=>!/(cupom|código promocional|use o código|desconto com código)/i.test(line))
        .join('\n').replace(/\n{3,}/g,'\n\n').trim();
    });
    return clean;
  }
  function saveHistory(item,extra={}){
    const list=read(HISTORY);
    list.unshift(stripCoupon({...item,...extra,status:'sent',sentAt:Date.now(),updatedAt:Date.now()}));
    list.splice(historyLimit());
    write(HISTORY,list);
    global.renderPublications?.();
  }
  function processResult(){
    try{
      if(!global.Android?.getAutomationLastResult)return;
      const r=parse(global.Android.getAutomationLastResult()||'{}',{});
      if(!r.id||!['send_triggered','sent','sent_unverified'].includes(r.status))return;
      const q=read(QUEUE), item=q.find(x=>idOf(x)===String(r.id));
      if(item){
        saveHistory(item,{automationStatus:r.status});
        write(QUEUE,q.filter(x=>idOf(x)!==String(r.id)));
        global.renderV6Queue?.();
      }
      global.Android.clearAutomationLastResult?.();
    }catch(_){}
  }
  function confirmed(i){return i?.affiliateConfirmed===true&&i?.affiliateConfirmationSource==='use_copied_link'}
  function selected(){
    const ids=new Set([...document.querySelectorAll('[data-batch-select]:checked')]
      .map(x=>String(x.dataset.batchSelect||x.value||'')));
    return read(BATCH).filter(x=>ids.has(idOf(x))||x.selected===true);
  }
  function status(msg,type=''){const n=byId('batchBulkStatus');if(n){n.textContent=msg;n.className=`status ${type}`}}
  function requireConfirmed(items){
    const n=items.filter(x=>!confirmed(x)).length;
    if(n)throw new Error(`${n} oferta(s) sem afiliado confirmado por “Usar link copiado”.`);
  }
  function ensureChecks(){
    const items=read(BATCH);
    document.querySelectorAll('[data-batch-id],.batch-item,.batch-card').forEach((card,index)=>{
      if(card.querySelector('[data-batch-select]'))return;
      const item=items[index]; if(!item)return;
      const check=document.createElement('input');
      check.type='checkbox'; check.dataset.batchSelect=idOf(item);
      check.className='batch-select-checkbox';
      card.prepend(check);
    });
  }
  function sendSelected(){
    try{
      const items=selected(); if(!items.length)throw new Error('Selecione pelo menos uma mensagem.');
      requireConfirmed(items);
      if(!global.Android?.shareMessagesSeparately)throw new Error('Função disponível apenas no aplicativo Android.');
      global.Android.shareSavedMessagesSeparately(JSON.stringify(items.map(i=>({
        text:i.message||i.finalText||i.text||'', image:i.image||i.imageUrl||''
      }))),true);
      items.forEach(i=>saveHistory(i,{sentMode:'manual_batch'}));
      if(!byId('keepBatchAfterSendCheck')?.checked){
        const ids=new Set(items.map(idOf));
        const next=read(BATCH).filter(i=>!ids.has(idOf(i)));
        global.saveV63Batch?.(next); if(!global.saveV63Batch)write(BATCH,next);
      }
      status(`${items.length} mensagem(ns) abertas no WhatsApp.`,'success');
    }catch(e){status(e.message,'error')}
  }
  function addPilot(){
    try{
      const items=selected(); if(!items.length)throw new Error('Selecione pelo menos uma mensagem.');
      requireConfirmed(items);
      const q=read(QUEUE), links=new Set(q.map(linkOf)); let added=0;
      items.forEach(i=>{if(links.has(linkOf(i)))return;q.push({...i,queueId:`q-${Date.now()}-${Math.random().toString(36).slice(2)}`,status:'pending',scheduledAt:0});links.add(linkOf(i));added++});
      write(QUEUE,q); global.buildV6Queue?.({preserveExisting:true}); global.renderV6Queue?.();
      status(`${added} mensagem(ns) adicionadas ao Piloto.`,'success');
    }catch(e){status(e.message,'error')}
  }
  function trim(){
    const list=read(HISTORY).map(stripCoupon);list.splice(historyLimit());write(HISTORY,list);
    const n=byId('historyStorageStatus');if(n)n.textContent=`Histórico: ${list.length}/${historyLimit()}`;
  }
  function firstSend(){
    if(!byId('sendFirstOnActivateCheck')?.checked)return;
    const first=read(QUEUE).find(i=>i.status==='pending'||!i.status);if(!first)return;
    if(!confirmed(first)){const n=byId('automationStatus');if(n)n.textContent='Primeira oferta sem afiliado confirmado.';return}
    const cfg=parse(localStorage.getItem(CONFIG)||'{}',{});
    global.Android?.testAutomaticShare?.(
      String(first.image||first.imageUrl||''),
      String(first.message||first.finalText||first.text||''),
      String(cfg.group||window.CB_DEFAULT_GROUP||''),
      false
    );
  }
  function wrapAffiliate(){
    const fn=global.useCopiedAffiliateLink||global.useCopiedLink;
    if(typeof fn!=='function'||fn.__cb87)return;
    const wrapped=async function(...args){
      const result=await fn.apply(this,args), list=read(BATCH), target=String(args[0]||'');
      const item=list.find(i=>idOf(i)===target);
      if(item){item.affiliateConfirmed=true;item.affiliateConfirmationSource='use_copied_link';item.affiliateConfirmedAt=Date.now();global.saveV63Batch?.(list);if(!global.saveV63Batch)write(BATCH,list)}
      return result;
    };wrapped.__cb87=true;
    if(global.useCopiedAffiliateLink===fn)global.useCopiedAffiliateLink=wrapped;
    if(global.useCopiedLink===fn)global.useCopiedLink=wrapped;
  }

  document.addEventListener('click',e=>{
    if(e.target.closest?.('#selectAllBatchBtn')){ensureChecks();document.querySelectorAll('[data-batch-select]').forEach(x=>x.checked=true)}
    if(e.target.closest?.('#clearBatchSelectionBtn'))document.querySelectorAll('[data-batch-select]').forEach(x=>x.checked=false);
    if(e.target.closest?.('#sendSelectedBatchWhatsAppBtn'))sendSelected();
    if(e.target.closest?.('#sendSelectedBatchPilotBtn'))addPilot();
    if(e.target.closest?.('#trimHistoryBtn'))trim();
  });
  document.addEventListener('change',e=>{
    if(e.target?.id==='historyLimitSelect'){localStorage.setItem(LIMIT,e.target.value);trim()}
    if(e.target?.id==='automationEnabledCheck'&&e.target.checked)setTimeout(firstSend,300);
  });
  function enforceStrictAffiliateState(){
    const list=read(BATCH);
    let changed=false;

    for(const item of list){
      const validSource=item?.affiliateConfirmationSource==='use_copied_link';
      if(!validSource && (item.affiliateConfirmed!==false || item.affiliateConfirmedAt)){
        item.affiliateConfirmed=false;
        item.affiliateConfirmedAt=0;
        item.affiliateConfirmationSource='';
        changed=true;
      }
    }

    if(changed){
      global.saveV63Batch?.(list);
      if(!global.saveV63Batch)write(BATCH,list);
    }

    document.querySelectorAll(
      '[data-affiliate-confirmed], input[name="affiliateConfirmed"], .affiliate-confirmed-checkbox'
    ).forEach((checkbox,index)=>{
      const item=list[index];
      checkbox.checked=Boolean(
        item?.affiliateConfirmed===true &&
        item?.affiliateConfirmationSource==='use_copied_link'
      );
      checkbox.disabled=true;
      checkbox.title='Confirmado somente pelo botão Usar link copiado';
    });
  }

  function init(){
    enforceStrictAffiliateState();
    const sel=byId('historyLimitSelect');if(sel)sel.value=String(historyLimit());
    trim();ensureChecks();wrapAffiliate();processResult();
    setInterval(()=>{processResult();ensureChecks();wrapAffiliate();enforceStrictAffiliateState()},900);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  global.CbQueueGovernance={stripCoupon,saveHistory,processResult};
})(window);
