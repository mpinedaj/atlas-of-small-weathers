# Status report — 2026-11-03

This report is a verified snapshot of the repository, not a plan. It was written
after reading `PROJECT_PLAN.md` in full and checking git, GitHub pull requests,
issues, milestones, tags, releases and CI directly. It supersedes
`docs/HANDOFF.md` wherever the two disagree.

## Phase

**Phase 1 — MVP**, milestone [`Phase 1 - MVP` (#1)](https://github.com/mpinedaj/atlas-of-small-weathers/milestone/1),
due 2026-12-15, target release `v0.1.0`.

Seven of the ten Phase 1 issues are closed. The three that remain are #7 (UI
shell and URL state), #8 (deterministic browser coverage) and #9 (docs and
release). No other milestone is open yet, which is correct: Phase 2 should not
start before `v0.1.0` ships.

## Repository state

- `main` is at `9cf8033` (`docs: add session handoff for Phase 1 (#27)`).
  The worktree is clean.
- The last completed CI run on `main` (`539d633`, the project plan) succeeded.
  The push run for `9cf8033` was still in progress when this report was written;
  PR #27 itself was green before the squash merge.
- There are **no tags and no GitHub releases**. `v0.1.0` has not been cut.
- Branch protection on `main` is **not enabled** (the API returns 404). The
  token lacks the `admin` scope. The PR-only rule is documented in
  `CONTRIBUTING.md` and followed manually.
- Merged remote branches still exist: `docs/art-direction`,
  `chore/project-setup`, `chore/ci-and-linting`, `feat/weather-data-layer`,
  `feat/gl-core-and-fluid`, `feat/school-registry-and-turner`,
  `feat/rothko-and-hokusai-schools`, `docs/project-plan` and `docs/handoff`.
  Deleting them is manual debt, not a functional risk.
- Local leftovers: `docs/handoff` and `docs/project-plan` (both merged).

## Delivered in Phase 1

Merged on `main`:

- Repository setup, MIT licence, README, issue and PR templates, Dependabot,
  contributing guide and code of conduct.
- CI on every pull request: ESLint, Prettier check, typecheck, Vitest, production
  build and Playwright on Chromium.
- Weather data layer: typed Open-Meteo client, pure parsers, WMO normalisation,
  latitude/elevation/day-of-year seasonal baseline, gesture mapping, versioned
  memory and localStorage cache with TTL, stale fallback and a recorded Bogotá
  offline sample.
- Hand-written WebGL2 engine: ping-pong fluid field, GPU brush particles, four
  school shader slots, adaptive quality, deterministic still mode and a 2D
  canvas fallback.
- School registry with `import.meta.glob` discovery, metadata and shader
  validation, and per-slot degradation.
- Three schools — Turner, Rothko and Hokusai — with distinct palettes, mappings
  and shaders.
- Accessible school selector with arrow/Home/End navigation, a paper-veil
  crossfade and `?school=` persistence.
- `docs/architecture.md`, `docs/decisions.md` (D1–D16), `docs/schools.md`,
  `docs/art-direction.md`, `docs/publishing.md` and the Phase 1 plan.

## In progress — issue #7

`feat: city search, shareable URL state and an accessible UI shell`

What is actually true:

- `src/ui/url.ts` exists and is committed. It defines `AtlasMode`, `UrlState`,
  `ShareState`, `readUrlState`, `urlWithParam`, `urlWithState`,
  `replaceUrlState`, `canonicalShareUrl` and `replaceSearchParam`.
  `mode=live|still` is canonical and `still=1` is a legacy alias.
- `src/main.ts` does **not** use that API yet. It reads `URLSearchParams` by
  hand, only writes `?school=`, and reads the seed once at boot.
- `src/data/geocoding.ts` exposes `searchPlaces` but not the source of a result.
  `src/data/weather.ts` falls back to the Bogotá sample unconditionally.
- There is no search combobox, seed stepper, share action, idle fade or
  per-place honest failure yet.

Nothing from #7 is usable by a visitor beyond the existing school selector.

## Not started

