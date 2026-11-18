import { beforeEach, afterEach, test, expect, vi } from 'vitest'
class TestAudio extends EventTarget {
  static latest: TestAudio
  src=''; volume=1; preload=''; paused=true
  constructor() { super(); TestAudio.latest=this }
  play() { this.paused=false; return Promise.resolve() }
  pause() { this.paused=true }
  removeAttribute() { this.src='' }
}
let page: EventTarget & { hidden: boolean }
beforeEach(()=>{
  vi.resetModules()
  page=Object.assign(new EventTarget(),{hidden:false})
  vi.stubGlobal('document',page);vi.stubGlobal('Audio',TestAudio)
  vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()})
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({tracks:[{id:'12345678-1234-1234-1234-123456789abc',title:'A'},{id:'12345678-1234-1234-1234-123456789abd',title:'B'}]})}))
})
afterEach(()=>vi.unstubAllGlobals())
const settle=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve()}
test('requires a gesture, pauses for voice, hidden pages and leaving browsing',async()=>{
  const music=await import('./music');const leave=music.enterMusic();await settle()
  const audio=TestAudio.latest;expect(audio.paused).toBe(true)
  page.dispatchEvent(new Event('pointerdown'));expect(audio.paused).toBe(false)
  music.musicVoice(true);expect(audio.paused).toBe(true)
  music.musicVoice(false);expect(audio.paused).toBe(false)
  page.hidden=true;page.dispatchEvent(new Event('visibilitychange'));expect(audio.paused).toBe(true)
  page.hidden=false;page.dispatchEvent(new Event('visibilitychange'));expect(audio.paused).toBe(false)
  leave();expect(audio.paused).toBe(true)
})
test('shuffles without immediate repeats and respects a saved toggle',async()=>{
  const music=await import('./music');music.enterMusic();await settle();page.dispatchEvent(new Event('pointerdown'))
  const audio=TestAudio.latest;const first=audio.src
  audio.dispatchEvent(new Event('ended'));expect(audio.src).not.toBe(first)
  const second=audio.src;audio.dispatchEvent(new Event('ended'));expect(audio.src).not.toBe(second)
  music.toggleMusic();expect(audio.paused).toBe(true);expect(localStorage.setItem).toHaveBeenCalledWith('loba-background-music','off')
  page.dispatchEvent(new Event('pointerdown'));expect(audio.paused).toBe(true)
})
