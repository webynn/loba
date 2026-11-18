const { t } = StudioI18n;
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const SWATCHES = ['#1c9bef','#2bb673','#ef4e4e','#e0a100','#ff8a1f','#8b5cf6','#0fa3b1','#8f4f1c'];
const state = {lessons:[],languages:[],activity:[],learners:0,learnerRows:null,learnerSearch:'',learnerLanguage:'all',learnerSort:'recent',learnerProvider:'all',activityPage:1,activityPages:1,activityTotal:0,activityItems:null,activityRequest:0,pending:0,view:'overview',status:'all',language:'all',search:'',editing:null,editingLanguage:null,dirty:false,busy:false};
let toastTimer;

function toast(message) { $('toast').textContent=message; $('toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').hidden=true,3500); }
async function api(path, options={}) {
  const response=await fetch(path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers}});
  let data; try { data=await response.json(); } catch { throw new Error(t("The server did not return a valid response. Please try again.")); }
  if(!response.ok) {
    if(response.status===401 && path!=='/api/auth/login') { for(const d of document.querySelectorAll('dialog[open]')) d.close(); showLogin(); }
    throw new Error(t(data.error) || t("Request failed."));
  }
  return data;
}
// The Studio CSP forbids inline style attributes, so per-item colours and widths are applied through the DOM.
function applyVars(root=document) {
  root.querySelectorAll('[data-c]').forEach(el=>el.style.setProperty('--c',el.dataset.c));
  root.querySelectorAll('[data-pct]').forEach(el=>el.style.setProperty('--pct',el.dataset.pct+'%'));
}
function showLogin() { $('loading').hidden=true; $('workspace').hidden=true; $('login').hidden=false; const signup=location.pathname.replace(/\/$/,'')==='/signup'; $('login-form').hidden=signup; $('signup-form').hidden=!signup; }
function showWorkspace(user) { $('loading').hidden=true; $('login').hidden=true; $('workspace').hidden=false; $('user-email').textContent=user.email; $('avatar').textContent=user.email[0].toUpperCase(); }

const lang = code => state.languages.find(l=>l.code===code) || {code,name_en:code.toUpperCase(),name_fr:code.toUpperCase(),color:'#98a2b3',published:false,position:999};
const langTag = code => { const l=lang(code); return `<span class="lang-tag" data-c="${esc(l.color)}">${esc(l['name_'+StudioI18n.locale]||l.name_en)}</span>`; };
function status(row) { return !row.published?'draft':row.version!==row.published_version?'changes':'published'; }
const STATUS_LABEL = {draft:'Draft',changes:'Unpublished changes',published:'Published'};
const badge = row => { const s=status(row); return `<span class="badge ${s}">${t(STATUS_LABEL[s])}</span>`; };
function date(value) { return value?new Intl.DateTimeFormat(StudioI18n.locale,{month:'short',day:'numeric'}).format(new Date(value)):'—'; }
function relative(value) { const n=Math.max(0,Date.now()-new Date(value)); return n<60000?t("Just now"):n<3600000?t('{n} min ago',{n:Math.floor(n/60000)}):n<86400000?t('{n} h ago',{n:Math.floor(n/3600000)}):date(value); }
const plural = (n, one, many=one+'s') => `${n} ${t(n===1?one:many)}`;
const byCurriculum = (a,b) => lang(a.content.language).position-lang(b.content.language).position || a.content.language.localeCompare(b.content.language) || a.content.position-b.content.position;

// Consistent vector artwork for curriculum topics; stored lesson content stays intact.
const TOPIC_ICONS = {
  '👋':'M4 4h16v12H9l-5 4V4Z M8 8h8 M8 12h5',
  '🆘':'M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  '👪':'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  '🍲':'M3 12h18a9 9 0 0 1-18 0Z M8 3v5 M12 2v6 M16 3v5 M7 21h10',
  '🔢':'M4 5h4v6 M4 11h8 M15 5h4v3l-4 3h4 M4 16h16 M8 14v6 M16 14v6',
  '🏃🏾':'M14 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M7 10l4-3 4 4 4 1 M11 7l-2 7 5 3v5 M9 14l-3 6H2',
  '🏠':'M3 10l9-7 9 7 M5 9v12h14V9 M9 21v-8h6v8',
  '🚕':'M5 11l2-7h10l2 7 M3 11h18v8H3v-8Z M5 19v2 M19 19v2 M6 15h2 M16 15h2',
  '⏰':'M12 7v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  '🩺':'M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z',
  '💵':'M5 7h14l2 14H3L5 7Z M9 8V6a3 3 0 0 1 6 0v2',
  '💛':'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8'
};
// The pictures editors can pick for a unit. The emoji is what lessons store; Studio draws the matching icon.
const TOPICS = [['👋','Greetings'],['🆘','Getting by'],['👪','Family'],['🍲','Food'],['🔢','Numbers'],['🏃🏾','Actions'],['🏠','Home'],['🚕','Travel'],['⏰','Time'],['🩺','Health'],['💵','Shopping'],['💛','Feelings'],['📚','General']];
function lessonIcon(content) {
  const d=TOPIC_ICONS[content.icon] || 'M12 5C8 3 5 3 2 4v16c3-1 6-1 10 1 4-2 7-2 10-1V4c-3-1-6-1-10 1Z M12 5v16';
  return `<span class="lesson-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${d}"/></svg></span>`;
}

// ---------- data ----------
async function refresh() {
  try {
    const data=await api('/api/admin/lessons');
    Object.assign(state,{lessons:data.lessons,languages:data.languages,activity:data.activity,learners:data.learners});
    $('load-error').hidden=true; render();
  } catch(error) { $('load-error').querySelector('span').textContent=t(error.message); $('load-error').hidden=false; }
}

