import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createApp } from '../server/app.js';
import { createGoogleAuth, googleIdentity } from '../server/google.js';
import { createHash } from 'node:crypto';
import { hashToken } from '../server/security.js';
const origin = 'https://congolingo.com';
async function invoke(app, url, cookie = '', method = 'GET', data) {
  const req = Readable.from(data ? [Buffer.from(JSON.stringify(data))] : []);
  Object.assign(req,{url,method,headers:{host:'congolingo.com',cookie,origin,'content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'}});
  const result={headers:{}};
  await app(req,{setHeader(k,v){result.headers[k.toLowerCase()]=v},writeHead(s,h){result.status=s;for(const [k,v] of Object.entries(h||{}))this.setHeader(k,v)},end(b){result.body=b&&JSON.parse(b)}});
  return result;
}
function fixture() {
  const attempts=new Map(), sessions=new Map(); let args;
  const store={
    loginAllowed:async()=>true,
    saveGoogleAttempt:async a=>attempts.set(a.stateHash,a),
    consumeGoogleAttempt:async(s,b)=>{const a=attempts.get(s);if(!a||a.bindingHash!==b)return;attempts.delete(s);return{...a,session_hash:a.sessionHash,app_challenge:a.appChallenge,app_state:a.appState}},
    googleLearner:async(identity,id)=>{args={identity,id};return{id:'learner',name:'Nadia',email:identity.email,google_sub:identity.sub}},
    createLearnerSession:async(hash,id,google)=>sessions.set(hash,{id,google}),
    learnerSession:async hash=>sessions.get(hash),
    session:async()=>null,
  };
  let authorization, exchanges=0;
  const google={origin,authorizationUrl:a=>{authorization=a;return'https://accounts.google.com/authorize?state='+a.state},exchange:async()=>{exchanges++;return{sub:'google-id',email:'nadia@example.com',name:'Nadia'}}};
  const app=createApp(store,{origin,production:true,google});
  return{app,store,google,attempts,sessions,get authorization(){return authorization},get exchanges(){return exchanges},get args(){return args}};
}
test('Google configuration stays disabled without credentials and restricts callback URL',()=>{
  assert.equal(createGoogleAuth({}),null);
  assert.throws(()=>createGoogleAuth({clientId:'test'}));
  assert.throws(()=>createGoogleAuth({clientId:'test',clientSecret:'secret',redirectUri:'https://attacker.example/other'}));
  const g=createGoogleAuth({clientId:'test',clientSecret:'secret',redirectUri:origin+'/api/learn/google/callback'});
  const u=new URL(g.authorizationUrl({state:'state',nonce:'nonce',challenge:'pkce'}));
  assert.equal(u.origin,'https://accounts.google.com');assert.equal(u.searchParams.get('scope'),'openid email profile');
  assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.equal(u.searchParams.get('nonce'),'nonce');
});
test('verified Google claims additionally require nonce, subject and verified email',()=>{
  const p={nonce:'nonce',sub:'123',email:'Nadia@Example.com',email_verified:true,given_name:'<Nadia>'};
  assert.deepEqual(googleIdentity(p,'nonce'),{sub:'123',email:'nadia@example.com',name:'Nadia'});
  for(const changes of [{nonce:'wrong'},{email_verified:false},{sub:''},{email:'invalid'}])assert.throws(()=>googleIdentity({...p,...changes},'nonce'));
});
test('Google state is cookie-bound and one-use; learner cookies never grant Studio access',async()=>{
  const f=fixture();const start=await invoke(f.app,'/api/learn/google/start');
  assert.equal(start.status,302);assert.match(start.headers['set-cookie'],/HttpOnly; SameSite=Lax; Max-Age=600; Secure/);
  const cookie=start.headers['set-cookie'].split(';')[0],callback='/api/learn/google/callback?code=code&state='+f.authorization.state;
  assert.match((await invoke(f.app,callback)).headers.location,/google_failed/);assert.equal(f.exchanges,0);
  const result=await invoke(f.app,callback,cookie);
  assert.equal(result.headers.location,origin+'/learn/auth-complete');assert.equal(f.exchanges,1);assert.equal(f.args.id,null);
  assert.equal(result.headers['set-cookie'].length,2);assert.match(result.headers['set-cookie'][1],/^__Host-loba_learner=/);
  assert.match((await invoke(f.app,callback,cookie)).headers.location,/google_failed/);assert.equal(f.exchanges,1);
  assert.equal((await invoke(f.app,'/api/admin/lessons',result.headers['set-cookie'][1])).status,401);
});
test('Google denial and provider failures return safe errors, without sessions',async()=>{
  for(const denied of [true,false]) {
    const f=fixture();const start=await invoke(f.app,'/api/learn/google/start');f.google.exchange=async()=>{throw new Error('secret-token-must-not-leak')};
    const result=await invoke(f.app,'/api/learn/google/callback?state='+f.authorization.state+(denied?'&error=access_denied':'&code=test'),start.headers['set-cookie'].split(';')[0]);
    assert.match(result.headers.location,denied?/google_cancelled/:/google_failed/);assert.equal(f.sessions.size,0);assert.equal(f.attempts.size,0);
  }
});
test('linking requires the original authenticated learner session at start and callback',async()=>{
  const f=fixture();assert.equal((await invoke(f.app,'/api/learn/google/start?link=1')).status,401);
  f.sessions.set(hashToken('existing'),{id:'existing-id'});
  const start=await invoke(f.app,'/api/learn/google/start?link=1','__Host-loba_learner=existing');
  const callback='/api/learn/google/callback?code=code&state='+f.authorization.state;
  assert.match((await invoke(f.app,callback,start.headers['set-cookie'].split(';')[0])).headers.location,/google_failed/);assert.equal(f.exchanges,0);
  const next=await invoke(f.app,'/api/learn/google/start?link=1','__Host-loba_learner=existing');
  await invoke(f.app,'/api/learn/google/callback?code=code&state='+f.authorization.state,next.headers['set-cookie'].split(';')[0]+'; __Host-loba_learner=existing');
  assert.equal(f.args.id,'existing-id');
});

