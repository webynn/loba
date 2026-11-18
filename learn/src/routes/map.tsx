import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { sfx } from '../audio/sfx'
import { confetti } from '../components/fx'
import { Icon } from '../components/Icon'
import { Loba } from '../components/Loba'
import { UiSwitch } from '../components/UiSwitch'
import { actions } from '../game/store'
import { useT } from '../i18n/useT'
import { COUNTRY, CULTURE, HISTORY, MAP_VIEW, PROVINCES, REGIONS, SHAPES, type Province, type Region } from '../map/data'
import { SATELLITE } from '../map/mapbox'
import { saveMap, useMapProgress } from '../map/progress'
import '../styles/map.css'

/** Mboka na biso ("our country"): the map of the DRC as a puzzle, a quiz, an atlas and a little book. */
export const Route = createFileRoute('/map')({ component: MapGame })

const UI = {
  fr: {
    title: 'Mboka na biso', sub: 'La carte du Congo', close: 'Fermer', back: 'Retour',
    intro: 'Remets chaque province à sa place et découvre notre pays.',
    stamps: 'provinces découvertes', regions: 'Les régions', play: 'Jouer', again: 'Rejouer',
    all: 'Le grand défi', allText: 'Les 26 provinces, sans les contours.', allLocked: 'Termine le mode difficile ou les 6 régions pour l’ouvrir.',
    hard: 'Mode difficile', hardText: 'Tout le pays d’un coup : pas de régions, pas d’indices.', hardNote: 'À toi de trouver sa place.',
    more: 'Encore plus', quiz: 'Quiz éclair', quizText: 'Où est-ce ? Quel est le chef-lieu ?', atlas: 'Atlas', atlasText: 'Touche une province pour tout savoir.',
    book: 'Histoire et cultures', bookText: 'Des royaumes à la rumba.',
    drag: 'Glisse', dragTo: 'sur la carte', orTap: 'ou touche sa place', skip: 'Plus tard', hint: 'Indice',
    wrongOn: 'Ici, c’est', wrongOut: 'Pas tout à fait.', tryAgain: 'Essaie encore !', capital: 'Chef-lieu', speaks: 'On y parle', peoples: 'Peuples', area: 'Superficie',
    former: 'Ancienne province', borders: 'Voisins', next: 'Continuer', placed: 'Bien joué !', done: 'Région terminée !', doneAll: 'Tu connais tout le Congo !',
    quizNow: 'Petit quiz sur ces provinces', hub: 'Retour à la carte', nextRegion: 'Région suivante',
    find: 'Touche', whichCapital: 'quel est son chef-lieu ?', right: 'Exact !', itWas: 'C’était', here: 'ici', score: 'Ton score',
    history: 'Histoire', culture: 'Cultures', country: 'Le pays en chiffres', tapProvince: 'Touche une province.', credits: 'Image satellite',
    of: 'sur', km: 'km²', none: 'aucun',
  },
  en: {
    title: 'Mboka na biso', sub: 'The map of Congo', close: 'Close', back: 'Back',
    intro: 'Put every province back in its place and discover our country.',
    stamps: 'provinces discovered', regions: 'The regions', play: 'Play', again: 'Play again',
    all: 'The big challenge', allText: 'All 26 provinces, without the outlines.', allLocked: 'Finish hard mode or the 6 regions to open it.',
    hard: 'Hard mode', hardText: 'The whole country at once: no regions, no hints.', hardNote: 'Work out where it goes.',
    more: 'Even more', quiz: 'Quick quiz', quizText: 'Where is it? What is its capital?', atlas: 'Atlas', atlasText: 'Tap a province to learn all about it.',
    book: 'History and cultures', bookText: 'From kingdoms to rumba.',
    drag: 'Drag', dragTo: 'onto the map', orTap: 'or tap its place', skip: 'Later', hint: 'Hint',
    wrongOn: 'That is', wrongOut: 'Not quite.', tryAgain: 'Try again!', capital: 'Capital', speaks: 'People speak', peoples: 'Peoples', area: 'Area',
    former: 'Former province', borders: 'Neighbours', next: 'Continue', placed: 'Well done!', done: 'Region complete!', doneAll: 'You know all of Congo!',
    quizNow: 'Quick quiz on these provinces', hub: 'Back to the map', nextRegion: 'Next region',
    find: 'Tap', whichCapital: 'what is its capital?', right: 'Correct!', itWas: 'It was', here: 'here', score: 'Your score',
    history: 'History', culture: 'Cultures', country: 'The country in numbers', tapProvince: 'Tap a province.', credits: 'Satellite image',
    of: 'of', km: 'km²', none: 'none',
  },
} as const
type Strings = (typeof UI)[keyof typeof UI]
type Lang = keyof typeof UI

