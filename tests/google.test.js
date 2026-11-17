import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createApp } from '../server/app.js';
import { createGoogleAuth, googleIdentity } from '../server/google.js';
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
    consumeGoogleAttempt:async(s,b)=>{const a=attempts.get(s);if(!a||a.bindingHash!==b)return;attempts.delete(s);return{...a,session_hash:a.sessionHash}},
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