- **#8** — deterministic Playwright coverage for search, share, seed, idle fade,
  reduced motion and exact URL restoration; refreshed screenshots at 1440×900
  and 390×844.
- **#9** — README, CONTRIBUTING/CODE_OF_CONDUCT polish, mapping guide, Keep a
  Changelog entry for `v0.1.0`, gallery scaffold, good-first-issues list,
  annotated `v0.1.0` tag and GitHub release.

## Pull requests

| PR  | Change                          | State at audit                  |
| --- | ------------------------------- | ------------------------------- |
| 27  | `docs: add session handoff`     | **merged** (squash)             |
| 14  | `actions/checkout` 4 → 7        | green                           |
| 15  | `actions/setup-node` 4 → 7      | green                           |
| 16  | `actions/upload-artifact` 4 → 7 | green                           |
| 17  | `@types/node` 24 → 26           | green                           |
| 18  | `eslint` 9 → 10                 | green                           |
| 19  | `globals` 16 → 17               | green                           |
| 20  | `typescript` 5.9 → 7.0          | **red**                         |
| 21  | `@eslint/js` 9 → 10             | **red** (blocked by `eslint` 9) |

The two red Dependabot PRs fail during `npm ci`, before lint runs:

- **#20** installs `typescript@7.0.2`, but `typescript-eslint@8.72.1` does not
  accept TypeScript 7 as a peer. It needs an upstream release, not a code fix.
- **#21** installs `@eslint/js@10.0.1` while `eslint@9.39.5` is still pinned;
  `@eslint/js` 10 must move with `eslint` 10. After #18 lands it can be
  rebased; if it still conflicts, close it and let Dependabot regroup.

Triage order: merge #14–#19 one at a time, updating each branch against the new
`main` when GitHub asks. Then rebase #20 and reassess; close #21 if #18 has not
made it resolvable.

## Risks and technical debt

1. **`src/main.ts` is monolithic.** Boot markup, weather loading, renderer
   creation, school switching and URL writes share one file. Adding four
   controls without splitting it first would make the next change harder than
   this one.
2. **City changes can paint Bogotá.** `loadWeather` falls back to the offline
   fixture by default, which is right for the first paint and wrong after an
   explicit search. It needs `fallbackToSample?: boolean` and an honest failure
   state.
3. **No source information from geocoding.** The combobox cannot say whether it
   is showing live results, a cached list or curated offline suggestions until
   `searchPlaces` returns `{ places, source }`.
4. **The seed is static.** It is read once at boot; a stepper must rebuild the
   scene with the same place and school, keep the canvas, and restart the
   deterministic warm-up in still mode.
5. **No idle fade.** Header and footer never hide, contradicting the brief. The
   fade must stay visible while focus is inside, while a panel is open and under
   `prefers-reduced-motion`.
6. **Headless FPS is not the product target.** SwiftShader gives ~22 fps and
   triggers the adaptive tier after 90 frames. The real target is 60 fps on a
   GPU at the `high` tier (3400 particles).
7. **Large screenshots.** The Turner desktop PNG is ~1.1 MB. Acceptable for the
   repository, worth optimising before the release notes.
8. **CI action deprecations.** Node 22 is used, but `actions/*@v4` still emit
   Node 20 deprecation annotations. PRs #14–#16 are the fix.

## Next step

1. Merge the green Dependabot PRs (#14–#19), one at a time.
2. Rebase #20 after the runtime updates; close #21 if it cannot resolve once
   #18 is merged.
3. Create `feat/city-search-and-url-state` from `main` and implement #7:
   - add `fallbackToSample` and `{ places, source }`;
   - refactor `main.ts` around one view state and `readUrlState` /
     `replaceUrlState`;
   - add `src/ui/search.ts`, `seed.ts`, `share.ts`, `idle.ts`;
   - style the panel, stepper, share affordance and idle fade;
   - cover the new behaviour with unit and Playwright tests;
   - update architecture, decisions, CHANGELOG and open the PR with
     `Closes #7`.
4. Then #8 (deterministic e2e and screenshots) and #9 (README and `v0.1.0`).