test('Google-only deletion requires explicit confirmation and a recent Google session',async()=>{
  const f=fixture();let deleted=false;
  f.store.learnerById=async()=>({google_sub:'google-id',password_hash:null});f.store.deleteLearner=async()=>{deleted=true};
  f.sessions.set(hashToken('recent'),{id:'learner',google_auth_at:new Date()});
  const url='/api/learn/account',cookie='__Host-loba_learner=recent';
  assert.equal((await invoke(f.app,url,cookie,'DELETE',{})).status,401);
  f.sessions.get(hashToken('recent')).google_auth_at=new Date(Date.now()-11*60*1000);
  assert.equal((await invoke(f.app,url,cookie,'DELETE',{confirm:true})).status,401);assert.equal(deleted,false);
  f.sessions.get(hashToken('recent')).google_auth_at=new Date();
  assert.equal((await invoke(f.app,url,cookie,'DELETE',{confirm:true})).status,200);assert.equal(deleted,true);
});

function nativeFixture() {
  const f=fixture(), handoffs=new Map();
  Object.assign(f.store,{
    saveAppHandoff:async(hash,id,challenge)=>handoffs.set(hash,{learner_id:id,challenge,expires:Date.now()+120000}),
    consumeAppHandoff:async(hash,challenge)=>{const h=handoffs.get(hash);if(!h||h.challenge!==challenge||h.expires<=Date.now())return;handoffs.delete(hash);return h},
    learnerById:async id=>({id,name:'Nadia',email:'nadia@example.com',google_sub:'google-id',password_hash:null}),
    progress:async()=>({state:{xp:30}}),
  });
  // Preserve getters on the fixture.
  f.handoffs=handoffs;return f;
}
const proof='v'.repeat(43), appState='s'.repeat(43);
const nativeStart='/api/learn/google/start?app=1&challenge='+createHash('sha256').update(proof).digest('base64url')+'&app_state='+appState;
async function issueHandoff(f, suffix='&code=test') {
  const start=await invoke(f.app,nativeStart);
  return invoke(f.app,'/api/learn/google/callback?state='+f.authorization.state+suffix,start.headers['set-cookie'].split(';')[0]);
}
test('native handoff is proof-bound, single-use and returns progress only to the app',async()=>{
  const f=nativeFixture();assert.equal((await invoke(f.app,'/api/learn/auth-options')).body.app,true);
  const done=await issueHandoff(f), url=new URL(done.headers.location);
  assert.equal(url.protocol,'loba:');assert.equal(url.hostname,'auth');assert.equal(url.searchParams.get('state'),appState);
  assert.equal(f.sessions.size,0);assert.ok(!done.headers['set-cookie'].includes('loba_learner'));
  const code=url.searchParams.get('code');assert.match(code,/^[A-Za-z0-9_-]{43}$/);
  const redeem=(verifier)=>invoke(f.app,'/api/learn/google/redeem','','POST',{code,verifier});
  assert.equal((await redeem('w'.repeat(43))).status,401);assert.equal(f.handoffs.size,1);
  const ok=await redeem(proof);assert.equal(ok.status,200);assert.equal(ok.body.learner.googleLinked,true);assert.equal(ok.body.progress.state.xp,30);
  assert.match(ok.headers['set-cookie'][1],/^__Host-loba_learner=/);assert.equal(f.sessions.size,1);
  assert.equal((await redeem(proof)).status,401);
});
test('native requests reject malformed proofs, missing state and account linking',async()=>{
  const f=nativeFixture();
  for(const path of [nativeStart+'&link=1',nativeStart.replace(appState,'short'),nativeStart.replace('&app_state='+appState,''),nativeStart.replace('challenge=','challenge=x')]) assert.equal((await invoke(f.app,path)).status,400);
  for(const data of [{}, {code:'x'.repeat(43),verifier:'short'}, {code:'x'.repeat(500),verifier:proof}]) assert.equal((await invoke(f.app,'/api/learn/google/redeem','','POST',data)).status,401);
});
test('native denial and existing-account errors return the original app state',async()=>{
  for(const reason of ['google_cancelled','google_existing','google_failed']) {
    const f=nativeFixture();f.google.exchange=async()=>{throw new Error(reason==='google_failed'?'private-provider-detail':reason)};
    const done=await issueHandoff(f,reason==='google_cancelled'?'&error=access_denied':'&code=test');
    const url=new URL(done.headers.location);assert.equal(url.searchParams.get('state'),appState);assert.equal(url.searchParams.get('error'),reason);
    assert.equal(f.handoffs.size,0);assert.equal(f.sessions.size,0);
  }
});
test('native handoffs expire and concurrent redemption grants only one session',async()=>{
  const f=nativeFixture();let done=await issueHandoff(f);let code=new URL(done.headers.location).searchParams.get('code');
  f.handoffs.get(hashToken(code)).expires=Date.now()-1;
  assert.equal((await invoke(f.app,'/api/learn/google/redeem','','POST',{code,verifier:proof})).status,401);
  done=await issueHandoff(f);code=new URL(done.headers.location).searchParams.get('code');
  const results=await Promise.all([1,2].map(()=>invoke(f.app,'/api/learn/google/redeem','','POST',{code,verifier:proof})));
  assert.deepEqual(results.map(x=>x.status).sort(),[200,401]);assert.equal(f.sessions.size,1);
});
test('native handoff respects disabled provider and rate limits',async()=>{
  const f=nativeFixture();const disabled=createApp(f.store,{origin,production:true});
  assert.equal((await invoke(disabled,'/api/learn/auth-options')).body.app,false);
  assert.equal((await invoke(disabled,'/api/learn/google/redeem','','POST',{code:'x'.repeat(43),verifier:proof})).status,404);
  f.store.loginAllowed=async()=>false;
  assert.equal((await invoke(f.app,nativeStart)).status,429);
  assert.equal((await invoke(f.app,'/api/learn/google/redeem','','POST',{code:'x'.repeat(43),verifier:proof})).status,429);
});
