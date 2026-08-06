'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const required = [
  'android/app/build.gradle',
  'android/app/src/main/AndroidManifest.xml',
  'android/app/src/main/res/xml/file_paths.xml',
  'android/app/src/main/java/com/cbofertas/app/MainActivity.java',
  'android/app/src/main/java/com/cbofertas/app/WhatsAppAutomationService.java',
  'android/app/src/main/assets/www/index.html',
  'android/app/src/main/assets/www/app.js',
  'android/app/src/main/assets/www/modules/core/event-bus.js',
  'android/app/src/main/assets/www/modules/core/storage.js',
  'android/app/src/main/assets/www/modules/core/safe-runtime.js',
  'android/app/src/main/assets/www/modules/features/affiliate-module.js',
  'android/app/src/main/assets/www/modules/features/navigation-module.js',
  'android/app/src/main/assets/www/modules/features/queue-transfer-module.js',
  'android/app/src/main/assets/www/modules/features/startup-module.js',
  'android/app/src/main/assets/www/modules/features/calibration-module.js',
  'android/app/src/main/assets/www/modules/features/current-offer-actions.js',
  'backend/package.json',
  'backend/src/app.js',
  '.github/workflows/build-apk.yml'
];
const errors = [];
for (const relative of required) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) errors.push(`Ausente ou vazio: ${relative}`);
}
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const gradle = read('android/app/build.gradle');
const html = read('android/app/src/main/assets/www/index.html');
const app = read('android/app/src/main/assets/www/app.js');
const affiliate = read('android/app/src/main/assets/www/modules/features/affiliate-module.js');
const filePaths = read('android/app/src/main/res/xml/file_paths.xml');
const versionName = gradle.match(/versionName\s+'([^']+)'/)?.[1] || '';
const versionCode = Number(gradle.match(/versionCode\s+(\d+)/)?.[1] || 0);
if (versionName !== '8.5.1' || versionCode !== 851) errors.push(`Versão incorreta: ${versionName}/${versionCode}`);
if (!affiliate.includes('saveAffiliateLibrary')) errors.push('Módulo de afiliados sem compatibilidade saveAffiliateLibrary');
if (!html.includes('modules/core/event-bus.js') || !html.includes('queue-transfer-module.js')) errors.push('HTML não carrega módulos V8');
if (app.includes("saveAffiliateLibrary(data.affiliateLibrary);")) errors.push('app.js ainda contém chamada insegura antiga');
if (!filePaths.includes('cache_root') || !filePaths.includes('files_root')) errors.push('FileProvider incompleto');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicates.length) errors.push(`IDs duplicados: ${duplicates.join(', ')}`);
if (errors.length) {
  console.error('Falha na validação V8:');
  errors.forEach(error => console.error('- ' + error));
  process.exit(1);
}
console.log(`CbOfertas ${versionName} validada: ${required.length} arquivos essenciais, ${ids.length} IDs e módulos isolados.`);
