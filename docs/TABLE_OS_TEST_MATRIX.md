# Table OS release gate matrix

Table OS is treated as a compatibility layer on top of the existing timer/scoring application. A change is not considered releasable unless the existing app and the Table OS layer both pass their gates.

| Gate | Coverage |
| --- | --- |
| Node unit tests | roster sync, participant bounds, templates, tracker scopes/clamps, phase cycles, team/role reference cleanup, safe formula parsing, score calculations, campaign persistence, serialization/normalization |
| Existing Chromium E2E | bilingual setup, accessibility, timer/scoring flow, history/rematch, tools, settings, offline reload, narrow mobile widths and tablet layout |
| Table OS Chromium E2E | launcher, roster sync, mechanism template, universal trackers, phase engine, team membership, private role reveal, formula score sheet, campaign persistence, dynamic bilingual UI |
| Subpath PWA E2E | `/boardgame-helper/` relative assets, manifest, scoped Service Worker, offline reload and privacy navigation |
| GitHub Pages smoke | deployed HTML, manifest, Service Worker, privacy page, main app JS and all Table OS runtime/style resources |
| Android | Capacitor sync, debug APK, release AAB and ephemeral release-signing injection smoke |
| iOS | Capacitor sync, Xcode project inspection and unsigned Simulator build |
| Store / RC | generated store assets plus unified release-candidate assembly and validation |

The production Android signing key, Apple distribution identity/profile and store-console metadata remain external release prerequisites and are not fabricated by CI.