const ALL = REGIONS.flatMap((r) => r.provinces)
const regionOf = (id: string) => REGIONS.find((r) => r.provinces.includes(id))!
const shuffle = <T,>(list: readonly T[]) => {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}
const say = (p: { fr: string; en: string } | undefined, ui: Lang) => (p ? p[ui] || p.fr : '')

type Screen =
  | { name: 'hub' }
  | { name: 'puzzle'; level: string }
  | { name: 'quiz'; ids: string[] }
  | { name: 'atlas' }
  | { name: 'book' }

function MapGame() {
  const { ui } = useT()
  const s = UI[ui]
  const [screen, setScreen] = useState<Screen>({ name: 'hub' })
  const go = (next: Screen) => {
    sfx('whoosh')
    setScreen(next)
    scrollTo({ top: 0 })
  }
  return (
    <div className="mk" data-screen={screen.name}>
      <header className="mk-bar">
        {screen.name === 'hub' ? (
          <Link to="/home" className="mk-close" aria-label={s.close}><Icon name="close" /></Link>
        ) : (
          <button className="mk-close" aria-label={s.back} onClick={() => go({ name: 'hub' })}><Icon name="close" /></button>
        )}
        <span className="mk-title"><b>{s.title}</b><small>{s.sub}</small></span>
        <UiSwitch />
      </header>
      {screen.name === 'hub' && <Hub s={s} ui={ui} go={go} />}
      {screen.name === 'puzzle' && <Puzzle key={screen.level} level={screen.level} s={s} ui={ui} go={go} />}
      {screen.name === 'quiz' && <Quiz key={screen.ids.join()} ids={screen.ids} s={s} ui={ui} go={go} />}
      {screen.name === 'atlas' && <Atlas s={s} ui={ui} />}
      {screen.name === 'book' && <Book s={s} ui={ui} />}
      <p className="mk-credits">
        {SATELLITE && <>{s.credits} © <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noreferrer">Mapbox</a> © Maxar · </>}© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// The map itself
// ---------------------------------------------------------------------------------------------------------------------

type Tone = 'placed' | 'slot' | 'quiet' | 'hint' | 'right' | 'wrong' | 'open'
interface View { x: number; y: number; w: number; h: number }
const FULL: View = { x: 0, y: 0, w: MAP_VIEW.width, h: MAP_VIEW.height }

/** A window on the map that frames these provinces with some of their neighbours. */
function frame(ids: readonly string[]): View {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const id of ids) {
    const b = SHAPES[id]!.box
    x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3])
  }
  const side = Math.min(MAP_VIEW.width, Math.max(x1 - x0, y1 - y0) + 70)
  const x = Math.max(0, Math.min(MAP_VIEW.width - side, (x0 + x1) / 2 - side / 2))
  const y = Math.max(0, Math.min(MAP_VIEW.height - side, (y0 + y1) / 2 - side / 2))
  return { x, y, w: side, h: side }
}

