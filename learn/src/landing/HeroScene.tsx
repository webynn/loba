import river from '../kapi/river.jpg'
import { useState } from 'react'
import { sfx } from '../audio/sfx'
import { Loba, type Mood } from '../components/Loba'
import { useT } from '../i18n/useT'
import type { Greeting } from './copy'

/** Kapi in a pirogue on the Congo river at golden hour. Tap him to hear a greeting. */
export function HeroScene({ hint, greetings }: { hint: string; greetings: Greeting[] }) {
  const { ui } = useT()
  const [i, setI] = useState(0)
  const [mood, setMood] = useState<Mood>('wave')
  const g = greetings[i % greetings.length]!

  const tap = () => {
    sfx('tap')
    setI((n) => n + 1)
    setMood('cheer')
    window.setTimeout(() => setMood('wave'), 650)
  }

  return (
    <div className="scene">
      <img className="scene-back" src={river} alt="" />

      <button className="scene-loba" onClick={tap} aria-label={`${g.text} (${ui === 'en' ? g.en : g.fr})`}>
        <Loba mood={mood} />
      </button>

      <svg className="scene-front" viewBox="0 0 400 400" aria-hidden="true">
        {/* pirogue */}
        <path d="M44 266q156 34 312 0l-14 30q-142 40-284 0z" fill="#8f4f1c" />
        <path d="M44 266q156 34 312 0l-3 8q-153 32-306 0z" fill="#b96a2b" />
        <path d="M66 286q134 30 268 0" stroke="#ffc22e" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M120 296l8-6 8 6 8-6 8 6M248 296l8-6 8 6 8-6 8 6" stroke="#ef4e4e" strokeWidth="3" fill="none" strokeLinejoin="round" />
        {/* paddle resting across the hull */}
        <path d="M86 262l92 22" stroke="#b96a2b" strokeWidth="6" strokeLinecap="round" />
        <ellipse cx="74" cy="259" rx="16" ry="7" transform="rotate(13 74 259)" fill="#8f4f1c" />
      </svg>

      <p className="scene-bubble" key={i} aria-live="polite">
        <b lang={g.lang}>{g.text}</b>
        <span>{ui === 'en' ? g.en : g.fr}</span>
      </p>
      <span className="scene-hint" aria-hidden="true">{hint}</span>
    </div>
  )
}
