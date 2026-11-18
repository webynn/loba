import { describe,it,expect } from 'vitest'
import { letters,makePuzzle,matches,selection } from './puzzle'
describe('word grid',()=>{
 it('preserves Lingala letters and removes spaces/punctuation',()=>{expect(letters('Mbɔ́te!')).toEqual(['M','B','Ɔ','T','E'])})
 it('places valid crossing words without overwriting letters',()=>{
 const words=['MAMA','MALAMU','MAI','MBOTE'].map(term=>({term,fr:term,en:term}))
 const p=makePuzzle(words,()=>0.5)
 expect(p.placed.length).toBe(4)
 for(const w of p.placed)expect(w.cells.map(i=>p.grid[i])).toEqual(letters(w.word.term))
 expect(new Set(p.placed.flatMap(w=>w.cells)).size).toBeLessThan(p.placed.reduce((n,w)=>n+w.cells.length,0))
 })
 it('accepts reversed straight selections and rejects bent selections',()=>{
 expect(selection(0,18,8)).toEqual([0,9,18]);expect(selection(0,19,8)).toEqual([])
 expect(matches([18,9,0],[0,9,18])).toBe(true);expect(matches([0,9],[0,9,18])).toBe(false)
 })
 it('handles empty and unsuitable words',()=>{expect(makePuzzle([{term:'a',fr:'a',en:'a'}]).placed).toEqual([])})
})
