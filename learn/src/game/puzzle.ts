import type { Word } from '../content/types'
export const letters = (term: string) => Array.from(term.normalize('NFC').toLocaleUpperCase().replace(/[^\p{L}]/gu, ''))
export type PlacedWord = { word: Word; cells: number[] }
export function makePuzzle(words: Word[], random = Math.random) {
  const candidates = words.map(word => ({ word, text: letters(word.term) })).filter(w => w.text.length >= 2 && w.text.length <= 12)
    .filter((w, i, all) => all.findIndex(x => x.text.join('') === w.text.join('')) === i).sort((a,b) => b.text.length-a.text.length).slice(0,8)
  const size = Math.max(8, ...candidates.map(w => w.text.length))
  const grid: string[] = Array(size*size).fill('')
  const placed: PlacedWord[] = []
  const directions = [[0,1],[1,0],[1,1],[-1,1],[0,-1],[-1,0],[-1,-1],[1,-1]]
  for (const {word,text} of candidates) {
    const options: {cells:number[];score:number}[] = []
    for(let r=0;r<size;r++) for(let c=0;c<size;c++) for(const [dr,dc] of directions) {
      const cells = text.map((_,i) => [r+dr!*i,c+dc!*i])
      if(cells.some(([y,x]) => y!<0 || x!<0 || y!>=size || x!>=size)) continue
      const ids = cells.map(([y,x]) => y!*size+x!)
      if(ids.some((id,i) => grid[id] && grid[id]!==text[i])) continue
      const overlap = ids.filter(id=>grid[id]).length
      if(overlap===text.length) continue
      options.push({cells:ids,score:overlap*10+random()})
    }
    options.sort((a,b)=>b.score-a.score)
    const best=options[0]; if(!best) continue
    best.cells.forEach((id,i)=>{grid[id]=text[i]!})
    placed.push({word,cells:best.cells})
  }
  const alphabet=Array.from(new Set([...Array.from('AEIOUBKLMNPSWY'),...candidates.flatMap(w=>w.text)]))
  return {size,placed,grid:grid.map(c=>c||alphabet[Math.floor(random()*alphabet.length)]!)}
}
export function selection(start:number,end:number,size:number): number[] {
  const r=Math.floor(start/size),c=start%size,dy=Math.floor(end/size)-r,dx=end%size-c
  if(dx && dy && Math.abs(dx)!==Math.abs(dy)) return []
  return Array.from({length:Math.max(Math.abs(dx),Math.abs(dy))+1},(_,i)=>(r+Math.sign(dy)*i)*size+c+Math.sign(dx)*i)
}
export function matches(a:number[],b:number[]) {return a.length===b.length && (a.every((v,i)=>v===b[i])||a.every((v,i)=>v===b[b.length-1-i]))}
