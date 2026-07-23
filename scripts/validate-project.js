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
  'backend/src/services/productService.js',
  'backend/src/services/radarService.js',
  'backend/src/services/imageService.js',
  'backend/test/smoke.test.js',
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
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size === 0) {
    errors.push(`Arquivo ausente ou vazio: ${relativePath}`);
  }
}

const html = fs.readFileSync(path.join(root, 'android/app/src/main/assets/www/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'android/app/src/main/assets/www/app.js'), 'utf8');
const gradle = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/build-apk.yml'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');

for (const id of ['radarPage', 'historyPage', 'favoritesPage', 'couponsPage', 'favoritesList', 'affiliateLinkBtn', 'affiliateStatus']) {
  if (!html.includes(`id="${id}"`)) errors.push(`Interface sem o elemento #${id}`);
}
for (const marker of ['FAVORITES_STORAGE_KEY', 'getAutomaticCouponCodes', 'renderRadarOffers', 'renderPublications', 'renderFavorites', 'CbOfertasReceiveSharedLink', 'openAffiliateGenerator']) {
  if (!app.includes(marker)) errors.push(`app.js sem o recurso ${marker}`);
}
if (!gradle.includes("versionName '5.0'") || !gradle.includes('versionCode 500')) {
  errors.push('Versão Android não está configurada como 5.0/500');
}
if (!workflow.includes('npm test') || !workflow.includes('assembleDebug') || !workflow.includes('CbOfertas-V5.0.apk')) {
  errors.push('Workflow não valida backend e APK da V5.0');
}
if (!manifest.includes('android.intent.action.SEND') || !manifest.includes('text/plain')) {
  errors.push('Android não está registrado para receber o link compartilhado pelo Mercado Livre');
}

const idMatches = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const ids = new Set(idMatches);
const duplicateIds = [...ids].filter(id => idMatches.filter(value => value === id).length > 1);
if (duplicateIds.length) errors.push(`IDs HTML duplicados: ${duplicateIds.join(', ')}`);

const referencedIds = [...app.matchAll(/\$\('#([^']+)'\)/g)].map(match => match[1]);
const missingIds = [...new Set(referencedIds.filter(id => !ids.has(id)))];
if (missingIds.length) errors.push(`IDs usados no app.js e ausentes no HTML: ${missingIds.join(', ')}`);

if (errors.length) {
  console.error('Falha na validação do projeto:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`CbOfertas V5.0 validado: ${requiredFiles.length} arquivos essenciais e ${ids.size} IDs de interface.`);
