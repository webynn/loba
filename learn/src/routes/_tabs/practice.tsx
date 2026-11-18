import { createFileRoute, Link } from '@tanstack/react-router'
import { useSelector } from '@tanstack/react-store'
import { Art } from '../../components/Art'
import { Rail } from '../../components/Rail'
import { reviewWords, unlockedWords } from '../../game/rules'
import { game } from '../../game/store'
import { useNow, useUnits } from '../../hooks'
import { useT } from '../../i18n/useT'

export const Route = createFileRoute('/_tabs/practice')({ component: PracticePage })

function PracticePage() {
  const { t, ui } = useT()
  const units = useUnits()
  const now = useNow()
  const s = useSelector(game, (s) => s)
  const pool = unlockedWords(s, units)
  const due = reviewWords(s, s.lang, pool, now).length
  const seen = Object.keys(s.words).some((k) => k.startsWith(`${s.lang}:`))
  const listen = s.voice && pool.filter((w) => w.audio).length >= 4

  return (
    <div className="page">
      <div>
        <header className="page-head">
          <h1>{t('practiceTitle')}</h1>
          <p>{t('practiceIntro')}</p>
        </header>
        <div className="stack">
          <Link to="/session" search={{ mode: 'review' }} className="tile-card" disabled={!seen}>
            <span className="icon-tile" style={{ '--tint': 'var(--green-tint)' } as React.CSSProperties}><Art name="cards" /></span>
            <span className="body">
              <h3>{t('smartReview')}</h3>
              <p>{seen ? t('smartReviewText', { n: due }) : t('smartReviewNone')}</p>
            </span>
          </Link>
          <Link to="/session" search={{ mode: 'listen' }} className="tile-card" disabled={!listen}>
            <span className="icon-tile" style={{ '--tint': 'color-mix(in srgb, var(--plum) 16%, transparent)' } as React.CSSProperties}><Art name="headphones" /></span>
            <span className="body">
              <h3>{t('listening')}</h3>
              <p>{listen ? t('listeningText') : t('listeningUnavailable')}</p>
            </span>
          </Link>
          <Link to="/practice/puzzle" className="tile-card">
            <span className="icon-tile" style={{ '--tint': 'var(--sky-tint)' } as React.CSSProperties}><Art name="cards" /></span>
            <span className="body"><h3>{ui === 'en' ? 'Word hunt' : 'Mots mêlés'}</h3><p>{ui === 'en' ? 'Find crossing words and discover their meanings.' : 'Trouve les mots croisés dans la grille et découvre leur sens.'}</p></span>
          </Link>
          <Link to="/map" className="tile-card">
            <span className="icon-tile" style={{ '--tint': 'var(--sky-tint)', fontSize: 34 } as React.CSSProperties}>🗺️</span>
            <span className="body">
              <h3>{t('mapGame')}</h3>
              <p>{t('mapGameText')}</p>
            </span>
          </Link>
          <Link to="/story" className="tile-card">
            <span className="icon-tile" style={{ '--tint': 'var(--sun-tint)' } as React.CSSProperties}><Art name="book" /></span>
            <span className="body">
              <h3>{t('storyGame')}</h3>
              <p>{t('storyGameText')}</p>
            </span>
          </Link>
        </div>
      </div>
      <Rail />
    </div>
  )
}
