import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const PROJECT='demo-qr-pr11';
const ports=JSON.parse(process.env.QR_TEST_PORTS||'{}');
assert.equal(process.env.QR_TEST_PROJECT,PROJECT); assert.equal(process.env.ANTIDISC_NETWORK_GUARD_ACTIVE,'1');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:'+ports.firestore);
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:'+ports.auth);
const require=createRequire(path.join(process.env.QR_TEST_FIREBASE_ROOT,'package.json'));
const appSDK=require('firebase/app'), authSDK=require('firebase/auth'), fsSDK=require('firebase/firestore'), storageSDK=require('firebase/storage');
fsSDK.setLogLevel('silent');
const clients=[], sessions=[], evidence=[];
function passed(name){evidence.push(name);console.log('PASS '+name);}
const waitFor=async (fn,label) => {const until=Date.now()+18000;while(Date.now()<until){if(fn())return;await new Promise(r=>setTimeout(r,40));}throw Error('Timed out: '+label);};
function value(v){if(v===null)return{nullValue:null};if(typeof v==='boolean')return{booleanValue:v};if(typeof v==='number')return{integerValue:String(v)};return{stringValue:String(v)};}
async function seed(p,data){const r=await fetch(`http://127.0.0.1:${ports.firestore}/v1/projects/${PROJECT}/databases/(default)/documents/${p}`,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,value(v)]))})});assert.equal(r.status,200,'local seed '+p);}
async function client(label,{signedOut=false,password=false}={}){
 const app=appSDK.initializeApp({projectId:PROJECT,apiKey:'emulator-only',storageBucket:PROJECT+'.appspot.com'},label);
 const auth=authSDK.getAuth(app);authSDK.connectAuthEmulator(auth,`http://127.0.0.1:${ports.auth}`,{disableWarnings:true});
 const db=fsSDK.getFirestore(app);fsSDK.connectFirestoreEmulator(db,'127.0.0.1',ports.firestore);
 const storage=storageSDK.getStorage(app);storageSDK.connectStorageEmulator(storage,'127.0.0.1',ports.storage);
 let user=null;if(!signedOut){user=password?(await authSDK.createUserWithEmailAndPassword(auth,label+'@example.test','synthetic-only-123456')).user:(await authSDK.signInWithCredential(auth,authSDK.GoogleAuthProvider.credential(JSON.stringify({sub:label,email:label+'@example.test',email_verified:true})))).user;}
 const c={app,auth,db,storage,uid:user?.uid||'',email:label+'@example.test',label};clients.push(c);return c;
}
async function connect(c,tripId='fixture-trip'){
 const updates=[],errors=[];const events=new EventTarget();const window={addEventListener:(...a)=>events.addEventListener(...a),removeEventListener:(...a)=>events.removeEventListener(...a)};
 const ctx={navigator:{onLine:true}};
 let gate=null,entered=null;const localSDK={...fsSDK,runTransaction:async(...args)=>{if(gate){const current=gate;gate=null;entered?.();await current;}return fsSDK.runTransaction(...args);}};
 const source=readFileSync('group-sync.js','utf8').replace('import(APP)','Promise.resolve(__app)').replace('import(SDK)','Promise.resolve(__fs)');new Function('window','navigator','__app','__fs',source)(window,ctx.navigator,{getApp:()=>c.app},localSDK);
 const api=await window.QRGroupSync.connect({tripId,uid:c.uid,role:c.label==='admin'?'admin':'teacher'},u=>updates.push(u),e=>errors.push(e));
 const s={api,updates,errors,ctx,events,pauseNextTransaction(){let release,notify;gate=new Promise(r=>release=r);const reached=new Promise(r=>notify=r);entered=notify;return{release,reached};},get last(){return updates.at(-1);}};sessions.push(s);return s;
}
async function denied(operation,label){await assert.rejects(operation,e=>e.code==='permission-denied',label);}
const doc=(c,p)=>fsSDK.doc(c.db,p);
const trip='qrTrips/fixture-trip';
try{
 const [a,b,admin,applicant,rejected,disabled,photo,other,serviceAdmin,outsider,password,signedOut]=await Promise.all([
 client('teacher-a'),client('teacher-b'),client('admin'),client('applicant'),client('rejected'),client('disabled'),client('photographer'),client('other-trip'),client('service-admin'),client('outsider'),client('password',{password:true}),client('signed-out',{signedOut:true})]);
 await seed(trip,{status:'active'});await seed('qrTrips/other-trip',{status:'active'});
 for(const [c,role,isDisabled=false] of [[a,'teacher'],[b,'teacher'],[admin,'admin'],[disabled,'teacher',true],[photo,'photographer']])await seed(`${trip}/members/${c.uid}`,{role,displayName:c.label,email:c.email,disabled:isDisabled});
 await seed('qrTrips/other-trip/members/'+other.uid,{role:'teacher',displayName:other.label,email:other.email,disabled:false});
 await seed('qrServiceAdmins/'+serviceAdmin.uid,{disabled:false});
 await seed(`${trip}/members/${password.uid}`,{role:'teacher',displayName:password.label,email:password.email,disabled:false});
 for(const c of [outsider,disabled,photo,other,serviceAdmin,password,signedOut])await denied(()=>fsSDK.getDocFromServer(doc(c,trip+'/groupControl/current')),'unauthorized control '+c.label);
 for(const c of [a,b,admin])assert.equal((await fsSDK.getDocFromServer(doc(c,trip+'/members/'+c.uid))).exists(),true);
 await denied(()=>fsSDK.getDocFromServer(doc(a,trip+'/members/'+b.uid)),'member privacy');
 await denied(()=>fsSDK.getDocs(fsSDK.collection(a.db,trip+'/members')),'teacher list');
 assert.equal((await fsSDK.getDocFromServer(doc(serviceAdmin,'qrServiceAdmins/'+serviceAdmin.uid))).exists(),true);
 passed('Google teacher/admin access; unregistered/disabled/photographer/other-trip/service-admin/password/signed-out isolation');
 const sa=await connect(a),sb=await connect(b);await waitFor(()=>sa.last?.confirmed&&sb.last?.confirmed,'empty control');
 const setup={title:'集合確認',note:'fixture',classMode:'alpha',classGroups:[3]};
 const r1=await sa.api.start(setup);await waitFor(()=>sa.last?.roundId===r1&&sb.last?.roundId===r1&&sb.last.confirmed,'round A/B');
 assert.equal(await sa.api.register(r1,'A-1'),'new');await waitFor(()=>sb.last?.checks.some(x=>x.code==='A-1'),'A -> B check');
 const collision=await Promise.all([sa.api.register(r1,'A-2'),sb.api.register(r1,'A-2')]);assert.deepEqual(collision.sort(),['duplicate','new']);
 const checked=await fsSDK.getDocs(fsSDK.collection(a.db,`${trip}/groupRounds/${r1}/checks`));assert.equal(checked.size,2);
 passed('two independent SDK clients synchronize; simultaneous same-code transaction yields one new / one duplicate / one record');
 const checkPath=`${trip}/groupRounds/${r1}/checks/A-3`;
 const payload={code:'A-3',status:'checked',checkedBy:a.uid,checkedAt:fsSDK.serverTimestamp()};
 for(const c of [outsider,disabled,photo,other,serviceAdmin,password,signedOut])await denied(()=>fsSDK.setDoc(doc(c,checkPath),{...payload,checkedBy:c.uid}),'unauthorized check '+c.label);
 await denied(()=>fsSDK.setDoc(doc(a,checkPath),{...payload,checkedBy:b.uid}),'forged actor');
 await denied(()=>fsSDK.setDoc(doc(a,checkPath),{...payload,checkedAt:new Date(0)}),'forged timestamp');
 await denied(()=>fsSDK.setDoc(doc(a,checkPath),{...payload,code:'A-2'}),'mismatched document ID');
 await denied(()=>fsSDK.setDoc(doc(a,`${trip}/groupRounds/${r1}/checks/A-8`),{...payload,code:'A-8'}),'outside allowlist');
 await denied(()=>fsSDK.updateDoc(doc(a,`${trip}/groupRounds/${r1}/checks/A-1`),{checkedBy:b.uid}),'check update');
 await denied(()=>fsSDK.deleteDoc(doc(a,`${trip}/groupRounds/${r1}/checks/A-1`)),'check delete');
 await denied(()=>fsSDK.updateDoc(doc(a,`${trip}/groupRounds/${r1}`),{groupCodes:['Z-9']}),'round mutation');
 const endAndCheck=fsSDK.writeBatch(a.db);endAndCheck.update(doc(a,`${trip}/groupRounds/${r1}`),{status:'ended',endedAt:fsSDK.serverTimestamp()});endAndCheck.set(doc(a,checkPath),payload);await denied(()=>endAndCheck.commit(),'atomic end-and-check bypass');
 assert.equal((await fsSDK.getDocFromServer(doc(a,`${trip}/groupRounds/${r1}`))).data().status,'active');
 await denied(()=>fsSDK.setDoc(doc(a,`${trip}/groupControl/current`),{roundId:'forged',updatedBy:a.uid,updatedAt:fsSDK.serverTimestamp()}),'forged pointer');
 passed('Rules enforce actor/time/code/allowlist/current-round/create-only and deny forged control/config');
 for(const c of [applicant,rejected])await fsSDK.setDoc(doc(c,`${trip}/joinRequests/${c.uid}`),{uid:c.uid,displayName:c.label,email:c.email,createdAt:fsSDK.serverTimestamp()});
 await denied(()=>fsSDK.setDoc(doc(outsider,`${trip}/joinRequests/${outsider.uid}`),{uid:outsider.uid,displayName:'fake',email:a.email,createdAt:fsSDK.serverTimestamp()}),'forged request email');
 await denied(()=>fsSDK.setDoc(doc(applicant,`${trip}/members/${applicant.uid}`),{role:'admin',displayName:applicant.label,email:applicant.email,disabled:false}),'self promotion');
 const memberData={role:'teacher',displayName:applicant.label,email:applicant.email,disabled:false};
 await denied(()=>fsSDK.setDoc(doc(admin,`${trip}/members/${applicant.uid}`),memberData),'approval without atomic request delete');
 const batch=fsSDK.writeBatch(admin.db);batch.set(doc(admin,`${trip}/members/${applicant.uid}`),memberData);batch.delete(doc(admin,`${trip}/joinRequests/${applicant.uid}`));await batch.commit();
 assert.equal((await fsSDK.getDocFromServer(doc(applicant,`${trip}/members/${applicant.uid}`))).data().role,'teacher');
 assert.equal((await fsSDK.getDocFromServer(doc(admin,`${trip}/joinRequests/${applicant.uid}`))).exists(),false);
 await fsSDK.deleteDoc(doc(admin,`${trip}/joinRequests/${rejected.uid}`));await denied(()=>fsSDK.getDocFromServer(doc(rejected,trip+'/groupControl/current')),'rejected remains blocked');
 await fsSDK.updateDoc(doc(admin,`${trip}/members/${applicant.uid}`),{disabled:true});await denied(()=>fsSDK.getDocFromServer(doc(applicant,trip+'/groupControl/current')),'disabled approved user');
 await denied(()=>fsSDK.updateDoc(doc(admin,`${trip}/members/${admin.uid}`),{disabled:true}),'self admin change');
 passed('request -> atomic approval -> entry; rejection/disable/self-promotion and cross-member privacy');
 for(const p of [`${trip}/photoChecks/x`,`${trip}/photoSession/current`,'schools/fixture/trips/fixture/threads/x','schools/fixture/trips/fixture/calls/x','adminUsers/x']){
  await denied(()=>fsSDK.getDocFromServer(doc(admin,p)),'closed path read '+p);await denied(()=>fsSDK.setDoc(doc(admin,p),{fixture:true}),'closed path write '+p);
 }
 await assert.rejects(storageSDK.uploadBytes(storageSDK.ref(admin.storage,'fixture.jpg'),new Uint8Array([1]),{contentType:'image/jpeg'}),e=>e.code==='storage/unauthorized');
 passed('photography, schools/**, chat/VoIP/admin paths and Storage remain denied');
 await fsSDK.disableNetwork(a.db);await waitFor(()=>sa.last?.confirmed===false,'cache metadata offline');
 assert.equal(sa.last.checks.length,0);await assert.rejects(sa.api.register(r1,'A-3'));
 await fsSDK.enableNetwork(a.db);await waitFor(()=>sa.last?.confirmed===true&&sa.last.checks.length===2,'metadata recovery, same round');
 passed('actual SDK fromCache/offline failure and same-round reconnect recover without stale success');
 const race=await connect(a);await waitFor(()=>race.last?.confirmed,'race session');const hold=race.pauseNextTransaction();const inFlight=race.api.register(r1,'A-3');const expectedRejection=assert.rejects(inFlight,/round-not-active/);await hold.reached;
 await sa.api.setStatus(r1,'ended');hold.release();await expectedRejection;race.api.dispose();passed('scan paused after server pointer read is rejected when another client ends round before transaction');
 await waitFor(()=>sb.last?.round?.status==='ended','end on B');
 await assert.rejects(sb.api.register(r1,'A-3'),/round-not-active/);await denied(()=>fsSDK.setDoc(doc(b,checkPath),{...payload,checkedBy:b.uid}),'server-ended write');
 await sb.api.setStatus(r1,'active');await waitFor(()=>sa.last?.round?.status==='active','resume A');assert.equal(await sa.api.register(r1,'A-3'),'new');
 await sa.api.setStatus(r1,'ended');const r2=await sb.api.start({title:'next',note:'',classMode:'numeric',classGroups:[1,1]});
 await waitFor(()=>sa.last?.roundId===r2&&sa.last.confirmed,'next round A');assert.equal(sa.last.checks.length,0);await assert.rejects(sa.api.register(r1,'A-1'),/round-not-current/);await assert.rejects(sa.api.register(r2,'A-1'),/group-not-configured/);
 assert.equal(await sa.api.register(r2,'1-1'),'new');await sb.api.setStatus(r2,'ended');
 const maxRound=await sa.api.start({title:'max',note:'',classMode:'alpha',classGroups:Array(14).fill(8)});assert.equal(await sa.api.register(maxRound,'N-8'),'new');
 passed('end/resume/next-round isolation and max 14x8 groupCodes within Rules limits');
 sa.api.dispose();const count=sa.updates.length;await sb.api.register(maxRound,'N-7');await new Promise(r=>setTimeout(r,200));assert.equal(sa.updates.length,count);await assert.rejects(sa.api.register(maxRound,'N-6'),/qr-session-ended/);
 passed('disposed identity/trip session cannot write or receive old records');
 if(process.env.QR_TEST_BROWSER==='1'){
  const {verifyBrowser}=await import('./verify-qr-browser.mjs');await verifyBrowser({ports,PROJECT,clients,seed,waitFor,passed});
 }
 writeFileSync('.local-verify/results.json',JSON.stringify({time:new Date().toISOString(),node:process.version,sdk:require('firebase/app').SDK_VERSION,passed:evidence,browser:process.env.QR_TEST_BROWSER==='1'},null,2)+'\n');
}finally{sessions.forEach(s=>s.api.dispose());await Promise.all(clients.map(c=>appSDK.deleteApp(c.app).catch(()=>{})));}
