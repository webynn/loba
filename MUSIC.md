# Studio background music

The Music section in Studio controls the public shuffled playlist. Editors can preview each recording, edit its title/source credit/order, enable or disable it, and upload another audio file (maximum 15 MB). New uploads start disabled. There is no destructive delete button. Editors have the same authorization as other Studio features.

Seven audio-only AAC/M4A versions of the user's Desktop/lobasongs videos are seeded once into `studio_music`. The original videos also exist in the user's private Cloudflare R2 `lobasongs` bucket. That bucket is not made public or connected to playback: this implementation streams the smaller audio copies through the existing backend. Source links are retained as credits; they do not establish recording ownership or a license.

Conversion: 96 kbps stereo AAC, 44.1 kHz, loudness normalization to -20 LUFS / -2 dB peak, one-second fade-in, fast-start container. `data/music/catalog.json` supplies stable IDs. Startup records migration `background-music-v1`; subsequent deployments never reset an editor's changes.

API:
- GET `/api/v1/music`: enabled metadata only.
- GET/HEAD `/api/v1/music/:id`: enabled audio only, byte ranges, no-store so disabling a song removes future access.
- GET `/api/admin/music`: all tracks, authenticated Studio session.
- POST `/api/admin/music/upload`: binary audio, sniffed MIME, capped at 15 MB; disabled by default.
- PUT `/api/admin/music/:id`: title, credit, enabled, position; validated and same-origin protected.
- GET/HEAD `/api/admin/music/:id/audio`: authenticated preview including disabled tracks.

Learner web/iOS/Android use a separate persisted music toggle and a shuffled queue with no immediate repeat when multiple tracks exist. Volume is 16%. Web playback waits for a user gesture. Browsing scope, app foreground and teacher voice control playback; music does not play during lessons. Android retains its existing map/word-hunt music scope. Music never blocks loading or sign-in when unavailable. Catalog updates are fetched on re-entry/foreground (at most once per minute). Existing playback can finish a buffered track after an admin disables it; the next fetch removes it. No download/offline-music feature is implemented.

Native source changes are in the iOS `feature/phrasebook-cards` worktree and Android `android-app` worktree; they need updated app builds installed before phones use this API.
