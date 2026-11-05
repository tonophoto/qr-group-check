import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
export async function verifyBrowser({ports,PROJECT,clients,seed,passed}) {
 const require=createRequire(path.join(process.env.QR_TEST_BROWSER_ROOT,'package.json'));
 const {chromium}=require('playwright');
 const allowedAssets=new Set(readdirSync('dist-qr'));
 const sourceCache=new Map();
 for(const file of ['firebase-app.js','firebase-auth.js','firebase-firestore.js','html5-qrcode.min.js']) {
  const location='.local-verify/sdk/'+file;if(!existsSync(location))throw Error('Run prepare-qr-browser-cache.mjs before isolated test');
  sourceCache.set(file,readFileSync(location,'utf8'));
 }
 const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');let file=url.pathname.slice(1)||'index.html';let text;
  if(file.startsWith('sdk/')&&sourceCache.has(file.slice(4))) {
   text=sourceCache.get(file.slice(4));
   if(file.endsWith('html5-qrcode.min.js'))text+='\nconst qrOriginalStart=Html5Qrcode.prototype.start;Html5Qrcode.prototype.start=function(...args){window.__qrScannerStarts=(window.__qrScannerStarts||0)+1;return qrOriginalStart.apply(this,args)};';
  } else if(allowedAssets.has(file)&&!file.includes('/'))text=readFileSync('dist-qr/'+file,'utf8');
  else{res.writeHead(404);res.end();return;}
  text=text.replaceAll('https://www.gstatic.com/firebasejs/10.14.1/','/sdk/').replaceAll('https://unpkg.com/html5-qrcode','/sdk/html5-qrcode.min.js');
  if(file==='auth-gate.js') {
   text=text.replace(/const firebaseConfig = \{[\s\S]*?\n\};/,`const firebaseConfig = ${JSON.stringify({projectId:PROJECT,apiKey:'emulator-only',authDomain:'localhost',appId:'emulator-only'})};`);
   text=text.replace('  getAuth,','  getAuth, connectAuthEmulator,').replace('  getFirestore,','  getFirestore, connectFirestoreEmulator,');
   text=text.replace('const db = getFirestore(app);',`const db = getFirestore(app);\nconnectAuthEmulator(auth,'http://127.0.0.1:${ports.auth}',{disableWarnings:true});\nconnectFirestoreEmulator(db,'127.0.0.1',${ports.firestore});`);
   if(text.includes('school-trip-chat')||!text.includes('connectFirestoreEmulator(db'))throw Error('Test-only Firebase replacement failed closed');
  }
  const type=file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript';
  res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store'});res.end(text);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const executable=path.join(process.env.PLAYWRIGHT_BROWSERS_PATH,'chromium-1228/chrome-win64/chrome.exe');
 const browser=await chromium.launch({executablePath:executable,headless:true,args:['--disable-background-networking','--disable-component-update','--disable-domain-reliability','--disable-sync','--no-first-run','--no-default-browser-check','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 const contexts=[],errors=[],mediaTeardownWarnings=[],blocked=[],interceptedProbes=[],requests=[];
 const allowedPorts=new Set([String(server.address().port),...Object.values(ports).map(String)]);
 async function page(){const context=await browser.newContext({viewport:{width:412,height:915},permissions:['camera'],serviceWorkers:'block'});contexts.push(context);
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin==='https://www.google.com'&&u.pathname==='/images/cleardot.gif'){interceptedProbes.push('SDK connectivity image');return route.fulfill({status:200,contentType:'image/gif',body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==','base64')});}if(['127.0.0.1','localhost','[::1]'].includes(u.hostname)&&allowedPorts.has(u.port))return route.continue();blocked.push({protocol:u.protocol,host:u.hostname,port:u.port,path:u.pathname,kind:route.request().resourceType()});return route.abort();});
  context.on('request',r=>{const u=new URL(r.url());if(u.pathname.endsWith('.js'))requests.push(u.pathname);});
  const p=await context.newPage();p.on('pageerror',e=>{const message=e.message.slice(0,200);if(/^(RenderedCameraImpl video surface onabort\(\) called|The play\(\) request was interrupted)/.test(message))mediaTeardownWarnings.push(message);else errors.push(message);});p.on('dialog',dialog=>dialog.accept());return p;}
 async function login(p,label){await p.evaluate(async label=>{const a=await import('/sdk/firebase-app.js');const auth=await import('/sdk/firebase-auth.js');await auth.signInWithCredential(auth.getAuth(a.getApp()),auth.GoogleAuthProvider.credential(JSON.stringify({sub:label,email:label+'@example.test',email_verified:true})));},label);}
 async function ready(p){await p.waitForFunction(()=>typeof sharedReady!=='undefined'&&sharedReady&&groupSync&&!accessEnded,{},{timeout:20000});}
 async function unlocked(p){await p.waitForFunction(()=>!scanLocked);}
 try{
  const trip='browser-trip';await seed('qrTrips/'+trip,{status:'active'});
  for(const label of ['teacher-a','teacher-b','admin']){const c=clients.find(c=>c.label===label);await seed(`qrTrips/${trip}/members/${c.uid}`,{role:label==='admin'?'admin':'teacher',displayName:label,email:c.email,disabled:false});}
  const a=await page(),b=await page();await a.goto(base+'/?trip='+trip);await b.goto(base+'/?trip='+trip);await login(a,'teacher-a');await login(b,'teacher-b');await ready(a);await ready(b);
  assert.equal(await a.locator('#startBtn').isEnabled(),true);
  await a.locator('#roundTitle').fill('browser round');await a.locator('#startBtn').click();await a.waitForFunction(()=>state.status==='active');await b.waitForFunction(()=>state.status==='active');
  await a.waitForFunction(()=>window.__qrScannerStarts>=1&&scanner?.isScanning===true&&!cameraPaused);
  await a.evaluate(()=>{const original=groupSync.register.bind(groupSync);groupSync.register=(...args)=>new Promise((resolve,reject)=>{window.__qrRelease=()=>{groupSync.register=original;original(...args).then(resolve,reject);};});});
  await a.locator('#manualInput').fill('A-1');await a.locator('#manualAddBtn').click();
  assert.equal(await a.locator('#resultOverlay.show .result-panel.success').count(),0);
  assert.equal(await b.locator('#countValue').innerText(),'0');await a.evaluate(()=>window.__qrRelease());
  await a.waitForFunction(()=>document.querySelector('#resultOverlay.show .result-panel.success'));
  await b.waitForFunction(()=>document.getElementById('countValue').textContent==='1');
  passed('real Chromium + CDN SDK 10.14.1: Google-provider Emulator login, generated camera start, A->B update, no success before register ACK');
  await unlocked(a);await unlocked(b);await Promise.all([a.evaluate(()=>handleCode('A-2')),b.evaluate(()=>handleCode('A-2'))]);
  const outcomes=await Promise.all([a.locator('#resultPanel').getAttribute('class'),b.locator('#resultPanel').getAttribute('class')]);assert.equal(outcomes.filter(x=>x.includes('success')).length,1);assert.equal(outcomes.filter(x=>x.includes('duplicate')).length,1);
  await a.locator('#endBtn').click();await b.waitForFunction(()=>state.status==='ended');
  await a.locator('#newRoundBtn').click();assert.equal(await a.locator('#setupCard').isVisible(),true);assert.equal(await a.locator('#startBtn').isEnabled(),true);
  await b.locator('#resumeBtn').click();await a.waitForFunction(()=>state.status==='active'&&!newRoundSetup);
  await b.locator('#endBtn').click();await a.waitForFunction(()=>state.status==='ended');await a.locator('#newRoundBtn').click();await a.locator('#roundTitle').fill('second round');await a.locator('#startBtn').click();
  await b.waitForFunction(()=>state.status==='active'&&state.roundTitle==='second round'&&state.checks.length===0);
  await a.waitForFunction(()=>window.__qrScannerStarts>=2&&scanner?.isScanning===true&&!cameraPaused);
  passed('real browser simultaneous check new/duplicate, next-round button regression, remote resume, next round clears prior checks and starts scanner');
  await b.context().setOffline(true);await b.waitForFunction(()=>!sharedReady&&state.checks.length===0);assert.equal(await b.locator('#manualAddBtn').isDisabled(),true);await b.context().setOffline(false);await ready(b);
  passed('browser offline hides old checks and disables input; authenticated reconnect reloads cleanly');
  const admin=await page();await admin.goto(base+'/members.html?trip='+trip);await login(admin,'admin');await admin.waitForFunction(()=>document.getElementById('pendingRequests').textContent==='申請はありません。');
  const applicant=await page();await applicant.goto(base+'/?trip='+trip);await login(applicant,'browser-applicant');await applicant.getByRole('button',{name:'この旅行への参加を申請'}).click();
  const row=admin.locator('#pendingRequests .row').filter({hasText:'browser-applicant'});await row.getByRole('button',{name:'承認',exact:true}).click();await ready(applicant);
  const rejected=await page();await rejected.goto(base+'/?trip='+trip);await login(rejected,'browser-rejected');await rejected.getByRole('button',{name:'この旅行への参加を申請'}).click();
  await admin.locator('#pendingRequests .row').filter({hasText:'browser-rejected'}).getByRole('button',{name:'拒否',exact:true}).click();await admin.waitForFunction(()=>document.getElementById('pendingRequests').textContent==='申請はありません。');
  const member=admin.locator('#approvedMembers .row').filter({hasText:'browser-applicant'});await member.getByRole('checkbox',{name:'無効化'}).check();await member.getByRole('button',{name:'保存',exact:true}).click();await applicant.getByText('参加権限が変更されました。登録状態を確認してください。').waitFor();
  assert.equal(await applicant.evaluate(()=>accessEnded&&state.checks.length===0),true);
  passed('real members UI request -> atomic approval -> automatic entry; reject and disable revoke active view');
  await seed('qrTrips/closed-trip',{status:'ended'});const teacher=clients.find(c=>c.label==='teacher-a');await seed('qrTrips/closed-trip/members/'+teacher.uid,{role:'teacher',displayName:teacher.label,email:teacher.email,disabled:false});
  const closed=await page();await closed.goto(base+'/?trip=closed-trip');await login(closed,'teacher-a');await closed.waitForFunction(()=>document.getElementById('sharedSyncStatus').textContent.includes('同期できません'));assert.equal(await closed.locator('#startBtn').isDisabled(),true);
  passed('initial Firestore authorization failure keeps start disabled and checked records empty');
  const teacherMembers=await page();await teacherMembers.goto(base+'/members.html?trip='+trip);await login(teacherMembers,'teacher-a');await teacherMembers.getByText('この画面を利用できる権限がありません。（role: teacher）').waitFor();
  await a.evaluate(async()=>{const app=await import('/sdk/firebase-app.js');const auth=await import('/sdk/firebase-auth.js');await auth.signOut(auth.getAuth(app.getApp()));});await a.getByRole('button',{name:'Googleでログイン'}).waitFor();
  await login(a,'other-trip');await a.getByRole('button',{name:'この旅行への参加を申請'}).waitFor();assert.equal(await a.evaluate(()=>typeof state==='undefined'),true);
  await a.goto(base+'/?trip=other-trip');await ready(a);assert.equal(await a.evaluate(()=>state.checks.length),0);
  passed('teacher members-page denial; logout/account/trip switch disposes old scripts and reveals no prior-trip records');
  writeFileSync('.local-verify/browser-network-check.json',JSON.stringify({blocked,interceptedProbes,errors,mediaTeardownWarnings},null,2)+'\n');
  assert.equal(blocked.length,0,'all application requests must be localhost: '+JSON.stringify(blocked));assert.equal(errors.length,0,JSON.stringify(errors));
  assert.equal(requests.some(p=>/photography\.js|admin-trip\.js|photography-sync\.js/.test(p)),false);
  writeFileSync('.local-verify/browser-result.json',JSON.stringify({time:new Date().toISOString(),browser:browser.version(),sdk:'10.14.1',externalRequestsSent:0,rejectedUnexpectedRequests:blocked,interceptedProbes:interceptedProbes.length,pageErrors:errors,mediaTeardownWarnings,loadedScripts:[...new Set(requests)].sort(),camera:'Chrome-generated video only; manual QR inputs; no hardware acceptance'},null,2)+'\n');
  await b.screenshot({path:'.local-verify/browser-group.png',fullPage:true});
 }finally{await Promise.all(contexts.map(c=>c.close()));await browser.close();await new Promise(resolve=>server.close(resolve));}
}
