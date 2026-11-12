import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { createApp } from '../server/app.js';
import { hashPassword, verifyPassword, hashToken, validateLesson, fail } from '../server/security.js';

const lesson={language:'ln',position:1,title:'Mbote !',titleEn:'Greetings',icon:'👋',tip:'Welcome',words:[{term:'Mbote',fr:'Bonjour',en:'Hello'}],sentences:[{fr:'Je vais bien',en:'I am well',answer:'Nazali malamu',distractors:['yo']}]};
const origin='https://studio.example.com';
async function invoke(app,{url='/',method='GET',headers={},data,raw}={}) {
  const payload=raw ?? (data===undefined?'':JSON.stringify(data));
  const req=Readable.from(payload?[Buffer.from(payload)]:[]);
  Object.assign(req,{url,method,headers,socket:{remoteAddress:'127.0.0.1'}});
  const result={headers:{},status:200};
  const res={setHeader(k,v){result.headers[k.toLowerCase()]=v},writeHead(status,values){result.status=status;for(const [k,v] of Object.entries(values||{}))this.setHeader(k,v)},end(value){result.raw=String(value??'');try{result.data=JSON.parse(result.raw)}catch{}}};
  await app(req,res); return result;
}
function fakeStore() {
  const lessons=new Map();const sessions=new Map();const activity=[];
  return {
    lessonsMap:lessons,sessions,allowed:true,
    async healthy(){},async loginAllowed(){return this.allowed},async admin(){return this.user},
    async createSession(hash,id){sessions.set(hash,{id,email:this.user.email})},async session(hash){return sessions.get(hash)},async logout(hash){sessions.delete(hash)},
    async lessons(){return [...lessons.values()]},async activity(){return activity},
    async published(){return [...lessons.values()].filter(r=>r.published).map(r=>({id:r.id,content:r.published,version:r.published_version}))},
    async mutate({id,content,action,version}){
      let row=lessons.get(id);
      if(action==='created'){row={id,content,version:1,published:null};lessons.set(id,row)}
      else{if(!row)throw fail(404,'Lesson not found.');if(version!==row.version)throw fail(409,'Conflict');
        if(action==='saved'){row.content=content;row.version++}
        if(action==='published'){if(!row.content.words.length)throw fail(400,'Add vocabulary');row.published=structuredClone(row.content);row.published_version=++row.version}
        if(action==='unpublished'){row.published=null;row.published_version=null;row.version++}
        if(action==='deleted'){if(row.published)throw fail(409,'Unpublish first');lessons.delete(id)}
      }return structuredClone(row);
    }
  };
}
function authenticated(){const store=fakeStore();store.sessions.set(hashToken('test-session'),{id:'editor',email:'editor@example.com'});return{store,app:createApp(store,{origin,production:true}),headers:{origin,'content-type':'application/json',cookie:'__Host-loba_session=test-session'}}}