// ---------- navigation ----------
const views = () => ({
  feedback:["Feedback",StudioI18n.locale === "fr" ? "Bugs, idées et retours des testeurs." : "Bugs, ideas and feedback from testers.",null],
  overview:[t("Overview"),t("Your curriculum at a glance."),'lesson'],
  lessons:[t("Lessons"),t("Write, review and publish units for each language."),'lesson'],
  languages:[t("Languages"),t("Every language Loba teaches, and whether learners can see it."),'language'],
  learners:[t('Learners'),t('Everyone who created an account in the learner app, and how far they’ve got.'),null],
  accounts:[t("Team"),t("People who can edit lessons in Studio."),null],
  music:[t('Music'),t('Childhood songs, ready for a new generation.'),null],
  activity:[t("Activity"),t("What your team has created, edited and published."),null],
});
function navigate(view) {
  state.view=view;
  for(const audio of document.querySelectorAll('#music-list audio')) audio.pause();
  if(view==='music') loadMusic();
  if(view==='feedback') loadFeedback(1);
  if(view==='testers') loadTesters();
  if(view==='accounts') refreshAccounts();
  if(view==='learners') loadLearners();
  if(view==='activity') loadActivity(1);
  for(const section of document.querySelectorAll('.view')) section.hidden=section.id!==view+'-view';
  document.querySelectorAll('.nav-item').forEach(b=>{ const on=b.dataset.view===view; b.classList.toggle('active',on); if(on)b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
  const [title,subtitle,action]=view==='testers'?['Testeurs · Testers','iOS / Android',null]:views()[view];
  $('page-title').textContent=title; $('page-subtitle').textContent=subtitle; document.title=`${title} · Loba Studio`;
  $('primary-action').hidden=!action; $('primary-label').textContent=action==='language'?t("Add language"):t("New lesson");
  render(); window.scrollTo({top:0});
}

// ---------- rendering ----------
function languageSummary() {
  if(!state.languages.length) return `<div class="empty"><b>${t("No languages yet.")}</b><span>${t("Add the first language Loba should teach.")}</span></div>`;
  return state.languages.map(l=>{
    const lessons=state.lessons.filter(x=>x.content.language===l.code), live=lessons.filter(x=>x.published).length;
    const pct=lessons.length?Math.round(live/lessons.length*100):0;
    return `<button class="lang-row" data-filter-language="${esc(l.code)}"><span class="lang-swatch" data-c="${esc(l.color)}">${esc(l.code)}</span><span class="lang-name"><b>${esc(l['name_'+StudioI18n.locale]||l.name_en)}</b><small>${plural(lessons.length,'unit')} · ${esc(l['region_'+StudioI18n.locale]||l.name_fr)}</small></span><span class="meter-wrap"><span class="meter" data-c="${esc(l.color)}"><i data-pct="${pct}"></i></span><span class="meter-label">${t('{live} of {total} published',{live,total:lessons.length})}</span></span><span class="badge ${l.published?'visible':'hidden'}">${l.published?t("Visible"):t("Hidden")}</span></button>`;
  }).join('');
}
const ACTIVITY = {created:['plus','created'],saved:['edit','edited'],published:['send','published'],unpublished:['refresh','unpublished'],deleted:['trash','deleted'],'account approved':['users','was approved for Studio'],'language added':['globe','added as a language'],'language updated':['globe','language settings updated'],'language deleted':['trash','removed as a language']};
function activities(items) {
  if(!items.length) return `<div class="empty"><b>${t("Nothing yet.")}</b><span>${t("Edits and publications will show up here.")}</span></div>`;
  return items.map(item=>{ const [ic,verb]=ACTIVITY[item.action]||['activity',item.action]; const kind=item.action.split(' ').at(-1);
    return `<div class="activity"><span class="activity-icon ${esc(kind)}">${icon(ic)}</span><div><p><b>${esc(item.lesson_title)}</b> ${esc(t(verb))}</p><small>${esc(item.admin_email)} · ${relative(item.created_at)}</small></div></div>`; }).join('');
}
function providerBadge(l) {
  const label=l.googleLinked?(l.passwordLogin?'Google + '+t('Email and password'):'Google'):t('Email and password');
  return `<span class="provider-badge ${l.googleLinked?'google':''}">${l.googleLinked?'<b aria-hidden="true">G</b>':''}${esc(label)}</span>`;
}
async function loadActivity(page=1) {
  const request=++state.activityRequest;
  $('activity-error').textContent='';
  $('activity-prev').disabled=$('activity-next').disabled=true;
  $('activity-list').setAttribute('aria-busy','true');
  try {
    const data=await api('/api/admin/activity?page='+page);
    if(request!==state.activityRequest)return;
    Object.assign(state,{activityItems:data.items,activityPage:data.page,activityPages:data.pages,activityTotal:data.total});
    renderActivity();
  } catch(error) { if(request===state.activityRequest){$('activity-error').textContent=error.message;renderActivity();} }
  finally { if(request===state.activityRequest)$('activity-list').removeAttribute('aria-busy'); }
}
function renderActivity() {
  const items=state.activityItems;
  if(!items){$('activity-list').innerHTML=`<div class="empty">${t('Loading activity…')}</div>`;return;}
  let day='';
  $('activity-list').innerHTML=items.length?items.map(item=>{
    const when=new Date(item.created_at), group=when.toLocaleDateString(StudioI18n.locale,{year:'numeric',month:'long',day:'numeric'});
    const heading=group!==day?`<h3 class="activity-day">${esc(group)}</h3>`:'';day=group;
    const [ic,verb]=ACTIVITY[item.action]||['activity',item.action];
    return heading+`<article class="activity-event"><span class="activity-icon ${esc(item.action.split(' ').at(-1))}">${icon(ic)}</span><div class="activity-copy"><span class="activity-action">${esc(t(verb))}</span><h4>${esc(item.lesson_title)}</h4><p>${esc(item.admin_email)}</p></div><time datetime="${esc(item.created_at)}" title="${esc(when.toLocaleString(StudioI18n.locale))}">${esc(when.toLocaleTimeString(StudioI18n.locale,{hour:'2-digit',minute:'2-digit'}))}</time></article>`;
  }).join(''):activities([]);
  $('activity-page').textContent=t('Page {page} of {pages} · {total} activities',{page:state.activityPage,pages:state.activityPages,total:state.activityTotal});
  $('activity-prev').disabled=state.activityPage<=1;
  $('activity-next').disabled=state.activityPage>=state.activityPages;
}
function lessonTable(rows, {empty=t("No lessons match.")}={}) {
  if(!rows.length) return `<div class="empty"><b>${empty}</b><span>${t("Try another filter, or start a new unit.")}</span><button class="btn new-lesson">${icon('plus')}${t("New lesson")}</button></div>`;
  return `<table class="table"><thead><tr><th>${t("Lesson")}</th><th>${t("Language")}</th><th>${t("Status")}</th><th>${t("Content")}</th><th>${t("Updated")}</th></tr></thead><tbody>${rows.map(row=>`<tr data-edit="${esc(row.id)}"><td><button class="lesson-cell" data-edit="${esc(row.id)}">${lessonIcon(row.content)}<span><b>${esc(row.content.title)}</b><small>${t('Unit {n}',{n:row.content.position})}${row.content.titleEn?' · '+esc(row.content.titleEn):''}</small></span></button></td><td class="indent">${langTag(row.content.language)}</td><td class="indent">${badge(row)}</td><td class="num hide-sm">${plural(row.content.words.length,'word')} · ${plural(row.content.sentences.length,'sentence')}</td><td class="num hide-sm">${date(row.updated_at)}</td></tr>`).join('')}</tbody></table>`;
}
function languagesTable() {
  if(!state.languages.length) return `<div class="empty"><b>${t("No languages yet.")}</b><button class="btn new-language">${icon('plus')}${t("Add language")}</button></div>`;
  return `<table class="table"><thead><tr><th>${t("Language")}</th><th>${t("Code")}</th><th>${t("Greeting")}</th><th>${t("Units")}</th><th>${t("Learners see it")}</th></tr></thead><tbody>${state.languages.map(l=>{
    const lessons=state.lessons.filter(x=>x.content.language===l.code), live=lessons.filter(x=>x.published).length;
    const shown=l.published&&live>0;
    return `<tr data-edit-language="${esc(l.code)}"><td><span class="lesson-cell"><span class="lang-swatch" data-c="${esc(l.color)}">${esc(l.code)}</span><span><b>${esc(l['name_'+StudioI18n.locale]||l.name_en)}</b><small>${esc(l.name_fr)}${l['region_'+StudioI18n.locale]?' · '+esc(l['region_'+StudioI18n.locale]):''}</small></span></span></td><td class="hide-sm"><span class="code">${esc(l.code)}</span></td><td class="hide-sm">${esc(l.greeting)||'<span class="muted">—</span>'}</td><td class="num indent">${t('{live} published · {total} total',{live,total:lessons.length})}</td><td class="indent"><span class="badge ${shown?'visible':'hidden'}">${shown?t("Visible"):l.published?t("Visible, no published units"):t("Hidden")}</span></td></tr>`;
  }).join('')}</tbody></table>`;
}
function render() {
  const all=state.lessons, live=all.filter(l=>l.published).length, review=all.filter(l=>status(l)!=='published').length;
  $('nav-count').textContent=all.length||''; $('nav-languages').textContent=state.languages.length||'';
  $('nav-pending').textContent=state.pending; $('nav-pending').hidden=!state.pending;
  const words=all.reduce((n,l)=>n+l.content.words.length,0);
  $('stats').innerHTML=[['Lessons',all.length,`${plural(state.languages.length,'language')}`],['Published',live,'Live in the learner app'],['Needs review',review,'Drafts and unpublished changes'],['Learners',state.learners,'See their progress','learners']]
    .map(([label,value,sub,view])=>`<div class="stat${view?' link':''}" ${view?`data-view="${view}" role="button" tabindex="0"`:''}><span>${t(label)}</span><b>${value.toLocaleString(StudioI18n.locale)}</b><small>${t(sub)}</small></div>`).join('');
  $('nav-learners').textContent=state.learners||'';
  $('language-summary').innerHTML=languageSummary();
  $('recent-activity').innerHTML=activities(state.activity.slice(0,5)); renderActivity();
  $('recent-table').innerHTML=lessonTable([...all].sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at)).slice(0,5),{empty:t("No lessons yet.")});
  const options=state.languages.map(l=>`<option value="${esc(l.code)}">${esc(l['name_'+StudioI18n.locale]||l.name_en)}</option>`).join('');
  $('language-filter').innerHTML=`<option value="all">${t("All languages")}</option>${options}`; $('language-filter').value=state.language;
  const query=state.search.toLowerCase().trim();
  const filtered=all.filter(row=>(state.language==='all'||row.content.language===state.language)
    && (state.status==='all'||state.status==='published'&&!!row.published||status(row)===state.status)
    && (!query||[row.content.title,row.content.titleEn,...row.content.words.flatMap(w=>[w.term,w.fr,w.en])].join(' ').toLowerCase().includes(query))).sort(byCurriculum);
  $('lessons-table').innerHTML=lessonTable(filtered);
  $('languages-table').innerHTML=languagesTable();
  renderLearners();
  applyVars();
}

