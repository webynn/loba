# Loba learner portal

The redesigned `/learn` keeps the existing Lingala/Swahili engine, placement,
practice, stories, quests and progress key (`loba-state-v4`). The administration
portal is unchanged. The lesson engine still uses its bundled curriculum;
connecting it to Studio's published snapshots is separate backend work.

`learner.css` provides the responsive shell, lesson path, illustrated landscape,
exercise layouts and reduced-motion treatment. `learner.js` adds progress-aware
navigation, an XP goal card, local Lottie playback and a persistent sound toggle.
The original Web Audio cues now use softer sine tones. Sounds only follow user
interactions; speech pronunciation remains separately configurable.

Animations pause when hidden or off-screen; reduced-motion uses a still frame.
Disconnected renderers are destroyed. Failed animation loads retain emoji
fallbacks. Neither animation file makes external requests or contains image assets.

## Animation credits

- **Parrot**, Summer kc: https://lottiefiles.com/free-animation/parrot-ApC1HPHYZP
  Downloaded from LottieFiles, November 13, 2026. Lottie Simple License:
  https://lottiefiles.com/page/license
- **Success Checkmark with Confetti**, downloaded from the owner's LottieFiles
  Drafts: https://app.lottiefiles.com/animation/94568ffc-ca6c-4e5c-ae6d-b62250b52475
- **lottie-web 5.13.0**, MIT: https://github.com/airbnb/lottie-web
  The light SVG player is served locally from the pinned npm dependency.

No paid animation subscription or external animation CDN is required at runtime.
LottieFiles' Platform MCP endpoint is https://mcp.lottiefiles.com/mcp; this session
could not attach a new MCP server, so the signed-in browser download flow was used.

## Verification

`npm run check` and `npm test`. Database integration requires TEST_DATABASE_URL
and runs in GitHub Actions. Production static routes support both `/learn` and
`/learn/`. Static files stay explicitly allowlisted.
