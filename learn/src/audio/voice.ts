import { musicVoice } from './music'
import type { Word } from '../content/types'
import { game } from '../game/store'

/**
 * Pronunciation comes only from recordings made by teachers in Loba Studio.
 * A word without a recording is simply silent — there is no synthetic voice.
 */
export const hasVoice = (w: Pick<Word, 'audio'>) => !!w.audio

let current: HTMLAudioElement | null = null

export function playWord(w: Pick<Word, 'audio'>, slow = false, automatic = false) {
  if (!w.audio || (automatic && !game.get().voice)) return
  try {
    current?.pause()
    musicVoice(true)
    current = new Audio(`/api/v1/audio/${w.audio}`)
    current.preservesPitch = true
    current.playbackRate = slow ? 0.7 : 1
    const playing = current
    const done = () => { if (current === playing) musicVoice(false) }
    current.onended = done
    current.onerror = done
    void current.play().catch(done)
  } catch {
    musicVoice(false)
  }
}
