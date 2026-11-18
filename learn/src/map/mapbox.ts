import { MAP_VIEW } from './shapes'

/** A public Mapbox token (pk.…), given at build time as VITE_MAPBOX_TOKEN. Without it the map is drawn plain. */
const TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined)?.trim()

/** The Congo seen from space, in exactly the view the province outlines were projected to. */
export const SATELLITE = TOKEN
  ? `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${MAP_VIEW.center[0]},${MAP_VIEW.center[1]},${MAP_VIEW.zoom},0/${MAP_VIEW.width}x${MAP_VIEW.height}@2x?attribution=false&logo=false&access_token=${TOKEN}`
  : null
