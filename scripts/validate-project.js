'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const required=['backend/server.js','backend/src/app.js','backend/src/config.js','backend/src/lib/http.js','backend/src/lib/format.js','backend/src/services/productService.js','backend/src/services/imageService.js','backend/test/smoke.test.js','scripts/smoke-webapp.js','android/app/build.gradle','android/app/src/main/AndroidManifest.xml','android/app/src/main/java/com/cbofertas/app/MainActivity.java','android/app/src/main/java/com/cbofertas/app/CbDatabaseHelper.java','android/app/src/main/java/com/cbofertas/app/WhatsAppAutomationService.java','android/app/src/main/res/xml/accessibility_service_config.xml','android/app/src/main/assets/www/index.html','android/app/src/main/assets/www/app.js','android/app/src/main/assets/www/style.css','.github/workflows/build-apk.yml'];
const errors=[];for(const p of required){const f=path.join(root,p);if(!fs.existsSync(f)||fs.statSync(f).size===0)errors.push(`Arquivo ausente ou vazio: ${p}`)}
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('android/app/src/main/assets/www/index.html'),app=read('android/app/src/main/assets/www/app.js'),gradle=read('android/app/build.gradle'),workflow=read('.github/workflows/build-apk.yml'),manifest=read('android/app/src/main/AndroidManifest.xml'),main=read('android/app/src/main/java/com/cbofertas/app/MainActivity.java');
for(const id of ['offersPage','historyPage','couponsPage','batchPage','automationPage','settingsPage','batchInput','batchSendPilotBtn','exportQueueBtn','importQueueInput'])if(!html.includes(`id="${id}"`))errors.push(`Interface sem #${id}`);
for(const marker of ['CbOfertasReceiveSharedLink','buildV6Queue','exportV6Queue','importV6Queue','scheduleAutomaticMessage','openAutomationSettings','v63ParseBatch','sendV63BatchToPilot','CbV7Database'])if(!app.includes(marker))errors.push(`app.js sem ${marker}`);
const vn=gradle.match(/versionName\s+'([^']+)'/)?.[1]||'',vc=Number(gradle.match(/versionCode\s+(\d+)/)?.[1]||0);
if(!/^7\./.test(vn)||vc<700)errors.push(`Versão V7 inválida: ${vn}/${vc}`);
if(!workflow.includes('npm test')||!workflow.includes('assembleDebug')||!workflow.includes('CbOfertas-V7.1'))errors.push('Workflow V7 inválido');
if(!manifest.includes('android.intent.action.SEND')||!manifest.includes('WhatsAppAutomationService'))errors.push('Manifest incompleto');
for(const method of ['dbUpsertOffer','dbListOffers','dbRecordUsage','dbSaveExport','resolveProductImage'])if(!main.includes(method))errors.push(`MainActivity sem ${method}`);
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]),set=new Set(ids),dups=[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))];if(dups.length)errors.push(`IDs duplicados: ${dups.join(', ')}`);
const refs=[...app.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1]);const missing=[...new Set(refs.filter(x=>!set.has(x)))];if(missing.length)errors.push(`IDs ausentes: ${missing.join(', ')}`);
if(errors.length){console.error('Falha na validação:');errors.forEach(e=>console.error('- '+e));process.exit(1)}
console.log(`CbOfertas ${vn} validado: ${required.length} arquivos, ${set.size} IDs e SQLite nativo.`);
