# Table OS release gate matrix

Table OS is treated as a compatibility layer on top of the existing timer/scoring application. A change is not considered releasable unless the existing app and the Table OS layer both pass their gates.

| Gate | Coverage |
| --- | --- |
| Node unit tests | roster sync, participant bounds, templates, tracker scopes/clamps, session-vs-campaign tracker persistence, phase cycles, team/role reference cleanup, safe formula parsing, score calculations, campaign persistence, serialization/normalization |
| Existing Chromium E2E | bilingual setup, accessibility, timer/scoring flow, history/rematch, tools, settings, offline reload, narrow mobile widths and tablet layout |
| Table OS Chromium E2E | default Play mode, purpose-first quick start, Edit mode, roster sync, universal trackers, phase engine, toolbox-team bridge, two-stage private role reveal, moderator-note isolation, formula score sheet, campaign tracker lifetime, campaign reload persistence, dynamic bilingual UI |
| Table OS responsive smoke | no horizontal overflow at 320px phone, 390px phone and tablet widths; Play/Edit mode controls remain usable |
| Subpath PWA E2E | `/boardgame-helper/` relative assets, manifest, scoped Service Worker, offline reload and privacy navigation |
| Store assets | five focused screenshots per device/locale: flow, scoring, Table OS live play, tools and results; generated dimensions and duplicate detection remain mandatory |
| GitHub Pages smoke | deployed HTML, manifest, Service Worker, privacy page, main app JS and all Table OS runtime/style resources |
| Android | Capacitor sync, debug APK, release AAB and ephemeral release-signing injection smoke |
| iOS | Capacitor sync, Xcode project inspection and unsigned Simulator build |
| Store / RC | generated store assets plus unified release-candidate assembly and validation |

## Product correctness gates

The following are release blockers rather than optional polish:

- Player private reveal must remain two-stage: hand-off screen first, explicit player reveal second.
- Moderator notes must not be rendered into the player reveal DOM.
- `campaign` trackers must survive New scenario / rematch; `session` trackers must reset to their initial values.
- Play mode must not expose template selectors, score formula configuration or roster edit fields.
- Advanced configuration must remain reachable in one action through Edit mode.
- Existing basic timer/scoring flows must remain unchanged by Table OS work.
- Initial main-session association is silent; a changed `startedAt` prompts without mutating Table OS state.
- Starting a detected new game explicitly resets session state and acknowledges the identity; continuing only acknowledges it.
- Rematch rosters with regenerated source IDs preserve unambiguous name-and-color participant matches and campaign tracker values.

The production Android signing key, Apple distribution identity/profile and store-console metadata remain external release prerequisites and are not fabricated by CI.
