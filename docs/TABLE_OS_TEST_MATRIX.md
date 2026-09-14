# Table OS release gate matrix

Table OS is treated as a compatibility layer on top of the existing timer/scoring application. A change is not considered releasable unless the existing app and the Table OS layer both pass their gates.

| Gate | Coverage |
| --- | --- |
| Node unit tests | roster sync, participant bounds, bulk roster parsing/cap safety, moderator batch assignment/privacy cleanup, built-in templates, privacy-safe My Templates snapshots/apply, template-safe campaign persistence, tracker scopes/clamps, session-vs-campaign tracker persistence, phase cycles/checklist lifecycle, team/role reference cleanup, safe formula parsing, score calculations, campaign persistence, serialization/normalization |
| Existing Chromium E2E | bilingual setup, accessibility, timer/scoring flow, history/rematch, tools, settings, offline reload, narrow mobile widths and tablet layout |
| Table OS Chromium E2E | default Play mode, purpose-first quick start, Edit mode, roster sync, bulk roster paste without main-roster mutation, ordered moderator assignment replacement, universal trackers, phase engine with active-phase checklist lifecycle, toolbox-team bridge, two-stage private role reveal, moderator-note isolation, formula score sheet, campaign tracker lifetime, campaign reload persistence, campaign survival across built-in/My Template changes, destructive template disclosure for entity reset, local My Templates save/rename/apply/delete with transient/private-data exclusion, dynamic bilingual UI |
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
- Any template application that resets Table Entities must explicitly disclose that destructive effect before confirmation.
- My Templates must remain local-only structural snapshots: no participants, team membership, roles/factions/moderator notes, live tracker/score values or campaign content may be copied into them.
- Normalization/import must drop Tracker/Status live values for entities that do not exist in the current participant/team roster; invisible stale IDs must never survive persistence or re-export.
- Play mode must not expose template selectors, score formula configuration or roster edit fields.
- Advanced configuration must remain reachable in one action through Edit mode.
- Switching Play/Edit mode must preserve the current module when that module exists in both modes; only unavailable Play sections may fall back to Overview.
- Existing basic timer/scoring flows must remain unchanged by Table OS work.
- ScoreSheet variable keys must remain formula-safe and unique; renaming a variable must migrate exact formula references so configuration edits cannot silently change scores.
- Score standings must respect the configured highest/lowest-total direction, use explicit shared ranks for ties, and never rank a participant whose included total depends on an invalid formula.
- ScoreSheet formulas must reject unknown variables and circular formula dependencies; invalid formulas must be visibly flagged instead of silently producing plausible totals.
- Removing a phase before the current live phase must preserve that active phase by identity; removing the active phase selects the nearest surviving phase without changing the cycle.

The production Android signing key, Apple distribution identity/profile and store-console metadata remain external release prerequisites and are not fabricated by CI.

### Status toggle lifecycle

- Unit: normalization from older schema, entity validation/pruning, shelf limit, default restoration on new scenario, localized built-in statuses.
- Unit: My Templates preserve status definitions but exclude live values and participant identifiers.
- Chromium: Card Battle Poisoned/Stunned toggles, Hidden Roles Alive default, new-scenario reset, custom global status, template privacy/fresh apply, and same-session reload persistence.

### Team replacement cleanup

- Unit: replacing the whole team roster creates fresh team identities, keeps only valid participant membership, and clears retired team-scoped Tracker/Status overrides before persistence/export.
- Chromium: adopting toolbox teams removes retired team IDs and hidden live values; replacement teams render the Tracker/Status defaults instead.

### Normalization stale-entity cleanup

- Unit: global / participant / team Tracker and Status maps preserve only entity IDs valid for their current scope.
- Unit: parse + serialize cannot retain retired participant/team IDs or values from an old scope.
- Chromium: reload normalization removes hidden retired team/player values from local persistence while keeping valid live values.

### Large-table roster setup

- Unit: mixed newline/comma/semicolon/tab paste parsing, blank-token trimming, assistant-only identity, and safe truncation at 32 participants.
- Chromium: Edit setup can paste several participants in one action, persists them locally as assistant-only participants, and leaves the main game roster unchanged.


### Phase checklist lifecycle

- Unit: checklist paste is bounded to 12 items per phase, sanitizes labels, and preserves matching same-cycle item identity/completion when the list is reordered.
- Unit: crossing a cycle boundary in either direction and New scenario / rematch clear live completion while preserving checklist structure.
- Unit/privacy: normalization accepts pre-checklist phase data; My Templates store checklist labels only, never live completion or item IDs, and apply with fresh IDs/default unchecked state.
- Chromium: Edit setup configures the active phase checklist, Play mode toggles it directly, same-cycle progress persists, and wrapping into a new cycle resets completion.

### Phase removal continuity

- Unit: deleting a phase before the active phase preserves the same active phase identity after indexes shift; deleting the active phase selects the next neighbor or previous phase when removing the last item.
- Chromium: deleting an earlier phase in Edit setup does not silently advance the live table to a different phase.


### Score variable rename safety

- Unit: duplicate 24-character keys terminate safely with a unique suffix; variable names are normalized to formula-safe identifiers.
- Unit: renaming a ScoreSheet variable rewrites exact formula references, resolves collisions deterministically, and preserves calculated results.
- Chromium: Edit setup can rename two variables to the same requested name; the UI shows unique keys, updates the formula text, and keeps the live calculated score unchanged.

### Score formula validation

- Unit: unknown identifiers are rejected instead of becoming zero; forward formula dependencies resolve deterministically; circular dependencies are detected and contribute zero rather than arbitrary iterative values.
- Chromium: a mistyped formula displays an explicit warning in the live score sheet, and correcting the formula clears the warning and restores the calculated value.


### Large-table moderator assignment

- Unit: ordered pasted assignments are bounded by the current participant roster and empty input is non-destructive.
- Unit/privacy: whole-list replacement clears retired moderator notes so old hidden context cannot attach to new characters or survive serialization/export.
- Chromium: Edit setup replaces a four-player identity/faction list in one action, keeps the existing two-stage reveal flow, and proves the retired moderator note is absent from persisted assignments and the player reveal DOM.

| Phase timer bridge | Configure an active phase duration, verify Play mode exposes an explicit load action, start the main timer, cancel replacement and verify it remains untouched, then accept replacement and verify `round` mode is prepared at the phase duration without auto-starting or erasing pool/chess values | Chromium E2E + unit |
| Phase timer template/privacy boundary | Normalize old phase data to `timerSeconds: 0`; bound duration to 0–86400; save/apply My Template duration only; verify no main-timer runtime fields enter My Templates and new-scenario reset preserves phase timer structure | Unit |


### Score standings semantics

- Unit: highest-total and lowest-total modes sort deterministically; equal totals use competition ranking (`1, 1, 3`) and expose tie state.
- Unit/correctness: an invalid formula only blocks ranking when it contributes to total; affected participants stay visible but unranked instead of receiving a plausible false position.
- Unit/template: ranking direction normalizes safely from older states and is reusable My Template structure without copying live scores.
- Chromium: Edit setup switches ranking direction, Play mode renders tied low-score leaders explicitly, and invalid included formulas remove misleading ranks until corrected.

### Play/Edit section continuity

- Chromium: switching from a live Phase surface into Edit setup keeps Phase selected and exposes its editor immediately; switching back to Play keeps the same Phase surface without an extra navigation tap.
- Fallback: sections that are intentionally hidden in Play mode may still return to Overview, so continuity never exposes empty/config-only modules.