test('password hashing is salted and rejects incorrect credentials',async()=>{
  const password='a-unique-long-test-password';const first=await hashPassword(password),second=await hashPassword(password);
  assert.notEqual(first,second);assert.ok(await verifyPassword(password,first));assert.equal(await verifyPassword('wrong',first),false);assert.equal(await verifyPassword(password,undefined),false);
});
test('all 24 imported units validate, retain their original identity and have vocabulary',async()=>{
  const data=JSON.parse(await readFile(new URL('../data/lessons.json',import.meta.url)));
  assert.equal(data.length,24);assert.equal(new Set(data.map(l=>l.id)).size,24);
  for(const code of ['ln','sw'])assert.equal(data.filter(l=>l.language===code).length,12);
  for(const item of data){assert.ok(validateLesson(item).words.length);assert.ok(item.id.startsWith(item.language+'-'))}
});
test('content validation rejects malformed fields and excessive sizes',()=>{
  assert.throws(()=>validateLesson({...lesson,language:'xx'}),{status:400});
  assert.throws(()=>validateLesson({...lesson,title:' '}),{status:400});
  assert.throws(()=>validateLesson({...lesson,position:0}),{status:400});
  assert.throws(()=>validateLesson({...lesson,words:[null]}),{status:400});
  assert.throws(()=>validateLesson({...lesson,words:Array(101).fill(lesson.words[0])}),{status:400});
  assert.throws(()=>validateLesson({...lesson,sentences:[{...lesson.sentences[0],distractors:'bad'}]}),{status:400});
  assert.equal(validateLesson({...lesson,privilege:'admin'}).privilege,undefined);
});
test('admin endpoints require authentication and reject cross-origin writes',async()=>{
  const {app,headers}=authenticated();
  assert.equal((await invoke(app,{url:'/api/admin/lessons'})).status,401);
  assert.equal((await invoke(app,{url:'/api/admin/lessons',method:'POST',headers:{...headers,origin:'https://attacker.example'},data:lesson})).status,403);
  assert.equal((await invoke(app,{url:'/api/admin/lessons',method:'POST',headers:{...headers,'content-type':'text/plain'},data:lesson})).status,415);
});
test('login creates a secure opaque session, and logout revokes it',async()=>{
  const store=fakeStore();store.user={id:'admin-1',email:'editor@example.com',password_hash:await hashPassword('correct-test-password')};
  const app=createApp(store,{origin,production:true});const headers={origin,'content-type':'application/json'};
  const wrong=await invoke(app,{url:'/api/auth/login',method:'POST',headers,data:{email:store.user.email,password:'wrong'}});assert.equal(wrong.status,401);
  const result=await invoke(app,{url:'/api/auth/login',method:'POST',headers,data:{email:store.user.email,password:'correct-test-password'}});
  assert.equal(result.status,200);assert.match(result.headers['set-cookie'],/HttpOnly; SameSite=Strict; Max-Age=43200; Secure/);
  const cookie=result.headers['set-cookie'].split(';')[0];const token=cookie.split('=')[1];assert.equal(token.length,64);assert.ok(store.sessions.has(hashToken(token)));assert.ok(!store.sessions.has(token));
  assert.equal((await invoke(app,{url:'/api/auth/me',headers:{cookie}})).status,200);
  assert.equal((await invoke(app,{url:'/api/auth/logout',method:'POST',headers:{...headers,cookie},data:{}})).status,200);
  assert.equal((await invoke(app,{url:'/api/auth/me',headers:{cookie}})).status,401);
});
test('login is rate-limited before credential checks and validates null input',async()=>{
  const store=fakeStore();store.allowed=false;const app=createApp(store,{origin});const options={url:'/api/auth/login',method:'POST',headers:{origin,'content-type':'application/json'}};
  const limited=await invoke(app,{...options,data:{email:'test@example.com',password:'test'}});assert.equal(limited.status,429);assert.equal(limited.headers['retry-after'],'900');
  assert.equal((await invoke(app,{...options,data:null})).status,400);
});
test('draft/create/edit/publish/unpublish/delete API workflow preserves public snapshots',async()=>{
  const {app,headers}=authenticated();const request=(url,method,data)=>invoke(app,{url,method,headers,data});
  let result=await request('/api/admin/lessons','POST',lesson);assert.equal(result.status,201);const id=result.data.lesson.id;
  let current=result.data.lesson;
  assert.equal((await invoke(app,{url:'/api/v1/lessons'})).data.lessons.length,0);
  result=await request(`/api/admin/lessons/${id}/publish`,'POST',{version:current.version});current=result.data.lesson;assert.equal(result.status,200);
  const published=(await invoke(app,{url:'/api/v1/lessons'})).data.lessons[0];assert.equal(published.content.title,lesson.title);assert.equal(published.published,undefined);
  result=await request(`/api/admin/lessons/${id}`,'PUT',{...lesson,title:'Changed privately',version:current.version});current=result.data.lesson;
  assert.equal((await invoke(app,{url:'/api/v1/lessons'})).data.lessons[0].content.title,lesson.title);
  assert.equal((await request(`/api/admin/lessons/${id}`,'PUT',{...lesson,version:1})).status,409);
  assert.equal((await request(`/api/admin/lessons/${id}`,'DELETE',{version:current.version})).status,409);
  result=await request(`/api/admin/lessons/${id}/unpublish`,'POST',{version:current.version});current=result.data.lesson;
  assert.equal((await invoke(app,{url:'/api/v1/lessons'})).data.lessons.length,0);
  assert.equal((await request(`/api/admin/lessons/${id}`,'DELETE',{version:current.version})).status,200);
  assert.equal((await request('/api/admin/lessons','GET')).data.lessons.length,0);
});
test('invalid and oversized JSON requests are rejected',async()=>{
  const {app,headers}=authenticated();const options={url:'/api/admin/lessons',method:'POST',headers};
  assert.equal((await invoke(app,{...options,raw:'not json'})).status,400);
  assert.equal((await invoke(app,{...options,raw:' '.repeat(200001)})).status,413);
});
test('static serving exposes only allowlisted assets and includes restrictive headers',async()=>{
  const {app}=authenticated();const index=await invoke(app);assert.equal(index.status,200);assert.match(index.raw,/Loba Studio/);assert.match(index.headers['content-security-policy'],/script-src 'self'/);
  for(const path of ['/.env','/server/store.js','/data/lessons.json','/../.env','/sw.js'])assert.equal((await invoke(app,{url:path})).status,404,path);
  assert.equal((await invoke(app,{url:'/admin/app.js'})).status,200);
  assert.equal((await invoke(app,{url:'/admin/style.css'})).status,200);
});
test('dashboard element references match the HTML',async()=>{
  const html=await readFile(new URL('../admin/index.html',import.meta.url),'utf8');const js=await readFile(new URL('../admin/app.js',import.meta.url),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'Duplicate IDs');
  for(const match of js.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(match[1]),`Missing #${match[1]}`);
});