// ---------- recordings ----------
let recorder=null, player=null, requestingMic=false;
async function uploadAudio(blob) {
  if(blob.size>1500000) throw new Error(t("Keep recordings under 1.5 MB."));
  const response=await fetch('/api/admin/audio',{method:'POST',credentials:'same-origin',headers:{'Content-Type':blob.type||'application/octet-stream'},body:blob});
  const data=await response.json().catch(()=>({})); if(!response.ok) throw new Error(t(data.error)||t("Upload failed.")); return data.id;
}
function recordingMarkup(field, value='', original='') {
  return `<div class="recording-panel"><span class="recording-caption">${t(field==='exampleAudio'?'Example pronunciation':'Pronunciation')}</span><div class="audio"><input type="hidden" data-field="${field}" value="${esc(value)}"><input type="hidden" data-field="${field}Original" value="${esc(original)}">${[['record','mic','Record'],['upload','upload','Upload audio'],['play','play','Listen'],['clean','sparkles','Clean audio'],['restore','undo','Restore original'],['clear','x','Remove recording']].map(([name,i,label])=>`<button type="button" class="a-${name} recording-action">${['sparkles','undo'].includes(i)?'':icon(i)}<span>${t(label)}</span></button>`).join('')}<input type="file" accept="audio/*" hidden><span class="state" role="status"></span></div><p class="audio-msg" role="status"></p></div>`;
}
function audioControls(row) {
  row.querySelectorAll('.recording-panel').forEach(panel=>{
    const inputs=panel.querySelectorAll('input[type=hidden]'), input=inputs[0], original=inputs[1], stateEl=panel.querySelector('.state'), msg=panel.querySelector('.audio-msg');
    const buttons=Object.fromEntries(['record','upload','play','clean','restore','clear'].map(n=>[n,panel.querySelector(`.a-${n}`)])), file=panel.querySelector('input[type=file]');
    let pending=false;
    const paint=(note='')=>{ const has=!!input.value; buttons.play.hidden=buttons.clean.hidden=buttons.clear.hidden=!has; buttons.restore.hidden=!original.value; stateEl.textContent=has?t('Recorded'):t('No recording yet'); stateEl.classList.toggle('ok',has); msg.textContent=note; };
    const attach=async(blob,clean=false)=>{ pending=true; state.audioPending=(state.audioPending||0)+1; Object.values(buttons).forEach(b=>b.disabled=true); stateEl.textContent=t('Uploading…'); try{ const id=await uploadAudio(blob); if(clean) original.value=original.value||input.value; else original.value=''; input.value=id; state.dirty=true; paint(); return true; }catch(error){ paint(t(error.message)); return false; }finally{ pending=false; state.audioPending--; Object.values(buttons).forEach(b=>b.disabled=false); } };
    buttons.record.onclick=async()=>{
      if(recorder){ recorder.stop(); return; }
      if(pending||requestingMic)return;
      if(!navigator.mediaDevices||!window.MediaRecorder){ paint(t('This browser can’t record. Upload a file instead.')); return; }
      requestingMic=true;
      let stream;
      try {
        stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
        if(!panel.isConnected||!$('editor').open){stream.getTracks().forEach(t=>t.stop());return;}
        const chunks=[], active=recorder=new MediaRecorder(stream); state.dirty=true;
        active.ondataavailable=e=>chunks.push(e.data);
        active.onstop=()=>{stream.getTracks().forEach(t=>t.stop());recorder=null;buttons.record.classList.remove('recording');buttons.record.querySelector('span').textContent=t('Record'); if(panel.isConnected&&$('editor').open)attach(new Blob(chunks,{type:active.mimeType}));};
        active.start(); buttons.record.classList.add('recording'); buttons.record.querySelector('span').textContent=t('Stop recording'); stateEl.textContent=t('Recording…');
        setTimeout(()=>{if(recorder===active)active.stop();},45000);
      }catch{stream?.getTracks().forEach(t=>t.stop());paint(t('Microphone access was blocked. Allow it, or upload a file.'));}finally{requestingMic=false;}
    };
    buttons.upload.onclick=()=>file.click(); file.onchange=()=>{if(file.files[0])attach(file.files[0]);file.value='';};
    buttons.play.onclick=()=>{player?.pause();player=new Audio(`/api/v1/audio/${input.value}`);player.play().catch(()=>paint(t('This recording can’t be played here.')));};
    buttons.clear.onclick=()=>{player?.pause();input.value='';original.value='';state.dirty=true;paint();};
    buttons.restore.onclick=()=>{player?.pause();input.value=original.value;original.value='';state.dirty=true;paint();};
    buttons.clean.onclick=async()=>{
      if(pending)return; pending=true; state.audioPending=(state.audioPending||0)+1; Object.values(buttons).forEach(b=>b.disabled=true);
      try{const res=await fetch(`/api/v1/audio/${input.value}`);if(!res.ok)throw Error(t('This recording can’t be played here.'));const cleaned=await StudioAudio.clean(await res.arrayBuffer());if(await attach(cleaned,true))paint(t('Volume balanced and low rumble reduced. Listen before publishing.'));}
      catch(error){paint(error.message);}finally{pending=false;state.audioPending--;Object.values(buttons).forEach(b=>b.disabled=false);}
    };
    paint();
  });
}

