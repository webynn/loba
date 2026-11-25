import land from '../kapi/kapi-land.webp'
import wave from '../kapi/kapi-wave.webp'
import jump from '../kapi/kapi-jump.webp'
import crouch from '../kapi/kapi-crouch.webp'

export type Mood = 'idle' | 'happy' | 'cheer' | 'sad' | 'think' | 'wave' | 'dance'

const pose: Record<Mood, string> = {
  idle: land, happy: wave, cheer: jump, sad: crouch,
  think: crouch, wave: wave, dance: jump,
}

export function Loba({ mood = 'idle', className = '' }: { mood?: Mood; className?: string }) {
  return <img className={`loba loba-${mood} ${className}`} src={pose[mood]} alt="" />
}