function DrcMap({ view = FULL, tone, label, onPick, svgRef, outlines = true, children }: {
  view?: View
  tone: (id: string) => Tone
  label?: (id: string) => boolean
  onPick?: (id: string) => void
  svgRef?: React.Ref<SVGSVGElement>
  outlines?: boolean
  children?: ReactNode
}) {
  return (
    <svg ref={svgRef} className="mk-map" viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} data-outlines={outlines || undefined} style={{ '--u': view.w / 640, '--ar': view.w / view.h } as CSSProperties}>
      <defs>
        <mask id="mk-outside">
          <rect x="0" y="0" width={MAP_VIEW.width} height={MAP_VIEW.height} fill="#fff" />
          {ALL.map((id) => <path key={id} d={SHAPES[id]!.d} fill="#000" stroke="#000" strokeWidth="1.2" />)}
        </mask>
      </defs>
      <rect x="0" y="0" width={MAP_VIEW.width} height={MAP_VIEW.height} className="mk-sea" />
      {SATELLITE ? (
        <image href={SATELLITE} x="0" y="0" width={MAP_VIEW.width} height={MAP_VIEW.height} preserveAspectRatio="none" />
      ) : (
        <g className="mk-land">{ALL.map((id) => <path key={id} d={SHAPES[id]!.d} />)}</g>
      )}
      <rect x="0" y="0" width={MAP_VIEW.width} height={MAP_VIEW.height} className="mk-veil" mask="url(#mk-outside)" />
      <g className="mk-country" mask="url(#mk-outside)">{ALL.map((id) => <path key={id} d={SHAPES[id]!.d} />)}</g>
      {ALL.map((id) => (
        <path
          key={id}
          d={SHAPES[id]!.d}
          data-id={id}
          data-tone={tone(id)}
          className="mk-prov"
          style={{ '--c': regionOf(id).color } as CSSProperties}
          onClick={onPick && (() => onPick(id))}
        />
      ))}
      {label && ALL.filter(label).map((id) => (
        <text key={id} className="mk-label" x={SHAPES[id]!.c[0]} y={SHAPES[id]!.c[1]}>{PROVINCES[id]!.name}</text>
      ))}
      {children}
    </svg>
  )
}

/** Which province a point of the map (in map units) falls in. */
function provinceAt(svg: SVGSVGElement, x: number, y: number): string | null {
  const point = svg.createSVGPoint()
  point.x = x
  point.y = y
  for (const path of svg.querySelectorAll<SVGPathElement>('.mk-prov')) if (path.isPointInFill(point)) return path.dataset.id ?? null
  return null
}

function PieceArt({ id, className }: { id: string; className?: string }) {
  const b = SHAPES[id]!.box, pad = 3
  return (
    <svg className={className} viewBox={`${b[0] - pad} ${b[1] - pad} ${b[2] - b[0] + pad * 2} ${b[3] - b[1] + pad * 2}`} style={{ '--c': regionOf(id).color } as CSSProperties}>
      <path d={SHAPES[id]!.d} />
    </svg>
  )
}

function Stars({ n, big }: { n: number; big?: boolean }) {
  return <span className="mk-stars" data-big={big || undefined} aria-label={`${n}/3`}>{[0, 1, 2].map((i) => <i key={i} data-on={i < n || undefined}>★</i>)}</span>
}

