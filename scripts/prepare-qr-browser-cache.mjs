// Preparation only: official public SDK/scanner files, no Firebase project/API calls.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
mkdirSync('.local-verify/sdk',{recursive:true});
const sources = [
 ['firebase-app.js','https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'],
 ['firebase-auth.js','https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'],
 ['firebase-firestore.js','https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'],
 ['html5-qrcode.min.js','https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js']
];
const manifest=[];
for(const [file,url] of sources){const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Public test tool download failed: '+r.status);const bytes=Buffer.from(await r.arrayBuffer());writeFileSync('.local-verify/sdk/'+file,bytes);manifest.push({file,url,sha256:createHash('sha256').update(bytes).digest('hex')});}
writeFileSync('.local-verify/sdk-manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log('Cached only public Firebase 10.14.1 SDK and html5-qrcode 2.3.8 for offline browser serving');
