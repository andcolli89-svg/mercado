import { access, readFile, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const required = [
  'backend/package.json',
  'backend/src/core/priceModel.js',
  'backend/src/providers/mercadolivre/provider.js',
  'backend/src/providers/mercadolivre/linkResolver.js',
  'android/settings.gradle.kts',
  'android/app/build.gradle.kts',
  'android/app/src/main/AndroidManifest.xml',
  'android/app/src/main/java/com/cbofertas/v6/MainActivity.kt',
  'android/app/src/main/java/com/cbofertas/v6/ui/App.kt',
  'android/app/src/main/java/com/cbofertas/v6/ui/ScheduleScreen.kt',
  'android/app/src/main/java/com/cbofertas/v6/ui/SmartCouponComponents.kt',
  'android/app/src/main/java/com/cbofertas/v6/data/OfferScheduler.kt',
  'android/app/src/main/java/com/cbofertas/v6/data/OfferAlarmReceiver.kt',
  'android/app/src/main/java/com/cbofertas/v6/ShareOfferActivity.kt',
  'backend/src/services/couponService.js',
  'android/app/src/main/assets/funny_phrases.json',
  '.github/workflows/build-v6.yml',
  'render.yaml',
];

for (const file of required) await access(path.join(root, file), constants.R_OK);

const workspacePackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const backendPackage = JSON.parse(await readFile(path.join(root, 'backend/package.json'), 'utf8'));
if (workspacePackage.version !== backendPackage.version) throw new Error('Versões do workspace e backend não coincidem.');

const buildGradle = await readFile(path.join(root, 'android/app/build.gradle.kts'), 'utf8');
if (!buildGradle.includes(`versionName = "${workspacePackage.version}"`)) throw new Error('versionName Android não coincide com o workspace.');

if (!buildGradle.includes('compileSdk = 35') || !buildGradle.includes('targetSdk = 35')) {
  throw new Error('Alpha 4 deve usar Android API 35 estável.');
}
const rootGradle = await readFile(path.join(root, 'android/build.gradle.kts'), 'utf8');
if (!rootGradle.includes('com.android.application") version "8.7.3') || !rootGradle.includes('org.jetbrains.kotlin.android") version "2.0.21')) {
  throw new Error('Toolchain Android estável da Alpha 4 foi alterada.');
}
const workflow = await readFile(path.join(root, '.github/workflows/build-v6.yml'), 'utf8');
if (!workflow.includes('platforms;android-35') || !workflow.includes("gradle-version: '8.9'")) {
  throw new Error('Workflow Android não está alinhado com API 35 e Gradle 8.9.');
}

const phrases = JSON.parse(await readFile(path.join(root, 'android/app/src/main/assets/funny_phrases.json'), 'utf8'));
const phraseCount = Object.values(phrases).reduce((total, group) => total + group.length, 0);
if (phraseCount < 300) throw new Error(`Banco de frases incompleto: ${phraseCount}`);

const kotlinFiles = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.name.endsWith('.kt')) kotlinFiles.push(full);
  }
}
await walk(path.join(root, 'android/app/src'));
if (kotlinFiles.length < 6) throw new Error('Estrutura Kotlin incompleta.');

const kotlinText = (await Promise.all(kotlinFiles.map((file) => readFile(file, 'utf8')))).join('\n');
if (/\bWebView\b|addJavascriptInterface|loadUrl\s*\(/.test(kotlinText)) {
  throw new Error('A reconstrução V6 não pode depender de WebView.');
}


const apiClient = await readFile(path.join(root, 'android/app/src/main/java/com/cbofertas/v6/data/ApiClient.kt'), 'utf8');
for (const route of ['/v1/products/resolve', '/api/product', '/v1/radar', '/api/radar']) {
  if (!apiClient.includes(route)) throw new Error(`Compatibilidade Android ausente para ${route}.`);
}
const appUi = await readFile(path.join(root, 'android/app/src/main/java/com/cbofertas/v6/ui/App.kt'), 'utf8');
for (const feature of ['Compartilhar no WhatsApp Business', 'Agendar publicação', 'Copiar texto completo', 'Trocar frase', 'Biblioteca de Afiliados']) {
  if (!appUi.includes(feature)) throw new Error(`Recurso visual ausente: ${feature}.`);
}

const manifest = await readFile(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
for (const feature of ['POST_NOTIFICATIONS', 'RECEIVE_BOOT_COMPLETED', 'OfferAlarmReceiver', 'ShareOfferActivity', 'com.whatsapp.w4b']) {
  if (!manifest.includes(feature)) throw new Error(`Integração Android ausente: ${feature}.`);
}
const couponUi = await readFile(path.join(root, 'android/app/src/main/java/com/cbofertas/v6/ui/SmartCouponComponents.kt'), 'utf8');
for (const feature of ['Compra mínima', 'Cupom confirmado', 'Palavras-chave']) {
  if (!couponUi.includes(feature)) throw new Error(`Cupom inteligente incompleto: ${feature}.`);
}
const scheduleUi = await readFile(path.join(root, 'android/app/src/main/java/com/cbofertas/v6/ui/ScheduleScreen.kt'), 'utf8');
for (const feature of ['Agenda de ofertas', 'Diário', 'Semanal', 'WhatsApp Business']) {
  if (!scheduleUi.includes(feature)) throw new Error(`Agenda incompleta: ${feature}.`);
}

const formatting = await readFile(path.join(root, 'android/app/src/main/java/com/cbofertas/v6/domain/Formatting.kt'), 'utf8');
if (!formatting.includes('fun Product.offerText')) throw new Error('Gerador automático de texto ausente.');

const priceModel = await readFile(path.join(root, 'backend/src/core/priceModel.js'), 'utf8');
for (const protectedKind of ['cashback', 'installment', 'unit']) {
  if (!priceModel.includes(`candidate.kind === '${protectedKind}'`)) {
    throw new Error(`Proteção ausente para ${protectedKind}.`);
  }
}

console.log(`Projeto V6 validado: ${required.length} arquivos essenciais, ${kotlinFiles.length} arquivos Kotlin e ${phraseCount} frases.`);
