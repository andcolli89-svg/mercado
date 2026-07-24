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

const priceModel = await readFile(path.join(root, 'backend/src/core/priceModel.js'), 'utf8');
for (const protectedKind of ['cashback', 'installment', 'unit']) {
  if (!priceModel.includes(`candidate.kind === '${protectedKind}'`)) {
    throw new Error(`Proteção ausente para ${protectedKind}.`);
  }
}

console.log(`Projeto V6 validado: ${required.length} arquivos essenciais, ${kotlinFiles.length} arquivos Kotlin e ${phraseCount} frases.`);