// ---------- lesson editor ----------
function renumber() {
  [...$('word-rows').children].forEach((r,i)=>r.querySelector('.idx').textContent=i+1);
  [...$('sentence-rows').children].forEach((r,i)=>r.querySelector('.idx').textContent=i+1);
  const words=[...$('word-rows').children].filter(r=>r.querySelector('[data-field="term"]').value.trim()).length;
  $('word-count').textContent=words; $('word-count').classList.toggle('warn',words<4);
  puzzleStatus();
  $('sentence-count').textContent=$('sentence-rows').children.length;
}
function switchTab(name) {
  document.querySelectorAll('.sheet-tabs [data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===name)));
  document.querySelectorAll('#lesson-form [data-panel]').forEach(p=>p.hidden=p.dataset.panel!==name);
  $('editor').querySelector('.sheet-body').scrollTop=0;
}
// Keeps the "how learners see it" card and the position hint in step with the form.
function updatePreview() {
  const form=$('lesson-form'), f=new FormData(form), l=lang(f.get('language')||'');
  const position=Number(f.get('position'))||0;
  $('preview-icon').innerHTML=lessonIcon({icon:f.get('icon')}); $('preview-icon').dataset.c=l.color; applyVars($('preview-icon').parentElement);
  $('preview-meta').textContent=`${l['name_'+StudioI18n.locale]} · ${t('Unit {n}',{n:position||'?'})}`;
  $('preview-title').textContent=f.get('title')||t('Unit title');
  $('preview-sub').textContent=f.get('titleEn')||'';
  const others=state.lessons.filter(x=>x.content.language===l.code && x.id!==state.editing?.id);
  const clash=others.find(x=>x.content.position===position);
  const hint=$('position-hint');
  hint.textContent=clash?t('Unit {n} is already “{title}”. Pick another number, or both will share the spot.',{n:position,title:clash.content.title}):t('{language}: {units}. Learners unlock units in this order.',{language:l['name_'+StudioI18n.locale],units:plural(others.length+(state.editing?.content.language===l.code?1:0),'unit')});
  hint.classList.toggle('warn',!!clash);
}
function renderPickers(content) {
  const langs=state.languages.some(l=>l.code===content.language)?state.languages:[...state.languages,lang(content.language)];
  $('editor-language').innerHTML=langs.map(l=>`<label class="chip" data-c="${esc(l.color)}"><input type="radio" name="language" value="${esc(l.code)}" ${l.code===content.language?'checked':''}><span>${esc(l['name_'+StudioI18n.locale])}</span></label>`).join('');
  const topics=TOPICS.some(([e])=>e===content.icon)?TOPICS:[...TOPICS,[content.icon,t("Current")]];
  $('icon-picker').innerHTML=topics.map(([emoji,label])=>`<label title="${esc(t(label))}"><input type="radio" name="icon" value="${esc(emoji)}" ${emoji===content.icon?'checked':''} aria-label="${esc(t(label))}">${lessonIcon({icon:emoji})}<small>${esc(t(label))}</small></label>`).join('');
  applyVars($('editor-language'));
}
function editorChrome(row, content) {
  const l=lang(content.language);
  $('editor-heading').textContent=row?content.title||t("Untitled lesson"):t("New lesson");
  $('editor-eyebrow').textContent=row?`${l['name_'+StudioI18n.locale]||l.name_en} · ${t('Unit {n}',{n:content.position})}`:t("Draft");
  $('editor-status').innerHTML=row?badge(row):'';
  const notice=$('editor-notice'), s=row?status(row):'draft';
  notice.className='banner'+(s==='published'?' live':s==='changes'?' changes':'');
  notice.innerHTML=icon('info')+`<span><b>${t(s==='published'?'Live for learners.':s==='changes'?'Live, with saved changes.':'Draft.')}</b> ${t(s==='published'?'Edits you save stay private until you press Publish.':s==='changes'?'Learners still see the published version until you press Publish.':'Only your team can see it. Press Publish when it’s ready.')}</span>`;
  $('delete-lesson').hidden=!row; $('unpublish-lesson').hidden=!row?.published;
}
function openEditor(id) {
  if(!state.languages.length){ toast(t("Add a language first.")); openLanguage(); return; }
  const row=state.lessons.find(l=>l.id===id); state.editing=row||null; state.dirty=false;
  const language=state.language!=='all'?state.language:state.languages[0].code;
  const content=row?.content||{language,position:Math.max(0,...state.lessons.filter(l=>l.content.language===language).map(l=>l.content.position))+1,title:'',titleEn:'',icon:'📚',tip:'',words:[],sentences:[]};
  renderPickers(content);
  for(const name of ['position','title','titleEn','tip']) $('lesson-form').elements.namedItem(name).value=content[name];
  $('word-rows').replaceChildren(); content.words.forEach(w=>wordRow(w));
  $('sentence-rows').replaceChildren(); content.sentences.forEach(s=>sentenceRow(s));
  if(!content.words.length) wordRow();
  renumber(); editorChrome(row,content); updatePreview(); switchTab('details');
  $('editor-error').textContent=''; $('editor').showModal();
  state.dirty=false;
}
function wordRow(word={term:'',fr:'',en:''}) {
  const row=document.createElement('div'); row.className='word-row vocab-grid';
  row.innerHTML=`<div class="entry-head"><span class="idx"></span><b>${t('Word or phrase')}</b><button type="button" class="icon-btn danger remove" aria-label="${esc(t('Remove word'))}">${icon('trash')}</button></div><div class="entry-fields">${[['term','Word or phrase'],['fr','French meaning'],['en','English meaning']].map(([key,label])=>`<label class="field">${t(label)}<input data-field="${key}" value="${esc(word[key]||'')}" maxlength="300" ${key!=='en'?'required':''}></label>`).join('')}</div>${recordingMarkup('audio',word.audio,word.audioOriginal)}<label class="game-inclusion"><input type="checkbox" data-field="guessWord" ${word.guessWord!==false?'checked':''}> <span>${t('Include in Guess the Word')}</span></label><div class="example">${[['example','Example sentence'],['exampleFr','Example in French'],['exampleEn','Example in English']].map(([key,label])=>`<label class="field">${t(label)}<input data-field="${key}" value="${esc(word[key]||'')}" maxlength="300"></label>`).join('')}${recordingMarkup('exampleAudio',word.exampleAudio,word.exampleAudioOriginal)}</div>`;
  $('word-rows').append(row); audioControls(row); renumber(); return row;
}
// The word puzzle hides words of 3 to 8 letters; longer phrases stay in lessons only.
const puzzleFits=term=>{ const n=[...term].filter(c=>/\p{L}/u.test(c)).length; return n>=3&&n<=8&&term.trim().split(/\s+/).length<=2; };
function puzzleStatus() {
  if ($('puzzle-simulator').open) renderDraftGrid();
  let fit=0, withExample=0;
  for(const row of $('word-rows').children) {
    const ok=puzzleFits(row.querySelector('[data-field="term"]').value);
    row.querySelector('.example').classList.toggle('off',!ok);
    if(ok) { fit++; if(row.querySelector('[data-field="example"]').value.trim()) withExample++; }
  }
  $('puzzle-status').textContent=t('Word puzzle: {fit} words fit the grid, {done} have an example sentence.',{fit,done:withExample});
}
function sentenceRow(sentence={fr:'',en:'',answer:'',distractors:[]}) {
  const row=document.createElement('div'); row.className='sentence-row';
  row.innerHTML=`<span class="idx"></span><div class="sentence-fields"><label class="field">${t("Prompt in French")}<input data-field="fr" value="${esc(sentence.fr)}" required maxlength="600" placeholder="Je vais bien"></label><label class="field">${t("Prompt in English")}<input data-field="en" value="${esc(sentence.en)}" maxlength="600" placeholder="I’m fine"></label><label class="field">${t("Correct answer")}<input data-field="answer" value="${esc(sentence.answer)}" required maxlength="600" placeholder="Nazali malamu"></label><label class="field">${t("Distractors")}<input data-field="distractors" value="${esc(sentence.distractors.join(', '))}" placeholder="Ozali, yo"><small>${t("Separate with commas.")}</small></label></div><button type="button" class="icon-btn sm danger remove" aria-label="${esc(t("Remove sentence"))}">${icon('trash')}</button>`;
  row.querySelector('.sentence-fields').insertAdjacentHTML('beforeend',recordingMarkup('audio',sentence.audio,sentence.audioOriginal));
  $('sentence-rows').append(row); audioControls(row); renumber(); return row;
}
function readEditor() {
  const fields=new FormData($('lesson-form'));
  const pick=row=>Object.fromEntries([...row.querySelectorAll('[data-field]')].map(el=>[el.dataset.field,el.type==="checkbox" ? el.checked : el.value.trim()]));
  const words=[...$('word-rows').children].map(pick).filter(w=>w.term||w.fr||w.en||w.audio).map(w=>{ for(const key of ['audio','audioOriginal','exampleAudio','exampleAudioOriginal']) if(!w[key]) delete w[key]; if(!w.example) { delete w.example; delete w.exampleFr; delete w.exampleEn; delete w.exampleAudio; delete w.exampleAudioOriginal; } else for(const k of ['exampleFr','exampleEn']) if(!w[k]) delete w[k]; return w; });
  return {language:fields.get('language'),position:Number(fields.get('position')),icon:fields.get('icon'),title:fields.get('title'),titleEn:fields.get('titleEn'),tip:fields.get('tip'),
    words,sentences:[...$('sentence-rows').children].map(row=>{ const s=pick(row); if(!s.audio)delete s.audio; if(!s.audioOriginal)delete s.audioOriginal; s.distractors=s.distractors.split(',').map(t=>t.trim()).filter(Boolean); return s; })};
}
function validEditor() {
  // Empty trailing word rows are ignored; everything else must be complete.
  for(const row of $('word-rows').children) { const inputs=[...row.querySelectorAll('input[data-field="term"],input[data-field="fr"]')]; const used=[...row.querySelectorAll('input[data-field]:not([type=checkbox])')].some(i=>i.value.trim()); inputs.forEach(i=>i.required=used); }
  // Fields on another tab can't show their message, so open the tab holding the first problem.
  const invalid=$('lesson-form').querySelector('input:invalid,textarea:invalid');
  if(invalid) switchTab(invalid.closest('[data-panel]').dataset.panel);
  return $('lesson-form').reportValidity();
}
function busy(value) { state.busy=value; $('lesson-form').querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=value); }
function savedRow(row) {
  state.editing=row; state.dirty=false;
  const i=state.lessons.findIndex(l=>l.id===row.id); if(i<0) state.lessons.push(row); else state.lessons[i]=row;
  editorChrome(row,row.content);
}
async function save(publish=false) {
  if(recorder || requestingMic || state.audioPending){toast(t("Finish recording and uploading before saving."));return;}
  if(state.busy || !validEditor()) return;
  const data=readEditor();
  if(publish&&!data.words.length) { $('editor-error').textContent=t("Add at least one word before publishing."); return; }
  busy(true); $('editor-error').textContent='';
  try {
    let row=state.editing;
    if(!row||state.dirty) {
      const result=await api(row?`/api/admin/lessons/${row.id}`:'/api/admin/lessons',{method:row?'PUT':'POST',body:JSON.stringify({...data,version:row?.version})});
      row=result.lesson; savedRow(row);
    }
    if(publish) { const result=await api(`/api/admin/lessons/${row.id}/publish`,{method:'POST',body:JSON.stringify({version:row.version})}); savedRow(result.lesson); }
    $('editor').close(); toast(publish?t("Published. Learners will see it on their next visit."):t("Draft saved.")); await refresh();
  } catch(error) { $('editor-error').textContent=t(error.message); }
  finally { busy(false); }
}
async function mutateLesson(action) {
  if(state.busy || !state.editing) return;
  const row=state.editing;
  const message=action==='delete'?t('Delete “{title}”? This can’t be undone.',{title:row.content.title}):t('Unpublish “{title}”? Learners will stop seeing it.',{title:row.content.title});
  if(!confirm(message+(state.dirty?' '+t('Unsaved edits will be lost.'):''))) return;
  busy(true); $('editor-error').textContent='';
  try {
    await api(`/api/admin/lessons/${row.id}${action==='unpublish'?'/unpublish':''}`,{method:action==='delete'?'DELETE':'POST',body:JSON.stringify({version:row.version})});
    state.dirty=false; $('editor').close(); toast(action==='delete'?t("Lesson deleted."):t("Lesson moved back to draft.")); await refresh();
  } catch(error) { $('editor-error').textContent=t(error.message); } finally { busy(false); }
}
function closeEditor() { if(state.busy) return; if(state.dirty&&!confirm(t("Discard your unsaved changes?"))) return; recorder?.stop(); player?.pause(); state.dirty=false; $('editor').close(); }
function preview() {
  const c=readEditor(), l=lang(c.language);
  $('preview-content').innerHTML=`<div class="preview-title"><span class="big">${esc(c.icon)}</span><p class="eyebrow">${esc(l['name_'+StudioI18n.locale]||l.name_en)} · ${t('Unit {n}',{n:c.position})}</p><h2>${esc(c.title)||t("Untitled lesson")}</h2>${c.titleEn?`<p class="muted">${esc(c.titleEn)}</p>`:''}</div>${c.tip?`<p class="preview-note">${esc(c.tip)}</p>`:''}<h3>${t("Words")}</h3>${c.words.length?`<div class="preview-list">${c.words.map(w=>`<div><b>${esc(w.term)}</b><span>${esc(w.fr)}${w.en?' · '+esc(w.en):''}</span>${w.example?`<em>${esc(w.example)}${w.exampleFr?' — '+esc(w.exampleFr):''}</em>`:''}</div>`).join('')}</div>`:`<p class="muted">${t("No words yet.")}</p>`}${c.sentences.length?`<h3>${t("Sentences")}</h3><div class="preview-list">${c.sentences.map(s=>`<div><b>${esc(s.fr)}</b><span>${esc(s.answer)}</span></div>`).join('')}</div>`:''}`;
  $('preview').showModal();
}

