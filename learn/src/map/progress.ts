import { useSyncExternalStore } from 'react'

/** What the learner has done on the map. Kept in this browser. */
export interface MapProgress {
  /** Best stars per level (a region id, or "all"). */
  stars: Record<string, number>
  /** Provinces placed at least once: the stamps in the passport. */
  stamps: string[]
  /** Best quiz score, out of the number of questions. */
  quiz: number
}

const KEY = 'loba-map-v1'
const fresh = (): MapProgress => ({ stars: {}, stamps: [], quiz: 0 })

function load(): MapProgress {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<MapProgress> | null
    if (raw && typeof raw === 'object') {
      return {
        stars: raw.stars && typeof raw.stars === 'object' ? raw.stars : {},
        stamps: Array.isArray(raw.stamps) ? raw.stamps.filter((s) => typeof s === 'string') : [],
        quiz: typeof raw.quiz === 'number' ? raw.quiz : 0,
      }
    }
  } catch {
    // Private mode or damaged data: start again.
  }
  return fresh()
}

let state = load()
const listeners = new Set<() => void>()

export function saveMap(change: (p: MapProgress) => MapProgress) {
  state = change(state)
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Storage blocked: progress lasts for this visit.
  }
  listeners.forEach((fn) => fn())
}

export const useMapProgress = () =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => state,
  )
