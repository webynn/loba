import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { hashToken, verifyPassword, validateLesson, fail } from './security.js';

async function body(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += Buffer.byteLength(chunk); if (size > 200_000) throw fail(413, 'Request too large.'); chunks.push(Buffer.from(chunk)); }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw fail(400, 'Invalid JSON request.'); }
}
export function createApp(store, {origin, production = false}) {
  const cookieName = production ? '__Host-loba_session' : 'loba_session';
  const cookie = (token, age) => `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${production ? '; Secure' : ''}`;
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');
    if (production) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    const json = (status, data) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(data)); };
    try {
      const path = new URL(req.url, origin).pathname;
      const method = req.method;
      if (method === 'GET' && path === '/health') { await store.healthy(); return json(200, {status:'ok'}); }
      // Native clients need no cookies to read published content. Drafts are never returned here.
      if (method === 'GET' && path === '/api/v1/lessons') return json(200, {schemaVersion:1, lessons:await store.published()});
      if (path.startsWith('/api/')) {
        if (!['GET','HEAD'].includes(method)) {
          if (req.headers.origin !== origin) throw fail(403, 'Request origin is not allowed.');
          if (!(req.headers['content-type'] || '').startsWith('application/json')) throw fail(415, 'Use application/json.');
        }
        if (path === '/api/auth/signup' && method === 'POST') {
          const input=await body(req);
          if (!input || typeof input.email !== 'string' || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) || typeof input.password !== 'string' || input.password.length < 14 || input.password.length > 256) throw fail(400,'Enter a valid email and a password of 14–256 characters.');
          const email=input.email.trim().toLowerCase();
          const address=production ? (String(req.headers['x-forwarded-for'] || '').split(',').at(-1).trim() || req.socket.remoteAddress) : req.socket.remoteAddress;
          const allowed=await store.loginAllowed(hashToken(`signup-address:${address}`));
          const emailAllowed=await store.loginAllowed(hashToken(`signup-email:${email}`));
          if(!allowed || !emailAllowed) { res.setHeader('Retry-After','900'); throw fail(429,'Too many sign-up attempts. Try again in 15 minutes.'); }
          await store.register(email,input.password);
          return json(201,{message:'Account created. An administrator must approve your access before you can manage lessons.'});
        }
        if (path === '/api/auth/login' && method === 'POST') {
          const input = await body(req);
          if (!input || typeof input.email !== 'string' || input.email.length > 254 || typeof input.password !== 'string' || input.password.length > 256) throw fail(400, 'Enter your email and password.');
          const email = input.email.toLowerCase().trim();
          // Railway's last forwarded address is the trusted ingress address; never trust the first.
          const address = production ? (String(req.headers['x-forwarded-for'] || '').split(',').at(-1).trim() || req.socket.remoteAddress) : req.socket.remoteAddress;
          const allowed = await store.loginAllowed(hashToken(`email:${email}`));
          const ipAllowed = await store.loginAllowed(hashToken(`address:${address}`));
          if (!allowed || !ipAllowed) { res.setHeader('Retry-After','900'); throw fail(429, 'Too many sign-in attempts. Try again in 15 minutes.'); }
          const admin = await store.admin(email);
          const valid = await verifyPassword(input.password, admin?.password_hash);
          if (!admin || !valid) throw fail(401, 'Email or password is incorrect.');
          if (admin.approved === false) throw fail(403, 'Your account is awaiting administrator approval.');
          const token = randomBytes(32).toString('hex');
          await store.createSession(hashToken(token), admin.id);
          res.setHeader('Set-Cookie',cookie(token,43200));
          return json(200,{user:{email:admin.email}});
        }
        const token = String(req.headers.cookie || '').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1) || '';
        const tokenHash = hashToken(token);
        const user = token ? await store.session(tokenHash) : null;
        if (!user) throw fail(401, 'Sign in to continue.');
        if (path === '/api/auth/me' && method === 'GET') return json(200,{user});
        if (path === '/api/auth/logout' && method === 'POST') { await store.logout(tokenHash); res.setHeader('Set-Cookie',cookie('',0)); return json(200,{ok:true}); }
        if (path === '/api/admin/accounts' && method === 'GET') return json(200,{accounts:await store.pendingAccounts()});
        const approval=path.match(/^\/api\/admin\/accounts\/([0-9a-f-]{36})\/approve$/i);
        if (approval && method === 'POST') { await store.approveAccount(approval[1],user.email); return json(200,{ok:true}); }
        if (path === '/api/admin/lessons' && method === 'GET') return json(200,{lessons:await store.lessons(),activity:await store.activity()});
        if (path === '/api/admin/lessons' && method === 'POST') {
          const input = await body(req);
          return json(201,{lesson:await store.mutate({id:randomUUID(),content:validateLesson(input),action:'created',email:user.email})});
        }
        const match = path.match(/^\/api\/admin\/lessons\/([a-zA-Z0-9-]+)(?:\/(publish|unpublish))?$/);
        if (match && (method==='PUT' && !match[2] || method==='DELETE' && !match[2] || method==='POST' && match[2])) {
          const input = await body(req);
          const action = method==='PUT'?'saved':method==='DELETE'?'deleted':match[2]==='publish'?'published':'unpublished';
          if (!input || typeof input !== 'object') throw fail(400, 'Invalid lesson request.');
          const content = action==='saved'?validateLesson(input):undefined;
          return json(200,{lesson:await store.mutate({id:match[1],content,version:input.version,action,email:user.email})});
        }
        throw fail(404, 'Endpoint not found.');
      }
      if (method !== 'GET' && method !== 'HEAD') throw fail(405, 'Method not allowed.');
      const files = {'/learner.css':'../learner.css','/learner.js':'../learner.js','/lottie.min.js':'../node_modules/lottie-web/build/player/lottie_light.min.js','/lottie-parrot.json':'../lottie-parrot.json','/lottie-celebrate.json':'../lottie-celebrate.json','/admin/tabler.css':'../node_modules/@tabler/core/dist/css/tabler.min.css','/':'../admin/index.html','/admin':'../admin/index.html','/admin/':'../admin/index.html','/admin/app.js':'../admin/app.js','/admin/style.css':'../admin/style.css','/learn':'../index.html','/learn/':'../index.html','/privacy.html':'../privacy.html','/manifest.webmanifest':'../manifest.webmanifest','/icons/icon-192.png':'../icons/icon-192.png','/icons/icon-512.png':'../icons/icon-512.png','/icons/apple-touch-icon.png':'../icons/apple-touch-icon.png'};
      const file = path === '/signup' || path === '/signup/' ? '../admin/index.html' : files[path] || files[path.replace(/^\/learn\//,'/')]; if (!file) throw fail(404,'Page not found.');
      if (!path.startsWith('/learn')) res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
      const ext = file.split('.').at(-1);
      const mime = {json:'application/json',html:'text/html',js:'text/javascript',css:'text/css',png:'image/png',webmanifest:'application/manifest+json'}[ext];
      const data = await readFile(new URL(file,import.meta.url));
      res.writeHead(200,{'Content-Type':mime + (ext==='png'?'':'; charset=utf-8')}); res.end(method==='HEAD'?undefined:data);
    } catch(error) {
      if (!error.status) console.error('Request failed:',error.code || error.name);
      json(error.status || 500,{error:error.status?error.message:'Something went wrong. Please try again.'});
    }
  };
}
