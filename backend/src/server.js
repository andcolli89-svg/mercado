'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const FILE = process.env.DATA_FILE || path.join(__dirname, '../data/db.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE,'utf8')); }
  catch (_) { return {campaigns:{},clicks:[]}; }
}
function save(data) {
  fs.mkdirSync(path.dirname(FILE),{recursive:true});
  fs.writeFileSync(FILE,JSON.stringify(data,null,2));
}
function respond(res,status,body,headers={}) {
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*',...headers});
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve,reject)=>{
    let raw='';
    req.on('data',c=>raw+=c);
    req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{});}catch(error){reject(error);}});
    req.on('error',reject);
  });
}

const server = http.createServer(async (req,res)=>{
  const url = new URL(req.url,`http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204,{
      'access-control-allow-origin':'*',
      'access-control-allow-methods':'GET,POST,OPTIONS',
      'access-control-allow-headers':'content-type'
    });
    return res.end();
  }

  if (req.method === 'GET' && url.pathname === '/health')
    return respond(res,200,{ok:true,version:'12.0.0'});

  if (req.method === 'POST' && url.pathname === '/api/campaigns') {
    try {
      const input = await readBody(req);
      if (!/^https?:\/\//i.test(String(input.target||'')))
        return respond(res,400,{error:'target inválido'});
      const data = load();
      const id = String(input.id || crypto.randomUUID().slice(0,8));
      data.campaigns[id] = {
        id,
        target:input.target,
        title:String(input.title||''),
        channel:String(input.channel||''),
        createdAt:Date.now()
      };
      save(data);
      return respond(res,201,data.campaigns[id]);
    } catch (_) {
      return respond(res,400,{error:'JSON inválido'});
    }
  }

  const redirect = url.pathname.match(/^\/r\/([A-Za-z0-9_-]+)$/);
  if (req.method === 'GET' && redirect) {
    const data = load();
    const campaign = data.campaigns[redirect[1]];
    if (!campaign) return respond(res,404,{error:'campanha não encontrada'});
    data.clicks.push({
      id:crypto.randomUUID(),
      campaignId:campaign.id,
      channel:campaign.channel,
      at:Date.now(),
      userAgent:req.headers['user-agent']||''
    });
    save(data);
    res.writeHead(302,{location:campaign.target,'cache-control':'no-store'});
    return res.end();
  }

  if (req.method === 'GET' && url.pathname === '/api/stats') {
    const data = load();
    const grouped = {};
    for (const click of data.clicks) {
      const campaign = data.campaigns[click.campaignId] || {};
      grouped[click.campaignId] ??= {
        campaignId:click.campaignId,
        title:campaign.title||'',
        channel:campaign.channel||'',
        clicks:0
      };
      grouped[click.campaignId].clicks++;
    }
    return respond(res,200,{totalClicks:data.clicks.length,campaigns:Object.values(grouped)});
  }

  return respond(res,404,{error:'rota não encontrada'});
});

server.listen(PORT,()=>console.log(`CbOfertas V12 backend na porta ${PORT}`));