// ---------- languages ----------
function openLanguage(code) {
  const l=code?state.languages.find(x=>x.code===code):null; state.editingLanguage=l||null;
  const form=$('language-form'); form.reset();
  const value=l||{name_fr:'',name_en:'',code:'',greeting:'',cheer:'',region_fr:'',region_en:'',color:SWATCHES.find(c=>!state.languages.some(x=>x.color===c))||SWATCHES[0],position:Math.max(0,...state.languages.map(x=>x.position))+1,published:false};
  for(const name of ['name_fr','name_en','code','greeting','cheer','region_fr','region_en','position']) form.elements.namedItem(name).value=value[name];
  form.elements.namedItem('code').disabled=!!l; form.elements.namedItem('published').checked=value.published;
  const colors=SWATCHES.includes(value.color)?SWATCHES:[...SWATCHES,value.color];
  $('swatches').innerHTML=colors.map(c=>`<label title="${c}"><input type="radio" name="color" value="${c}" ${c===value.color?'checked':''} aria-label="${t('Colour {color}',{color:c})}"><span data-c="${c}"></span></label>`).join('');
  applyVars($('swatches'));
  const used=l&&state.lessons.some(x=>x.content.language===l.code);
  $('delete-language').hidden=!l||used;
  $('language-heading').textContent=l?t('Edit {name}',{name:l['name_'+StudioI18n.locale]||l.name_en}):t("Add a language");
  $('language-error').textContent=''; $('language-dialog').showModal();
}
async function saveLanguage(event) {
  event.preventDefault();
  const form=$('language-form'); if(!form.reportValidity()) return;
  const f=new FormData(form);
  const body={name_fr:f.get('name_fr'),name_en:f.get('name_en'),code:(f.get('code')||'').toLowerCase(),greeting:f.get('greeting'),cheer:f.get('cheer'),region_fr:f.get('region_fr'),region_en:f.get('region_en'),color:f.get('color'),position:Number(f.get('position')),published:form.elements.namedItem('published').checked};
  const editing=state.editingLanguage;
  try {
    await api(editing?`/api/admin/languages/${editing.code}`:'/api/admin/languages',{method:editing?'PUT':'POST',body:JSON.stringify(body)});
    $('language-dialog').close(); toast(editing?t("Language saved."):t('{name} added. Create its first lesson when you’re ready.',{name:body['name_'+StudioI18n.locale]})); await refresh();
  } catch(error) { $('language-error').textContent=t(error.message); }
}
async function deleteLanguage() {
  const l=state.editingLanguage; if(!l||!confirm(t('Delete {name}? This can’t be undone.',{name:l['name_'+StudioI18n.locale]||l.name_en}))) return;
  try { await api(`/api/admin/languages/${l.code}`,{method:'DELETE',body:'{}'}); $('language-dialog').close(); toast(t("Language deleted.")); await refresh(); }
  catch(error) { $('language-error').textContent=t(error.message); }
}

