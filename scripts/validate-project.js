'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const requiredFiles = [
  'backend/server.js',
  'backend/src/app.js',
  'backend/src/config.js',
  'backend/src/lib/http.js',
  'backend/src/lib/format.js',
  'backend/src/api/mercadoLivreApi.js',
  'backend/src/parsers/mercadoLivrePriceParser.js',
  'backend/src/parsers/shopeePriceParser.js',
  'backend/src/services/linkResolver.js',
  'backend/src/services/productService.js',
  'backend/src/services/radarService.js',
  'backend/src/services/imageService.js',
  'backend/test/smoke.test.js',
  'backend/test/price-parser.test.js',
  'scripts/smoke-webapp.js',
  'android/app/build.gradle',
  'android/app/src/main/AndroidManifest.xml',
  'android/app/src/main/assets/www/index.html',
  'android/app/src/main/assets/www/app.js',
  'android/app/src/main/assets/www/style.css',
  '.github/workflows/build-apk.yml'
];

const errors = [];
for (const relativePath of requiredFiles) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size === 0) errors.push(`Arquivo ausente ou vazio: ${relativePath}`);
}

const html = fs.readFileSync(path.join(root, 'android/app/src/main/assets/www/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'android/app/src/main/assets/www/app.js'), 'utf8');
const gradle = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/build-apk.yml'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
const parser = fs.readFileSync(path.join(root, 'backend/src/parsers/mercadoLivrePriceParser.js'), 'utf8');
const shopeeParser = fs.readFileSync(path.join(root, 'backend/src/parsers/shopeePriceParser.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'android/app/src/main/assets/www/style.css'), 'utf8');

for (const id of ['radarPage','historyPage','favoritesPage','couponsPage','favoritesList','affiliateLinkBtn','affiliateStatus','affiliateLibraryList','historyLowestPrice','historyBestDiscount','historyConsultations','historyLastConsultation']) {
  if (!html.includes(`id="${id}"`)) errors.push(`Interface sem o elemento #${id}`);
}
for (const marker of ['FAVORITES_STORAGE_KEY','PRODUCT_STATS_STORAGE_KEY','AFFILIATE_LIBRARY_STORAGE_KEY','saveAffiliateAssociation','affiliateFor','renderAffiliateLibrary','recordProductConsultation','renderHistorySummary','randomPhraseForTitle','CbOfertasReceiveSharedLink']) {
  if (!app.includes(marker)) errors.push(`app.js sem o recurso ${marker}`);
}
if (/Gerador de Mensagens|Gerar Nova Frase|class="style-chip"/.test(html)) errors.push('A interface antiga do Gerador de Mensagens ainda está visível');
if (/setSelectedStyle|headingForStyle|style-chip|generator-heading|phrase-button|message-editor/.test(app + css)) errors.push('Ainda existem resíduos técnicos do antigo Gerador de Mensagens');
if (!gradle.includes("versionName '5.2'") || !gradle.includes('versionCode 520')) errors.push('Versão Android não está configurada como 5.2/520');
if (!workflow.includes('npm test') || !workflow.includes('assembleDebug') || !workflow.includes('CbOfertas-V5.2.apk') || !workflow.includes('CbOfertas-V5.2-PROGRAMA-COMPLETO.zip')) errors.push('Workflow não gera APK e ZIP da V5.2');
if (!app.includes('shopee.com.br') || !manifest.includes('android.intent.action.SEND') || !manifest.includes('text/plain')) errors.push('Android não está registrado para receber links compartilhados do Mercado Livre e Shopee');
if (!shopeeParser.includes('parseShopeePrices') || !shopeeParser.includes('100000')) errors.push('Parser de preço da Shopee incompleto');
if (!parser.includes('parseAriaMoney') || !parser.includes('priceToPay') || !parser.includes('cashback')) errors.push('Parser de preço promocional incompleto');

const idMatches = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const ids = new Set(idMatches);
const duplicateIds = [...ids].filter(id => idMatches.filter(value => value === id).length > 1);
if (duplicateIds.length) errors.push(`IDs HTML duplicados: ${duplicateIds.join(', ')}`);

const referencedIds = [...app.matchAll(/\$\('#([^']+)'\)/g)].map(match => match[1]);
const missingIds = [...new Set(referencedIds.filter(id => !ids.has(id)))];
if (missingIds.length) errors.push(`IDs usados no app.js e ausentes no HTML: ${missingIds.join(', ')}`);

const phraseObject = app.match(/const funnyPhrases = (\{[\s\S]*?\n\});/);
if (!phraseObject) errors.push('Banco de frases não encontrado');
else {
  try {
    const phrases = Function(`return (${phraseObject[1]})`)();
    const total = Object.values(phrases).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
    if (Object.keys(phrases).length < 15 || total < 300) errors.push(`Banco de frases insuficiente: ${Object.keys(phrases).length} categorias e ${total} frases`);
  } catch { errors.push('Banco de frases inválido'); }
}

if (errors.length) {
  console.error('Falha na validação do projeto:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`CbOfertas V5.2 validado: ${requiredFiles.length} arquivos essenciais, ${ids.size} IDs de interface e banco com mais de 300 frases.`);
