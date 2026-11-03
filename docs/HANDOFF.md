# Handoff

Written 2026-11-03 at the end of the Phase 1 push. This file is a snapshot, not a
plan of record; the plan is [`PROJECT_PLAN.md`](PROJECT_PLAN.md) and the running
decision log is [`decisions.md`](decisions.md).

## 1. Current phase and status

**Phase 1 — MVP (milestone “Phase 1 - MVP”, due 2026-12-15, target `v0.1.0`).**

Done and merged to `main` (`539d633`):

- Project setup, CI, ESLint/Prettier, husky + lint-staged + commitlint.
- Weather data layer: Open-Meteo client, pure parsers, WMO normalisation,
  seasonal baseline (latitude + elevation + day of year), gestures, versioned
  cache with TTL and offline Bogotá fixture.
- WebGL2 painting engine: ping-pong fluid, GPU brush particles, four shader
  slots, adaptive quality, deterministic still mode, 2D fallback.
- School registry with auto-discovery, schema validation and per-slot fallback.
- All three schools: `turner`, `rothko`, `hokusai`.
- Accessible school selector, paper-veil crossfade, `?school=` persistence,
  desktop and mobile screenshots for all three schools.
- Project plan document (PR #26).

In progress (issue **#7**, no branch yet):

- The canonical URL model already exists in `src/ui/url.ts` and is committed:
  `readUrlState`, `urlWithState`, `replaceUrlState`, `canonicalShareUrl`,
  `ShareState`, `AtlasMode`, with `mode=live|still` and `still=1` kept as an
  alias. It is **not yet wired into `src/main.ts`**, which still reads
  `URLSearchParams` by hand and only writes `?school=`.
- Still missing: city search combobox, seed stepper, share action, idle fade,
  live status region, honest failure when a city has no weather, per-place
  loading state.

Pending after #7:

- **#8** — deterministic Playwright coverage and refreshed visual screenshots.
- **#9** — README, CONTRIBUTING/CODE_OF_CONDUCT polish, CHANGELOG cut, `v0.1.0`
  tag and GitHub release. No tags exist yet.

## 2. Branches and pull requests

Local branches: `main` (clean, at `539d633`, tracking `origin/main`) and
`docs/project-plan` (already merged, still checked out as a leftover).

Remote branches:

- Merged but not deleted: `docs/art-direction`, `chore/project-setup`,
  `chore/ci-and-linting`, `feat/weather-data-layer`, `feat/gl-core-and-fluid`,
  `feat/school-registry-and-turner`, `feat/rothko-and-hokusai-schools`,
  `docs/project-plan`.
- Active: `main`.
- Dependabot: `dependabot/github_actions/actions/checkout-7`,
  `.../setup-node-7`, `.../upload-artifact-7`,
  `dependabot/npm_and_yarn/eslint-10.14.0`, `.../eslint/js-10.0.1`,
  `.../globals-17.13.0`, `.../types/node-26.6.6`, `.../typescript-7.0.2`.

Open PRs (all Dependabot, all currently open):

| PR  | Change                          | CI                      |
| --- | ------------------------------- | ----------------------- |
| 14  | `actions/checkout` 4 → 7        | green                   |
| 15  | `actions/setup-node` 4 → 7      | green                   |
| 16  | `actions/upload-artifact` 4 → 7 | green                   |
| 17  | `@types/node` 24 → 26           | green                   |
| 18  | `eslint` 9 → 10                 | green                   |
| 19  | `globals` 16 → 17               | green                   |
| 20  | `typescript` 5.9 → 7.0          | **failing** (both jobs) |
| 21  | `@eslint/js` 9 → 10             | **failing** (both jobs) |

Triage order: merge 14–19 one at a time (each is green against current `main`),
then rebase 20 and 21 on the new `main` and reassess. TypeScript 7 is a major
upgrade and will need code changes; `@eslint/js` 10 must move together with
`eslint` 10 and `typescript-eslint`, so it may be simpler to close #21 and let
Dependabot re-open a grouped update after #18 lands.

## 3. Decisions not yet in `docs/decisions.md`

These were taken during the Phase 1 work but are only implicit in code or PR
text:

- **`mode=live|still` is the canonical URL parameter; `still=1` is a legacy
  alias.** Old screenshot commands and links keep working, and the alias is
  removed when the URL is rewritten. Share URLs always write `mode`.
- **Share URLs are clean.** The copied link keeps only `city`, `lat`, `lon`,
  `school`, `seed` and `mode`; `offline`, `warmup` and debug switches are
  stripped so a recipient gets the live painting rather than the fixture. The
  live address bar keeps test switches intact.
- **The address bar is the only save file.** Controls use
  `history.replaceState`, never push, so Back leaves the atlas instead of
  stepping through schools and seeds.
- **Coordinates are written with four decimals.** Enough to keep the geocoder
  round-trip stable and small enough to read.
- **Remote merged branches are not swept automatically.** Repository hygiene
  (deleting them) is manual debt; branch protection could not be enabled with
  the available token scope and is documented in `CONTRIBUTING.md` instead.
- **`docs/HANDOFF.md` is a point-in-time file, not maintained per PR.** It may
  be deleted or rewritten once #9 ships; `docs/status-report.md` is the place
  for the next audit.

## 4. Known problems and technical debt

- **`src/main.ts` is monolithic.** Boot markup, weather loading, scene creation,
  selector wiring and URL writes live in one file. #7 needs it split into
  `src/ui/search.ts`, `seed.ts`, `share.ts` and `idle.ts` with a small mutable
  view state (`place`, `seed`, `school`, `scene`, `result`). Do this refactor
  before adding controls, not after.
- **City changes can currently paint the Bogotá fixture.** `loadWeather` falls
  back to the offline sample by default, which is right for the first paint but
  wrong after a search. Add `fallbackToSample?: boolean` (default `true`) and
  fail honestly for an explicit place change. Likewise `searchPlaces` should
  expose its source (`live` / `cache` / `offline`) so the combobox can say when
  it is showing curated suggestions.
- **No search UI at all yet.** `src/data/geocoding.ts` has debounce-free
  `searchPlaces` and `offlinePlaces`; the combobox, listbox, loading/empty/error
  states and keyboard behaviour still have to be written.
- **Seed is read once at boot** and rendered as static text. The planned stepper
  (`−` / `+`) must rebuild the scene with the same place and school while
  keeping the canvas and restarting still-mode warm-up.
- **Idle fade does not exist.** Header and footer are permanently visible, which
  contradicts the brief’s “controls fade after idle”. Keep them visible while
  focus is inside, while a panel is open, and under reduced motion.
- **Branch protection on `main` is not enabled** (token lacks `admin`). The
  PR-only rule is documented and followed manually.
- **CI runs on Node 22; `actions/*@v4` produce Node 20 deprecation annotations.**
  Harmless today, but the v7 action bumps are the fix.
- **Headless FPS is misleading.** SwiftShader gives ~22 fps and triggers the
  adaptive quality tier after 90 frames; the real-GPU target remains 60 fps with
  the `high` tier (3400 particles). Keep this in mind when interpreting e2e
  screenshots.
- **Merged remote branches linger** (see §2); delete them with
  `gh api -X DELETE repos/mpinedaj/atlas-of-small-weathers/git/refs/heads/<name>`
  once the current phase is closed.
- **Screenshots are large PNGs** (Turner desktop is ~1.1 MB). Acceptable for the
  repo, but consider optimising before the release notes.

## 5. Next concrete step

1. Create `feat/city-search-and-url-state` from `main`.
2. `src/data/weather.ts`: add `fallbackToSample?: boolean` and a test that a
   non-default place does not silently become Bogotá; `src/data/geocoding.ts`:
   return `{ places, source }`.
3. Refactor `src/main.ts` around a single view state and wire the existing
   `src/ui/url.ts` API (`readUrlState` on boot, `replaceUrlState` on every
   control change, `canonicalShareUrl` for Share).
4. Add `src/ui/search.ts` (accessible combobox, 250 ms debounce, Arrow keys,
   Enter, Escape, loading/empty/error), `src/ui/seed.ts` (stepper), `src/ui/share.ts`
   (clipboard + calm confirmation) and `src/ui/idle.ts` (fade, focus aware).
5. Style the panel, stepper, share affordance and idle fade in
   `src/styles/atlas.css` / `tokens.css`; verify 1440×900, 390×844 and 320×568.
6. Extend `tests/unit/url.test.ts` and add unit tests for search/seed; add
   Playwright coverage for combobox keyboard use, clipboard share, seed step,
   idle fade and exact URL restoration.
7. Update `docs/architecture.md`, `docs/decisions.md` (promote §3 above) and
   `CHANGELOG.md`; run lint, typecheck, format, unit, build, e2e; capture and
   inspect screenshots; open the PR with `Closes #7`.
8. Then #8 (e2e + screenshots) and #9 (README + `v0.1.0` release). Before the
   release, run the audit the next session was asked for: read
   `docs/PROJECT_PLAN.md` in full, verify git/PRs/issues/milestones/tags/CI, and
   write `docs/status-report.md` from what is actually true rather than from
   this file.
