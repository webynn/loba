// The content of the map game. Everything comes from data/drc-map.json, the one file shared by the website,
// the public API (GET /api/v1/map) and the iOS app. Correct facts there, nowhere else.
import raw from '../../../data/drc-map.json'

export interface Text { fr: string; en: string }
export interface Province {
  id: string; name: string; capital: string; former: string; language: string; peoples: string[]
  area: number; borders: string[]; emoji: string; fact: Text; hint: Text
}
export interface Region { id: string; name: Text; color: string; provinces: string[] }
export interface Card { emoji?: string; year?: string; title: Text; text: Text }
export interface Shape { d: string; c: [number, number]; area: number; box: [number, number, number, number] }

export const REGIONS: Region[] = raw.regions.map((r) => ({ ...r, color: `#${r.color}` }))
export const PROVINCES: Record<string, Province> = Object.fromEntries(raw.provinces.map((p) => [p.id, p]))
export const HISTORY: Card[] = raw.history
export const CULTURE: Card[] = raw.culture
export const COUNTRY: Card[] = raw.figures

/** Province outlines, projected to Web Mercator so they sit exactly on the Mapbox image of the same view.
 *  From geoBoundaries (gbOpen COD ADM1, 2017), boundaries © OpenStreetMap contributors, ODbL 1.0. */
export const SHAPES: Record<string, Shape> = Object.fromEntries(
  raw.provinces.map((p) => [p.id, { d: p.d, c: p.c as [number, number], area: p.shapeArea, box: p.box as [number, number, number, number] }]),
)
export const MAP_VIEW = { width: raw.view.width, height: raw.view.height, center: [raw.view.lon, raw.view.lat], zoom: raw.view.zoom } as const
