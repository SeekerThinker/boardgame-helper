# Table OS release gate matrix

Table OS is treated as a compatibility layer on top of the existing timer/scoring application. A change is not considered releasable unless the existing app and the Table OS layer both pass their gates.

| Gate | Coverage |
| --- | --- |
| Node unit tests | roster sync, participant bounds, built-in templates, privacy-safe My Templates snapshots/apply, template-safe campaign persistence, tracker scopes/clamps, session-vs-campaign tracker persistence, phase cycles, team/role reference cleanup, safe formula parsing, score calculations, campaign persistence, serialization/normalization |
| Existing Chromium E2E | bilingual setup, accessibility, timer/scoring flow, history/rematch, tools, settings, offline reload, narrow mobile widths and tablet layout |
| Table OS Chromium E2E | default Play mode, purpose-first quick start, Edit mode, roster sync, universal trackers, phase engine, toolbox-team bridge, two-stage private role reveal, moderator-note isolation, formula score sheet, campaign tracker lifetime, campaign reload persistence, campaign survival across built-in/My Template changes, local My Templates save/rename/apply/delete with transient/private-data exclusion, dynamic bilingual UI |
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
- Applying a setup template must not erase or silently disable persistent campaign metadata, notes or checkpoints.
- My Templates must remain local-only structural snapshots: no participants, team membership, roles/factions/moderator notes, live tracker/score values or campaign content may be copied into them.
- Play mode must not expose template selectors, score formula configuration or roster edit fields.
- Advanced configuration must remain reachable in one action through Edit mode.
- Existing basic timer/scoring flows must remain unchanged by Table OS work.

The production Android signing key, Apple distribution identity/profile and store-console metadata remain external release prerequisites and are not fabricated by CI.

### Status toggle lifecycle

- Unit: normalization from older schema, entity validation/pruning, shelf limit, default restoration on new scenario, localized built-in statuses.
- Unit: My Templates preserve status definitions but exclude live values and participant identifiers.
- Chromium: Card Battle Poisoned/Stunned toggles, Hidden Roles Alive default, new-scenario reset, custom global status, template privacy/fresh apply, and same-session reload persistence.
