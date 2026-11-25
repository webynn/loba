import { useMemo, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useUnits } from '../../hooks'
import { useT } from '../../i18n/useT'
import { Loba } from '../../components/Loba'
import { sfx } from '../../audio/sfx'
import { makePuzzle, matches, selection } from '../../game/puzzle'
import type { Unit, Word } from '../../content/types'
import '../../puzzle.css'
export const Route = createFileRoute('/_tabs/practice_/puzzle')({component: PuzzleHub})
function PuzzleHub() {
 const units=useUnits(), {ui,unitTitle}=useT(), en=ui==='en'
 const [unit,setUnit]=useState<Unit|null>(null)
 const [scores,setScores]=useState<Record<string,boolean>>(()=>{try{return JSON.parse(localStorage.getItem('loba-web-puzzles')||'{}')}catch{return {}}})
 return <section className="puzzle-page"><header className="puzzle-top"><nav aria-label={en?'Breadcrumb':'Fil d’Ariane'}><Link to="/practice" className="puzzle-control">{en?'Practice':'Pratique'}</Link><span aria-hidden="true"> / </span><span>{en?'Word hunt':'Mots mêlés'}</span></nav><span>⭐ {units.filter(u=>scores[u.id]).length} / {units.length}</span></header>
 {unit ? <Puzzle key={unit.id} unit={unit} back={()=>setUnit(null)} complete={()=>{const next={...scores,[unit.id]:true};setScores(next);try{localStorage.setItem('loba-web-puzzles',JSON.stringify(next))}catch{/* storage unavailable */}}}/> : <>
 <div className="puzzle-hero"><Loba mood="wave"/><div><span className="puzzle-kicker">CONGOLINGO · {en?'PLAY & LEARN':'JOUE & APPRENDS'}</span><h1>{en?'Word hunt':'Mots mêlés'}</h1><p>{en?'Follow the letters. Discover the words of your language.':'Suis les lettres. Découvre les mots de ta langue.'}</p></div></div>
 <div className="puzzle-band"/><div className="puzzle-lessons">{units.map((u,i)=><button className="tile-card" key={u.id} onClick={()=>{sfx('tap');setUnit(u)}}><span className="icon-tile">{u.icon}</span><span className="body"><small>{en?'PUZZLE':'GRILLE'} {i+1}</small><h3>{unitTitle(u)}</h3><p>{scores[u.id]?(en?'Completed — play again':'Terminée — rejouer'):(en?'Find the hidden words':'Trouve les mots cachés')}</p></span><span>{scores[u.id]?'⭐':'▶'}</span></button>)}</div>
 </>}</section>
}
function Puzzle({unit,back,complete}:{unit:Unit;back:()=>void;complete:()=>void}) {
 const {ui,meaning,unitTitle}=useT(), en=ui==='en'
 const puzzle=useMemo(()=>makePuzzle(unit.words),[unit])
 const [found,setFound]=useState<number[]>([]),[path,setPath]=useState<number[]>([]),[start,setStart]=useState<number|null>(null),[reveal,setReveal]=useState<Word|null>(null),[message,setMessage]=useState('')
 const drag=useRef<number|null>(null), end=useRef<number|null>(null)
 const done=found.length===puzzle.placed.length && found.length>0
 function check(a:number,b:number){const cells=selection(a,b,puzzle.size);const index=puzzle.placed.findIndex(p=>matches(cells,p.cells));setPath([]);setStart(null)
 if(index>=0&&!found.includes(index)){const next=[...found,index];setFound(next);setReveal(puzzle.placed[index]!.word);setMessage(en?'Word found!':'Mot trouvé !');sfx(next.length===puzzle.placed.length?'complete':'correct');if(next.length===puzzle.placed.length)complete()}
 else {setMessage(en?'Try another line of letters.':'Essaie une autre ligne de lettres.');sfx('tap')}}
 function tap(i:number){if(done)return;if(start===null){setStart(i);setPath([i])}else check(start,i)}
 return <><button className="puzzle-control" onClick={back}>‹ {en?'All puzzles':'Toutes les grilles'}</button><div className="puzzle-heading"><h1>{unitTitle(unit)}</h1><span>{found.length} / {puzzle.placed.length} ✨</span></div>
 <p>{en?'Drag across a word, or tap its first and last letters. Words can cross and run backwards.':'Glisse sur un mot, ou touche sa première puis sa dernière lettre. Les mots se croisent et peuvent être à l’envers.'}</p>
 <div className="puzzle-layout"><div className="puzzle-board" style={{gridTemplateColumns:`repeat(${puzzle.size},1fr)`}}
 onPointerMove={e=>{if(drag.current===null)return;const cell=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-cell]');if(cell&&e.currentTarget.contains(cell)){const i=Number(cell.dataset.cell);end.current=i;setPath(selection(drag.current,i,puzzle.size))}}}
 onPointerUp={()=>{const a=drag.current,b=end.current;drag.current=null;end.current=null;if(a!==null&&b!==null){if(a===b)tap(a);else check(a,b)}}}
 onPointerCancel={()=>{drag.current=null;end.current=null;setPath([]);setStart(null)}}>
 {puzzle.grid.map((letter,i)=><button key={i} data-cell={i} className={`puzzle-letter ${path.includes(i)?'selecting':''} ${found.some(n=>puzzle.placed[n]!.cells.includes(i))?'found':''}`} aria-label={`${letter}, ${Math.floor(i/puzzle.size)+1}, ${i%puzzle.size+1}`} onPointerDown={e=>{if(done)return;e.preventDefault();e.currentTarget.parentElement!.setPointerCapture(e.pointerId);drag.current=i;end.current=i;setPath([i])}} onClick={e=>{if(e.detail===0)tap(i)}}>{letter}</button>)}
 </div><aside className="puzzle-side"><h2>{en?'Your word collection':'Ta collection de mots'}</h2><div className="puzzle-wordlist">{puzzle.placed.map((p,i)=><button key={i} className={found.includes(i)?'collected':''} onClick={()=>setReveal(p.word)}>{found.includes(i)?'✓ ':''}{p.word.term}</button>)}</div>
 {reveal&&<div className="puzzle-meaning"><h2>{reveal.term}</h2><p>{meaning(reveal)}</p>{reveal.example&&<blockquote>{reveal.example}</blockquote>}</div>}
 <p role="status">{message}</p>{done&&<div className="puzzle-finish"><Loba mood="cheer"/><h2>{en?'You found them all!':'Tu les as tous trouvés !'}</h2><button className="puzzle-control" onClick={back}>{en?'Choose another puzzle':'Choisir une autre grille'}</button></div>}
 {!puzzle.placed.length&&<p>{en?'This lesson has no words suitable for a grid yet.':'Cette leçon n’a pas encore de mots adaptés à une grille.'}</p>}</aside></div></>
}
