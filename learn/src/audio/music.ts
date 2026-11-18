// One player for browsing screens. Never competes with the teacher's voice.
type Track = { id: string; title: string }
let enabled = true
try { enabled = localStorage.getItem('loba-background-music') !== 'off' } catch { /* private browsing */ }
let active = false, speaking = false, unlocked = false
let tracks: Track[] = [], queue: Track[] = [], currentId = '', lastFetch = 0
const player = new Audio()
player.preload = 'none'
player.volume = 0.16
const listeners = new Set<() => void>()
export const musicEnabled = () => enabled
export const subscribeMusic = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export function toggleMusic() {
  enabled = !enabled
  try { localStorage.setItem('loba-background-music', enabled ? 'on' : 'off') } catch { /* optional storage */ }
  listeners.forEach(fn => fn()); sync()
}
function wanted() { return active && enabled && unlocked && !speaking && !document.hidden }
function sync() {
  if (!wanted()) { player.pause(); return }
  if (!currentId) next()
  else void player.play().catch(() => { /* browser may require another gesture */ })
}
function next() {
  if (!wanted() || !tracks.length) return
  if (!queue.length) {
    queue = [...tracks]
    for (let i=queue.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [queue[i],queue[j]]=[queue[j]!,queue[i]!] }
    if (queue.length>1 && queue[0]?.id===currentId) queue.push(queue.shift()!)
  }
  const track=queue.shift()!
  currentId=track.id; player.src='/api/v1/music/'+track.id
  void player.play().catch(() => {})
}
async function refresh() {
  if (Date.now()-lastFetch<60_000) return
  lastFetch=Date.now()
  try {
    const response=await fetch('/api/v1/music'); if(!response.ok) return
    const data=await response.json()
    tracks=Array.isArray(data.tracks)?data.tracks.filter((t:Track)=>typeof t.id==='string' && /^[0-9a-f-]{36}$/.test(t.id)):[]
    queue=[]
    if(!tracks.some(t=>t.id===currentId)) { player.pause(); player.removeAttribute('src'); currentId='' }
    sync()
  } catch { /* offline: do not block learning */ }
}
export function musicVoice(value: boolean) { speaking=value; sync() }
export function enterMusic() {
  active=true; void refresh(); sync()
  return () => { active=false; player.pause() }
}
player.addEventListener('ended',next)
// Stop after a failed stream; never spin through a broken playlist.
player.addEventListener('error',()=>{player.pause();currentId='';queue=[]})
document.addEventListener('pointerdown',()=>{ unlocked=true; sync() },{passive:true})
document.addEventListener('keydown',()=>{ unlocked=true; sync() })
document.addEventListener('visibilitychange',()=>{if(!document.hidden && active)void refresh();sync()})