// ---------- learners ----------
const DAY=86400000;
const daysAgo = day => day?Math.floor((Date.now()-Date.parse(day+'T12:00:00Z'))/DAY):null;
function lastSeen(l) {
  const d=daysAgo(l.lastActiveDay);
  if(d===null) return l.lessonsDone?'—':t("Not started");
  return d<=0?t("Today"):d===1?t("Yesterday"):d<7?t('{n} days ago',{n:d}):date(l.lastActiveDay);
}
async function loadLearners() {
  $('learners-error').textContent='';
  if(!state.learnerRows) $('learners-table').innerHTML=`<div class="empty">${t("Loading learners…")}</div>`;
  try { state.learnerRows=(await api('/api/admin/learners')).learners; state.learners=state.learnerRows.length; render(); }
  catch(error) { $('learners-error').textContent=error.message; }
}
function unitsDone(l) { return Object.values(l.progress).filter(n=>n>=4).length; }
function renderLearners() {
  const rows=state.learnerRows; if(!rows) return;
  const active=rows.filter(l=>{ const d=daysAgo(l.lastActiveDay); return d!==null&&d<7; }).length;
  $('learner-stats').innerHTML=[[t("Learners"),rows.length,t("Accounts created")],[t("Active this week"),active,t("Practised in the last 7 days")],[t("Lessons completed"),rows.reduce((n,l)=>n+l.lessonsDone,0),t("By all learners")],[t("Words learned"),rows.reduce((n,l)=>n+l.wordsLearned,0),t("Across all languages")]]
    .map(([label,value,sub])=>`<div class="stat"><span>${label}</span><b>${value.toLocaleString(StudioI18n.locale)}</b><small>${t(sub)}</small></div>`).join('');
  $('learner-language').innerHTML=`<option value="all">${t("All languages")}</option>${state.languages.map(l=>`<option value="${esc(l.code)}">${esc(l['name_'+StudioI18n.locale])}</option>`).join('')}`;
  $('learner-language').value=state.learnerLanguage;
  const q=state.learnerSearch.toLowerCase().trim();
  const sorters={recent:(a,b)=>(b.lastActiveDay||'').localeCompare(a.lastActiveDay||'')||new Date(b.joined)-new Date(a.joined),xp:(a,b)=>b.xp-a.xp,streak:(a,b)=>b.streak-a.streak||b.bestStreak-a.bestStreak,new:(a,b)=>new Date(b.joined)-new Date(a.joined)};
  const list=rows.filter(l=>(state.learnerProvider==='all'||state.learnerProvider==='google'&&l.googleLinked||state.learnerProvider==='email'&&l.passwordLogin)&&(state.learnerLanguage==='all'||l.language===state.learnerLanguage)&&(!q||`${l.name} ${l.email}`.toLowerCase().includes(q))).sort(sorters[state.learnerSort]);
  if(!rows.length) { $('learners-table').innerHTML=`<div class="empty"><b>${t("No learners yet.")}</b><span>${t("People who create an account in the learner app appear here.")}</span></div>`; return; }
  if(!list.length) { $('learners-table').innerHTML=`<div class="empty"><b>${t("No learners match.")}</b><span>${t("Try another search or language.")}</span></div>`; return; }
  $('learners-table').innerHTML=`<table class="table"><thead><tr><th>${t("Learner")}</th><th>${t("Learning")}</th><th>XP</th><th>${t("Streak")}</th><th>${t("Lessons")}</th><th>${t("Words")}</th><th>${t("Last practice")}</th><th>${t("Joined")}</th></tr></thead><tbody>${list.map(l=>`<tr data-learner="${esc(l.id)}"><td><span class="lesson-cell"><span class="me-avatar">${esc(l.name[0]?.toUpperCase()||'?')}</span><span><b>${esc(l.name)}</b><small>${esc(l.email)}</small>${providerBadge(l)}</span></span></td><td class="indent">${l.language?langTag(l.language):`<span class="muted">${t("Not chosen")}</span>`}</td><td class="num indent">${l.xp.toLocaleString(StudioI18n.locale)} XP</td><td class="num hide-sm">${l.streak?`<span class="streak">${icon('flame')}${l.streak}</span>`:'<span class="muted">0</span>'}</td><td class="num hide-sm">${l.lessonsDone}</td><td class="num hide-sm">${l.wordsLearned}</td><td class="num indent">${lastSeen(l)}</td><td class="num hide-sm">${date(l.joined)}</td></tr>`).join('')}</tbody></table>`;
  applyVars($('learners-table'));
}
function openLearner(id) {
  const l=state.learnerRows?.find(x=>x.id===id); if(!l) return;
  $('learner-avatar').textContent=l.name[0]?.toUpperCase()||'?'; $('learner-heading').textContent=l.name; $('learner-email').textContent=l.email;
  const tiles=[['XP',l.xp.toLocaleString(StudioI18n.locale)],[t("Current streak"),plural(l.streak,'day')],[t("Best streak"),plural(l.bestStreak,'day')],[t("Lessons done"),l.lessonsDone],[t("Words learned"),l.wordsLearned],[t("Daily goal"),l.goal?`${l.goal} XP`:'—']];
  // Units grouped by language, in course order, for every language the learner has touched.
  const codes=[...new Set([l.language,...state.lessons.filter(x=>l.progress[x.id]).map(x=>x.content.language)].filter(Boolean))];
  const courses=codes.map(code=>{
    const units=state.lessons.filter(x=>x.content.language===code&&x.published).sort(byCurriculum);
    const done=units.filter(u=>(l.progress[u.id]||0)>=4).length;
    return `<section class="course"><header><span class="lang-tag" data-c="${esc(lang(code).color)}">${esc(lang(code)['name_'+StudioI18n.locale])}</span><small>${t('{n} of {total} units complete',{n:done,total:units.length})}${code===l.language?' · '+t('Learning now'):''}</small></header>
      ${units.map(u=>{ const n=l.progress[u.id]||0; return `<div class="course-unit ${n>=4?'done':n?'started':''}">${lessonIcon(u.content)}<span><b>${esc(u.content.title)}</b><small>${t('Unit {n}',{n:u.content.position})} · ${n>=4?t("Complete"):n?t('{n} of 4 lessons',{n}):t("Not started")}</small></span><span class="meter" data-c="${esc(lang(code).color)}"><i data-pct="${n*25}"></i></span></div>`; }).join('')}</section>`;
  }).join('');
  $('learner-body').innerHTML=`${providerBadge(l)}<div class="tiles">${tiles.map(([k,v])=>`<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
    <p class="muted small">${t('Joined')} ${date(l.joined)} · ${t('Last practice')} ${lastSeen(l).toLowerCase()}${l.lastSync?` · ${t('Progress saved')} ${relative(l.lastSync).toLowerCase()}`:''}</p>
    ${courses||`<div class="empty"><b>${t("No lessons started yet.")}</b><span>${t("Their progress shows here once they finish a lesson.")}</span></div>`}`;
  applyVars($('learner-body'));
  $('learner-dialog').showModal();
}

// ---------- team ----------
async function refreshAccounts(quiet=false) {
  if(!quiet) { $('accounts-error').textContent=''; $('accounts-list').innerHTML=`<div class="empty">${t("Loading…")}</div>`; }
  try {
    const {accounts}=await api('/api/admin/accounts'); state.pending=accounts.length; render();
    $('accounts-list').innerHTML=accounts.length?accounts.map(a=>`<div class="request"><div><b>${esc(a.email)}</b><small>${t('Requested {date}',{date:date(a.created_at)})}</small></div><button class="btn" data-approve="${esc(a.id)}" data-email="${esc(a.email)}">${icon('check')}${t("Approve")}</button></div>`).join(''):`<div class="empty"><b>${t("No pending requests.")}</b><span>${t("New requests from /signup appear here.")}</span></div>`;
  } catch(error) { if(!quiet){ $('accounts-list').textContent=''; $('accounts-error').textContent=t(error.message); } }
}
$('refresh-accounts').onclick=()=>refreshAccounts();
$('accounts-list').onclick=async event=>{
  const button=event.target.closest('[data-approve]'); if(!button) return;
  if(!confirm(t('Give {email} access to edit and publish all lessons?',{email:button.dataset.email}))) return;
  button.disabled=true;
  try { await api(`/api/admin/accounts/${button.dataset.approve}/approve`,{method:'POST',body:'{}'}); toast(t("Approved. They can sign in now.")); await refreshAccounts(); await refresh(); }
  catch(error) { $('accounts-error').textContent=t(error.message); button.disabled=false; }
};

// ---------- auth ----------
$('signup-form').onsubmit=async event=>{
  event.preventDefault(); const form=event.currentTarget, button=form.querySelector('button[type=submit]');
  const fields=new FormData(form); $('signup-error').textContent='';
  if(fields.get('password')!==fields.get('confirmation')) { $('signup-error').textContent=t("The passwords don’t match."); return; }
  button.disabled=true;
  try {
    const result=await api('/api/auth/signup',{method:'POST',body:JSON.stringify({email:fields.get('email'),password:fields.get('password')})});
    form.reset(); form.querySelectorAll('label').forEach(el=>el.hidden=true); button.hidden=true;
    $('signup-success').textContent=t(result.message); $('signup-success').hidden=false;
  } catch(error) { $('signup-error').textContent=t(error.message); }
  finally { button.disabled=false; }
};
$('login-form').addEventListener('submit',async event=>{
  event.preventDefault(); const button=event.currentTarget.querySelector('button'); button.disabled=true; $('login-error').textContent='';
  try { const {user}=await api('/api/auth/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))}); $('login-form').reset(); await start(user); }
  catch(error){ $('login-error').textContent=t(error.message); } finally { button.disabled=false; }
});
$('logout').onclick=async()=>{ try{ await api('/api/auth/logout',{method:'POST',body:'{}'}); Object.assign(state,{lessons:[],activity:[],languages:[]}); showLogin(); }catch(error){ toast(t(error.message)); } };

// ---------- events ----------
document.addEventListener('click',event=>{
  const target=event.target.closest('button,tr,[data-view]'); if(!target) return;
  const d=target.dataset;
  if(d.view) navigate(d.view);
  if(target.classList.contains('new-lesson')) openEditor();
  if(target.classList.contains('new-language')) openLanguage();
  if(d.edit) openEditor(d.edit);
  if(d.editLanguage) openLanguage(d.editLanguage);
  if(d.learner) openLearner(d.learner);
  if(d.tab) switchTab(d.tab);
  if(d.filterLanguage) { state.language=d.filterLanguage; state.status='all'; document.querySelectorAll('[data-status]').forEach(b=>b.classList.toggle('selected',b.dataset.status==='all')); navigate('lessons'); }
  if(d.status) { state.status=d.status; document.querySelectorAll('[data-status]').forEach(b=>b.classList.toggle('selected',b===target)); render(); }
  if(target.classList.contains('remove')) { target.closest('.word-row,.sentence-row').remove(); state.dirty=true; renumber(); }
});
$('primary-action').onclick=()=>views()[state.view][2]==='language'?openLanguage():openEditor();
$('search').oninput=e=>{ state.search=e.target.value; render(); };
$('language-filter').onchange=e=>{ state.language=e.target.value; render(); };
$('retry').onclick=refresh;
$('word-rows').addEventListener('input',puzzleStatus);
$('add-word').onclick=()=>{ wordRow().querySelector('input').focus(); state.dirty=true; };
$('add-sentence').onclick=()=>{ sentenceRow().querySelector('input').focus(); state.dirty=true; };
$('lesson-form').oninput=e=>{ state.dirty=true; if(e.target.dataset.field==='term') renumber(); else updatePreview(); };
$('lesson-form').onchange=e=>{ if(e.target.type==='radio') { state.dirty=true; updatePreview(); } };
$('learner-search').oninput=e=>{ state.learnerSearch=e.target.value; renderLearners(); };
$('learner-language').onchange=e=>{ state.learnerLanguage=e.target.value; renderLearners(); };
$('learner-provider').onchange=e=>{state.learnerProvider=e.target.value;renderLearners();};
$('refresh-learners').onclick=loadLearners;
$('refresh-activity').onclick=()=>loadActivity(1);
$('activity-prev').onclick=()=>loadActivity(state.activityPage-1);
$('activity-next').onclick=()=>loadActivity(state.activityPage+1);
$('learner-sort').onchange=e=>{ state.learnerSort=e.target.value; renderLearners(); };
$('close-learner').onclick=()=>$('learner-dialog').close();
document.addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.matches?.('.stat.link')) e.target.click(); });
$('lesson-form').onsubmit=e=>{ e.preventDefault(); save(); };
$('publish-lesson').onclick=()=>save(true); $('delete-lesson').onclick=()=>mutateLesson('delete'); $('unpublish-lesson').onclick=()=>mutateLesson('unpublish');
$('close-editor').onclick=closeEditor; $('editor').addEventListener('cancel',e=>{ e.preventDefault(); closeEditor(); });
$('preview-lesson').onclick=preview; $('close-preview').onclick=()=>$('preview').close();
$('language-form').onsubmit=saveLanguage; $('delete-language').onclick=deleteLanguage;
$('close-language').onclick=$('cancel-language').onclick=()=>$('language-dialog').close();
window.addEventListener('beforeunload',e=>{ if(state.dirty){ e.preventDefault(); e.returnValue=''; } });

async function start(user) { showWorkspace(user); navigate(state.view); await refresh(); refreshAccounts(true); }
(async()=>{
  if(location.pathname.replace(/\/$/,'')==='/signup') { showLogin(); return; }
  try { const {user}=await api('/api/auth/me'); await start(user); }
  catch(error) { showLogin(); if(t(error.message)!==t("Sign in to continue.")) $('login-error').textContent=t(error.message); }
})();

document.addEventListener('studio-language-change',()=>{
  navigate(state.view);
  if(state.editing || $('editor').open) editorChrome(state.editing,readEditor());
  $('language-heading').textContent=state.editingLanguage?t('Edit {name}',{name:state.editingLanguage['name_'+StudioI18n.locale]}):t('Add a language');
});

// Use the learner game's 8 × 8 board and unlock its directions by unit.
function makeDraftGrid(words, level) {
  const steps = [[0,1],[1,0]];
  if (level >= 1) steps.push([1,1],[-1,1]);
  if (level >= 4) steps.push([0,-1],[-1,0]);
  if (level >= 8) steps.push([-1,-1],[1,-1]);
  const ordered = [...words].sort((a,b) => b.letters.length-a.letters.length);
  let best;
  for (let attempt=0; attempt<12; attempt++) {
    const cells = Array(64).fill(''), entries = [];
    for (const word of ordered) {
      let score = -1, path;
      for (let origin=0; origin<64; origin++) for (const [dy,dx] of steps) {
        const positions = [];
        let shared = 0;
        for (const letter of word.letters) {
          const i = positions.length, y = (origin>>3)+i*dy, x = origin%8+i*dx, k = y*8+x;
          if (x<0 || x>=8 || y<0 || y>=8 || (cells[k] && cells[k]!==letter)) break;
          if (cells[k]) shared++;
          positions.push(k);
        }
        if (positions.length!==word.letters.length || shared===positions.length) continue;
        const rank = shared + Math.random();
        if (rank>score) { score=rank; path=positions; }
      }
      if (!path) continue;
      path.forEach((k,i)=>cells[k]=word.letters[i]);
      entries.push({...word,path});
    }
    if (!best || entries.length>best.entries.length) best={cells,entries};
    if (entries.length===words.length) break;
  }
  const alphabet=ordered.flatMap(w=>w.letters);
  best.cells=best.cells.map(c=>c || alphabet[Math.floor(Math.random()*alphabet.length)]);
  return best;
}

let draftKey='', draftPuzzle, firstCell=null, foundPaths=new Set();
function renderDraftGrid() {
  const seen=new Set(), words=[];
  for (const row of $('word-rows').children) {
    const term=row.querySelector('.term').value.trim();
    const letters=[...term.normalize('NFC').toUpperCase()].filter(c=>/\p{L}/u.test(c));
    const key=letters.join('');
    if (!puzzleFits(term.normalize('NFC')) || seen.has(key)) continue;
    seen.add(key);
    words.push({term,letters});
    if (words.length===6) break;
  }
  const level=Math.max(0,Number($('lesson-form').elements.position.value)-1);
  const key=JSON.stringify([level,words]);
  if (key===draftKey) return;
  draftKey=key;
  draftPuzzle=words.length>=3 ? makeDraftGrid(words,level) : null;
  firstCell=null; foundPaths.clear();
  $('grid-result').textContent='';
  $('grid-solution').setAttribute('aria-pressed','false');
  $('grid-solution').hidden=!draftPuzzle;
  $('grid-guide').textContent=t(draftPuzzle?'Sample grid from this draft. Select the first and last letters of a word.':'Add three distinct words of 3–8 letters for a preview.');
  $('draft-grid').replaceChildren();
  for (const [i,letter] of (draftPuzzle?.cells||[]).entries()) {
    const button=document.createElement('button');
    button.type='button'; button.textContent=letter; button.dataset.cell=i;
    button.onclick=()=>selectDraftCell(i);
    $('draft-grid').append(button);
  }
  $('grid-words').textContent=(draftPuzzle?.entries||[]).map(w=>w.term).join(' · ');
}
function selectDraftCell(i) {
  if (firstCell===null) firstCell=i;
  else {
    const word=draftPuzzle.entries.find(({path})=>
      (path[0]===firstCell && path.at(-1)===i)||(path[0]===i && path.at(-1)===firstCell));
    if (word) foundPaths.add(word);
    $('grid-result').textContent=word ? '✓ '+word.term : t('Try another pair of letters.');
    firstCell=null;
  }
  paintDraftCells();
}
function paintDraftCells() {
  const solution=$('grid-solution').getAttribute('aria-pressed')==='true';
  const entries=solution ? draftPuzzle.entries : [...foundPaths];
  for (const [i,button] of [...$('draft-grid').children].entries()) {
    const hits=entries.filter(w=>w.path.includes(i)).length;
    button.className=i===firstCell?'selected':hits>1?'crossing':hits?'found':'';
  }
}
$('grid-solution').onclick=event=>{
  const button=event.currentTarget;
  button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'));
  paintDraftCells();
};
$('puzzle-simulator').ontoggle=()=>{ if ($('puzzle-simulator').open) renderDraftGrid(); };
$('lesson-form').elements.position.addEventListener('input',puzzleStatus);


async function loadTesters() {
  $('testers-list').textContent = 'Loading…';
  try {
    const {testers} = await api('/api/admin/testers');
    $('testers-list').innerHTML = testers.length ? '<table class="table"><thead><tr><th>Name</th><th>Store email</th><th>Platform</th><th>Joined</th></tr></thead><tbody>' + testers.map(row => '<tr><td>' + esc(row.name) + '</td><td>' + esc(row.email) + '</td><td>' + esc(row.platform === 'ios' ? 'iOS · TestFlight' : 'Android · Google Play') + '</td><td>' + date(row.created_at) + '</td></tr>').join('') + '</tbody></table>' : '<p class="empty">No signups yet / Aucune inscription.</p>';
  } catch (error) { $('testers-list').textContent = error.message; }
}

// Background music: drafts can be previewed privately before enabling them in the apps.
let musicRows = [];
async function loadMusic() {
  const list = $('music-list');
  list.textContent = t('Loading…');
  try {
    const result = await api('/api/admin/music');
    musicRows = result.tracks;
    list.innerHTML = musicRows.map(song => `<form class="music-card" data-song="${esc(song.id)}">
      <div class="music-card-head"><span aria-hidden="true">♫</span><h2>${esc(song.title)}</h2><span class="badge ${song.enabled?'published':'draft'}">${song.enabled?t('Enabled'):t('Disabled')}</span></div>
      <audio controls preload="none" src="/api/admin/music/${esc(song.id)}/audio"></audio>
      <label class="field">${t('Song title')}<input name="title" value="${esc(song.title)}" maxlength="100" required></label>
      <label class="field">${t('Credit / source')}<input name="credit" value="${esc(song.credit)}" maxlength="500"></label>
      <div class="music-card-actions"><label class="field">${t('Order')}<input type="number" name="position" min="0" max="999" value="${song.position}" required></label>
      <label><input type="checkbox" name="enabled" ${song.enabled?'checked':''}> ${t('Play in apps')}</label><button class="btn primary" type="submit">${t('Save')}</button></div>
      <p class="form-error" role="status"></p></form>`).join('') || `<div class="empty">${t('No songs yet.')}</div>`;
  } catch (error) { list.textContent = t(error.message); }
}
$('music-list').addEventListener('submit',async event=>{
  event.preventDefault(); const form = event.target.closest('[data-song]'); if(!form)return;
  const button=form.querySelector('button[type=submit]'), note=form.querySelector('[role=status]');
  button.disabled=true; note.textContent='';
  try {
    await api('/api/admin/music/'+form.dataset.song,{method:'PUT',body:JSON.stringify({title:form.elements.title.value,credit:form.elements.credit.value,position:Number(form.elements.position.value),enabled:form.elements.enabled.checked})});
    note.textContent=t('Saved'); form.querySelector('h2').textContent=form.elements.title.value;
    const badge=form.querySelector('.badge');badge.textContent=t(form.elements.enabled.checked?'Enabled':'Disabled');badge.className='badge '+(form.elements.enabled.checked?'published':'draft');
  } catch(error) { note.textContent=t(error.message); } finally { button.disabled=false; }
});
$('music-upload').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  const note=$('music-upload-status');
  if(file.size>15*1024*1024){note.textContent=t('Maximum 15 MB per song.');event.target.value='';return;}
  event.target.disabled=true;note.textContent=t('Uploading…');
  try {
    const response=await fetch('/api/admin/music/upload',{method:'POST',body:file,headers:{'Content-Type':file.type||'application/octet-stream'}});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'Upload failed.');
    note.textContent=t('Uploaded as disabled. Set its title and enable it when ready.'); await loadMusic();
  } catch(error){note.textContent=t(error.message);} finally {event.target.disabled=false;event.target.value='';}
});
// Prevent several previews from playing over each other.
$('music-list').addEventListener('play',event=>{for(const audio of $('music-list').querySelectorAll('audio'))if(audio!==event.target)audio.pause();},true);

let feedbackPage=1, feedbackPages=1;
const feedbackText=(en,fr)=>StudioI18n.locale==='fr'?fr:en;
async function loadFeedback(page){
 $('feedback-list').textContent=feedbackText('Loading…','Chargement…');
 $('feedback-prev').disabled=$('feedback-next').disabled=true;
 try {
  const data=await api('/api/admin/feedback?page='+page);feedbackPage=data.page;feedbackPages=data.pages;
  $('feedback-list').innerHTML=data.items.length?data.items.map(row=>`<article class="feedback-card"><div class="feedback-meta"><b>${esc(row.platform.toUpperCase())} · ${esc(row.kind)}</b><time>${esc(date(row.created_at))}</time></div><h3>${esc(row.title)}</h3><p class="feedback-details">${esc(row.details)}</p><p>${esc(row.device)}</p><small>${esc(row.name)} · ${esc(row.email)} · #${esc(row.id.slice(0,8))}</small><label>${feedbackText('Status','Statut')} <select data-feedback="${esc(row.id)}">${[['new','New','Nouveau'],['reviewing','Reviewing','En cours'],['resolved','Resolved','Résolu']].map(([v,en,fr])=>`<option value="${v}" ${row.status===v?'selected':''}>${feedbackText(en,fr)}</option>`).join('')}</select></label></article>`).join(''):`<p class="empty">${feedbackText('No feedback yet. Share the feedback page with your testers.','Aucun retour. Partage la page avec tes testeurs.')}</p>`;
  $('feedback-page').textContent=`${data.page} / ${data.pages} · ${data.total}`;
  $('feedback-list').querySelectorAll('[data-feedback]').forEach(select=>{select.onchange=async()=>{select.disabled=true;try{await api('/api/admin/feedback/'+select.dataset.feedback,{method:'PATCH',body:JSON.stringify({status:select.value})});toast(feedbackText('Status saved','Statut enregistré'));}catch(error){toast(error.message);await loadFeedback(feedbackPage);}finally{select.disabled=false;}};});
 }catch(error){$('feedback-list').textContent=error.message;}
 finally{$('feedback-prev').disabled=feedbackPage<=1;$('feedback-next').disabled=feedbackPage>=feedbackPages;}
}
$('feedback-prev').onclick=()=>loadFeedback(feedbackPage-1);
$('feedback-next').onclick=()=>loadFeedback(feedbackPage+1);