function Fact({ p, s, ui, full }: { p: Province; s: Strings; ui: Lang; full?: boolean }) {
  return (
    <div className="mk-fact" style={{ '--c': regionOf(p.id).color } as CSSProperties}>
      <div className="mk-fact-head">
        <span className="mk-emoji">{p.emoji}</span>
        <div>
          <h2>{p.name}</h2>
          <p><span>{s.capital}</span> <b>{p.capital}</b></p>
        </div>
      </div>
      <p className="mk-fact-text">{say(p.fact, ui)}</p>
      <dl>
        <div><dt>{s.speaks}</dt><dd>{p.language[0]!.toUpperCase() + p.language.slice(1)}</dd></div>
        {full && <div><dt>{s.peoples}</dt><dd>{p.peoples.join(', ')}</dd></div>}
        {full && <div><dt>{s.area}</dt><dd>{p.area.toLocaleString(ui)} {s.km}</dd></div>}
        {full && <div><dt>{s.former}</dt><dd>{p.former}</dd></div>}
        {full && <div><dt>{s.borders}</dt><dd>{p.borders.length ? p.borders.join(', ') : s.none}</dd></div>}
      </dl>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// Hub
// ---------------------------------------------------------------------------------------------------------------------

function Hub({ s, ui, go }: { s: Strings; ui: Lang; go: (to: Screen) => void }) {
  const progress = useMapProgress()
  const regionsDone = REGIONS.filter((r) => progress.stars[r.id]).length
  const allOpen = regionsDone === REGIONS.length || Boolean(progress.stars.hard)
  const next = REGIONS.find((r) => !progress.stars[r.id])
  return (
    <main className="mk-hub">
      <section className="mk-hero">
        <div className="mk-hero-map">
          <DrcMap tone={(id) => (progress.stamps.includes(id) ? 'placed' : 'slot')} />
        </div>
        <div className="mk-hero-text">
          <div className="mk-speech">
            <Loba mood="wave" className="mk-loba" />
            <p>{s.intro}</p>
          </div>
          <div className="mk-passport">
            <b>{progress.stamps.length}<small> / {ALL.length}</small></b>
            <span>{s.stamps}</span>
            <div className="mk-meter"><i style={{ width: `${(progress.stamps.length / ALL.length) * 100}%` }} /></div>
          </div>
          {next && <button className="btn green block" onClick={() => go({ name: 'puzzle', level: next.id })}>{s.play} · {say(next.name, ui)}</button>}
        </div>
      </section>

      <h2 className="mk-h">{s.regions}</h2>
      <div className="mk-grid">
        {REGIONS.map((r, i) => (
          <button key={r.id} className="mk-card" style={{ '--c': r.color } as CSSProperties} data-next={r.id === next?.id || undefined} onClick={() => go({ name: 'puzzle', level: r.id })}>
            <span className="mk-card-art">{r.provinces.slice(0, 3).map((id) => <PieceArt key={id} id={id} />)}</span>
            <span className="mk-card-body">
              <small>{i + 1} · {r.provinces.length} provinces</small>
              <b>{say(r.name, ui)}</b>
              <Stars n={progress.stars[r.id] ?? 0} />
            </span>
          </button>
        ))}
        <button className="mk-card" style={{ '--c': 'var(--red)' } as CSSProperties} onClick={() => go({ name: 'puzzle', level: 'hard' })}>
          <span className="mk-card-art"><span className="mk-big-emoji">🔥</span></span>
          <span className="mk-card-body">
            <small>26 provinces</small>
            <b>{s.hard}</b>
            {progress.stars.hard ? <Stars n={progress.stars.hard} /> : <em>{s.hardText}</em>}
          </span>
        </button>
        <button className="mk-card mk-card-all" disabled={!allOpen} onClick={() => go({ name: 'puzzle', level: 'all' })}>
          <span className="mk-card-art"><span className="mk-big-emoji">{allOpen ? '🏆' : '🔒'}</span></span>
          <span className="mk-card-body">
            <small>26 provinces</small>
            <b>{s.all}</b>
            {allOpen ? <Stars n={progress.stars.all ?? 0} /> : <em>{s.allLocked}</em>}
          </span>
        </button>
      </div>

      <h2 className="mk-h">{s.more}</h2>
      <div className="mk-grid">
        <button className="mk-card" style={{ '--c': 'var(--plum)' } as CSSProperties} onClick={() => go({ name: 'quiz', ids: shuffle(progress.stamps.length >= 4 ? progress.stamps : ALL).slice(0, 8) })}>
          <span className="mk-card-art"><span className="mk-big-emoji">⚡</span></span>
          <span className="mk-card-body"><b>{s.quiz}</b><em>{s.quizText}</em></span>
        </button>
        <button className="mk-card" style={{ '--c': 'var(--green)' } as CSSProperties} onClick={() => go({ name: 'atlas' })}>
          <span className="mk-card-art"><span className="mk-big-emoji">🧭</span></span>
          <span className="mk-card-body"><b>{s.atlas}</b><em>{s.atlasText}</em></span>
        </button>
        <button className="mk-card" style={{ '--c': 'var(--sun-shade)' } as CSSProperties} onClick={() => go({ name: 'book' })}>
          <span className="mk-card-art"><span className="mk-big-emoji">📜</span></span>
          <span className="mk-card-body"><b>{s.book}</b><em>{s.bookText}</em></span>
        </button>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// Puzzle: drag each province to its place
// ---------------------------------------------------------------------------------------------------------------------

function Puzzle({ level, s, ui, go }: { level: string; s: Strings; ui: Lang; go: (to: Screen) => void }) {
  const region: Region | undefined = REGIONS.find((r) => r.id === level)
  const ids = region ? region.provinces : ALL
  const view = useMemo(() => (region ? frame(ids) : FULL), [level])
  const [queue, setQueue] = useState(() => shuffle(ids))
  const [placed, setPlaced] = useState<string[]>([])
  const [misses, setMisses] = useState<Record<string, number>>({})
  const [note, setNote] = useState<string | null>(null)
  const [reveal, setReveal] = useState<string | null>(null)
  const [wrong, setWrong] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [xp, setXp] = useState<number | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const ghost = useRef<HTMLDivElement>(null)
  const grip = useRef({ scale: 1, lift: 0 })
  const current = queue[0]
  const totalMisses = Object.values(misses).reduce((a, b) => a + b, 0)
  const stars = totalMisses <= 1 ? 3 : totalMisses <= ids.length ? 2 : 1
  const hard = level === 'hard'
  // Hard mode gives no written hint, and the place only glows after three misses.
  const hinted = current !== undefined && (misses[current] ?? 0) >= (region ? 2 : 3)
  const finished = placed.length === ids.length && !reveal

  useEffect(() => {
    if (!finished || xp !== null) return
    saveMap((p) => ({ ...p, stars: { ...p.stars, [level]: Math.max(p.stars[level] ?? 0, stars) } }))
    setXp(actions.completeSession({ kind: 'practice', mistakes: totalMisses, bestCombo: ids.length }).xp)
    sfx('complete')
    confetti()
  }, [finished])

  const attempt = (id: string, on: string | null) => {
    setDragging(false)
    if (on === id) {
      sfx('correct', placed.length + 1)
      setPlaced((p) => [...p, id])
      setQueue((q) => q.filter((x) => x !== id))
      setNote(null)
      setWrong(null)
      setReveal(id)
      saveMap((p) => (p.stamps.includes(id) ? p : { ...p, stamps: [...p.stamps, id] }))
      return
    }
    sfx('tick') // a miss is a clue, not a failure: no buzzer
    setMisses((m) => ({ ...m, [id]: (m[id] ?? 0) + 1 }))
    // Naming the place they chose turns a miss into something learned.
    setNote(on && on !== id ? `${s.wrongOn} ${PROVINCES[on]!.name}. ${s.tryAgain}` : `${s.wrongOut} ${s.tryAgain}`)
    setWrong(on)
    setTimeout(() => setWrong(null), 900)
  }

  // Dragging: the piece follows the finger at the map's own scale, a little above it so the finger doesn't hide it.
  const place = (e: ReactPointerEvent) => {
    const el = ghost.current, shape = current && SHAPES[current]
    if (!el || !shape) return
    const { scale, lift } = grip.current
    el.style.transform = `translate(${e.clientX - (shape.c[0] - shape.box[0] + 3) * scale}px, ${e.clientY - lift - (shape.c[1] - shape.box[1] + 3) * scale}px)`
  }
  const down = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!current || !svg.current || !ghost.current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = svg.current.getBoundingClientRect(), shape = SHAPES[current]!
    grip.current = { scale: rect.width / view.w, lift: e.pointerType === 'mouse' ? 0 : 54 }
    ghost.current.style.width = `${(shape.box[2] - shape.box[0] + 6) * grip.current.scale}px`
    ghost.current.hidden = false
    place(e)
    setDragging(true)
    setNote(null)
    sfx('pop')
  }
  const up = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragging || !current || !svg.current || !ghost.current) return
    ghost.current.hidden = true
    const rect = svg.current.getBoundingClientRect(), { scale, lift } = grip.current
    const x = view.x + (e.clientX - rect.left) / scale, y = view.y + (e.clientY - lift - rect.top) / scale
    const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY - lift >= rect.top && e.clientY - lift <= rect.bottom
    if (!inside) return setDragging(false) // let go outside the map: nothing happens
    const target = SHAPES[current]!
    // Small provinces get a generous landing zone: the centre only has to come close.
    const near = Math.hypot(x - target.c[0], y - target.c[1]) < Math.max(13, Math.sqrt(target.area) * 0.34)
    attempt(current, near ? current : provinceAt(svg.current, x, y))
  }

  const tone = (id: string): Tone =>
    placed.includes(id) ? 'placed' : id === wrong ? 'wrong' : id === current && hinted ? 'hint' : ids.includes(id) ? 'slot' : 'quiet'

  if (finished) {
    const nextRegion = region && REGIONS[REGIONS.indexOf(region) + 1]
    return (
      <main className="mk-play mk-done">
        <div className="mk-stage"><DrcMap view={view} tone={(id) => (ids.includes(id) ? 'placed' : 'quiet')} label={(id) => ids.includes(id) && ids.length <= 6} /></div>
        <div className="mk-panel">
          <Loba mood="cheer" className="mk-loba" />
          <Stars n={stars} big />
          <h1>{region ? s.done : s.doneAll}</h1>
          <p className="mk-xp">+{xp ?? 0} XP</p>
          <div className="mk-stamps">{ids.slice(0, 12).map((id) => <span key={id} title={PROVINCES[id]!.name}>{PROVINCES[id]!.emoji}</span>)}</div>
          <button className="btn sun block" onClick={() => go({ name: 'quiz', ids: shuffle(ids).slice(0, 6) })}>{s.quizNow}</button>
          {nextRegion && <button className="btn green block" onClick={() => go({ name: 'puzzle', level: nextRegion.id })}>{s.nextRegion} · {say(nextRegion.name, ui)}</button>}
          <button className="btn outline block" onClick={() => go({ name: 'hub' })}>{s.hub}</button>
        </div>
      </main>
    )
  }

  const p = current ? PROVINCES[current]! : null
  const shown = reveal ? PROVINCES[reveal]! : null
  return (
    <main className="mk-play">
      <div className="mk-stage">
        <div className="mk-progress">
          <span style={{ '--c': region?.color ?? 'var(--red)' } as CSSProperties}>{region ? say(region.name, ui) : hard ? s.hard : s.all}</span>
          <div className="mk-meter"><i style={{ width: `${(placed.length / ids.length) * 100}%` }} /></div>
          <b>{placed.length}/{ids.length}</b>
        </div>
        <DrcMap
          svgRef={svg}
          view={view}
          outlines={Boolean(region) || hard}
          tone={tone}
          label={(id) => placed.includes(id) && (Boolean(region) || id === reveal)}
          onPick={(id) => current && !reveal && !placed.includes(id) && attempt(current, id)}
        />
      </div>
      <div className="mk-panel">
        {shown ? (
          <div className="mk-reveal" key={shown.id}>
            <p className="mk-cheer">{s.placed}</p>
            <Fact p={shown} s={s} ui={ui} />
            <button className="btn green block" autoFocus onClick={() => { sfx('tap'); setReveal(null) }}>{s.next}</button>
          </div>
        ) : p && (
          <div className="mk-tray" key={p.id}>
            <button className="mk-piece" data-dragging={dragging || undefined} onPointerDown={down} onPointerMove={(e) => dragging && place(e)} onPointerUp={up} onPointerCancel={() => { setDragging(false); if (ghost.current) ghost.current.hidden = true }} aria-label={`${s.drag} ${p.name} ${s.dragTo}`}>
              <PieceArt id={p.id} />
            </button>
            <div className="mk-tray-text">
              <small>{s.drag}</small>
              <h2>{p.name}</h2>
              <small>{s.dragTo} · {s.orTap}</small>
              <p className="mk-hint-text" data-note={note ? true : undefined}>{note ?? (region ? say(p.hint, ui) : s.hardNote)}</p>
              {queue.length > 1 && <button className="mk-skip" onClick={() => { sfx('tap'); setNote(null); setQueue((q) => [...q.slice(1), q[0]!]) }}>{s.skip} ›</button>}
            </div>
          </div>
        )}
      </div>
      <div ref={ghost} className="mk-ghost" hidden>{current && <PieceArt id={current} />}</div>
    </main>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// Quiz: recall without the piece in hand
// ---------------------------------------------------------------------------------------------------------------------

interface Question { kind: 'find' | 'capital'; id: string; choices: string[] }

function Quiz({ ids, s, ui, go }: { ids: string[]; s: Strings; ui: Lang; go: (to: Screen) => void }) {
  const questions = useMemo<Question[]>(
    () =>
      ids.map((id, i) => ({
        kind: i % 2 === 0 ? 'find' : 'capital',
        id,
        choices: shuffle([id, ...shuffle(ALL.filter((x) => x !== id && PROVINCES[x]!.capital !== PROVINCES[id]!.capital)).slice(0, 3)]),
      })),
    [ids],
  )
  const [queue, setQueue] = useState(questions)
  const [answer, setAnswer] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [asked, setAsked] = useState(0)
  const retried = useRef(new Set<string>())
  const q = queue[0]

  useEffect(() => {
    if (q) return
    saveMap((p) => ({ ...p, quiz: Math.max(p.quiz, score) }))
    sfx('complete')
    if (score >= questions.length - 1) confetti()
  }, [q])

  if (!q) {
    return (
      <main className="mk-play mk-done">
        <div className="mk-panel">
          <Loba mood={score >= questions.length / 2 ? 'cheer' : 'happy'} className="mk-loba" />
          <h1>{s.score}</h1>
          <p className="mk-score">{score}<small> / {questions.length}</small></p>
          <button className="btn green block" onClick={() => go({ name: 'quiz', ids: shuffle(ALL).slice(0, 8) })}>{s.again}</button>
          <button className="btn outline block" onClick={() => go({ name: 'hub' })}>{s.hub}</button>
        </div>
      </main>
    )
  }

  const p = PROVINCES[q.id]!
  const pick = (id: string) => {
    if (answer) return
    const right = id === q.id
    sfx(right ? 'correct' : 'wrong', score + 1)
    setAnswer(id)
    if (right && !retried.current.has(q.id)) setScore((n) => n + 1)
  }
  const next = () => {
    sfx('tap')
    const missed = answer !== q.id
    setAsked((n) => n + (retried.current.has(q.id) ? 0 : 1))
    // A missed question comes back once at the end: a second try is where it sticks.
    setQueue((list) => (missed && !retried.current.has(q.id) ? [...list.slice(1), q] : list.slice(1)))
    if (missed) retried.current.add(q.id)
    setAnswer(null)
  }
  return (
    <main className="mk-play">
      <div className="mk-stage">
        <div className="mk-progress">
          <span style={{ '--c': 'var(--plum)' } as CSSProperties}>{s.quiz}</span>
          <div className="mk-meter"><i style={{ width: `${(asked / questions.length) * 100}%` }} /></div>
          <b>{Math.min(asked + 1, questions.length)}/{questions.length}</b>
        </div>
        <DrcMap
          tone={(id) => (answer ? (id === q.id ? 'right' : id === answer ? 'wrong' : 'open') : q.kind === 'capital' && id === q.id ? 'hint' : 'open')}
          label={(id) => Boolean(answer) && id === q.id}
          onPick={q.kind === 'find' ? pick : undefined}
        />
      </div>
      <div className="mk-panel">
        <div className="mk-question" key={q.id + q.kind}>
          {q.kind === 'find' ? <h2>{s.find} <em>{p.name}</em></h2> : <h2><em>{p.name}</em> : {s.whichCapital}</h2>}
          {q.kind === 'capital' && (
            <div className="mk-choices">
              {q.choices.map((id) => (
                <button key={id} disabled={Boolean(answer)} data-state={answer ? (id === q.id ? 'right' : id === answer ? 'wrong' : undefined) : undefined} onClick={() => pick(id)}>
                  {PROVINCES[id]!.capital}
                </button>
              ))}
            </div>
          )}
          {answer && (
            <div className="mk-feedback" data-right={answer === q.id || undefined}>
              <p><b>{answer === q.id ? s.right : `${s.itWas} ${q.kind === 'find' ? s.here : p.capital}.`}</b> {p.emoji} {say(p.fact, ui)}</p>
              <button className="btn green block" autoFocus onClick={next}>{s.next}</button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// Atlas and book
// ---------------------------------------------------------------------------------------------------------------------

function Atlas({ s, ui }: { s: Strings; ui: Lang }) {
  const [id, setId] = useState<string | null>(null)
  return (
    <main className="mk-play">
      <div className="mk-stage">
        <DrcMap tone={(x) => (x === id ? 'right' : 'placed')} label={(x) => x === id} onPick={(x) => { sfx('tile', ALL.indexOf(x)); setId(x) }} />
      </div>
      <div className="mk-panel">
        {id ? <Fact key={id} p={PROVINCES[id]!} s={s} ui={ui} full /> : (
          <div className="mk-speech"><Loba mood="think" className="mk-loba" /><p>{s.tapProvince}</p></div>
        )}
        <div className="mk-legend">
          {REGIONS.map((r) => <span key={r.id} style={{ '--c': r.color } as CSSProperties}>{say(r.name, ui)}</span>)}
        </div>
      </div>
    </main>
  )
}

function Book({ s, ui }: { s: Strings; ui: Lang }) {
  const [tab, setTab] = useState<'history' | 'culture' | 'country'>('history')
  return (
    <main className="mk-book">
      <div className="mk-tabs" role="tablist">
        {(['history', 'culture', 'country'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => { sfx('page', 1); setTab(t) }}>{s[t]}</button>
        ))}
      </div>
      {tab === 'history' && (
        <ol className="mk-timeline">
          {HISTORY.map((h) => (
            <li key={h.year + h.title.fr}>
              <span className="mk-year">{h.year}</span>
              <div><h3>{say(h.title, ui)}</h3><p>{say(h.text, ui)}</p></div>
            </li>
          ))}
        </ol>
      )}
      {tab === 'culture' && (
        <div className="mk-cards">
          {CULTURE.map((c) => (
            <article key={c.title.fr}><span className="mk-emoji">{c.emoji}</span><h3>{say(c.title, ui)}</h3><p>{say(c.text, ui)}</p></article>
          ))}
        </div>
      )}
      {tab === 'country' && (
        <div className="mk-cards mk-figures">
          {COUNTRY.map((c) => (
            <article key={c.title.fr}><span className="mk-emoji">{c.emoji}</span><h3>{say(c.title, ui)}</h3><p>{say(c.text, ui)}</p></article>
          ))}
        </div>
      )}
    </main>
  )
}
