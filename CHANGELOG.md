# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Nothing yet.

## [0.3.0] - 2026-11-04

### Added

- Frame mode: fullscreen painting with no chrome, wake lock and periodic refresh.
- Annual ring mode: a full year of daily temperatures rendered as a radial ring.

## [0.2.0] - 2026-11-04

### Added

- Slow blending of palette, gestures and condition over two minutes when a new reading
  arrives, instead of an instant swap.

## [0.1.0] - 2026-11-03

### Added

- Typed Open-Meteo client for current weather and geocoding, with pure parsers and a calm offline
  sample.
- Versioned memory and localStorage cache with per-endpoint lifetimes and stale fallbacks.
- Seasonal temperature baseline using latitude, elevation and day of year.
- WMO weather-code normalisation and the default weather-to-gesture mapping.
- Architecture guide and a visible offline state on the opening screen.
- Hand-written WebGL2 painting engine: GPU brush particles, a ping-pong fluid field, four shader
  slots for schools, adaptive quality and deterministic still mode.
- A 2D canvas painting and a poetic note when WebGL2 float targets are unavailable.
- Automatic school discovery from `schools/*`, with metadata, palette, mapping and shader
  validation that reports a malformed folder instead of painting it.
- The Turner school: a luminous horizon, a rain veil, a heavy upper cloud mass and long scumbled
  strokes, selectable with `?school=turner`.
- The Rothko school: three stacked, feathered colour fields that drift almost to stillness, with
  weather changing their temperature rather than their arrangement.
- The Hokusai school: flat ink blocks, a curling sea, fine wind lines and a deliberate woodblock
  misregistration.
- An accessible school selector in the header, with arrow, Home and End key movement, a visible
  pressed state and a paper-veil crossfade that preserves keyboard focus while the scene changes.
- `?school=` persistence when the school changes, so a shared URL restores the same hand.
- `docs/schools.md`, the complete authoring contract for palette, mapping and shader schools.
- City search combobox with curated offline fallback, keyboard navigation and an honest failure
  state that keeps the previous painting.
- Canonical URL state: `city`, `lat`, `lon`, `school`, `seed` and `mode` are read on boot and
  written with `history.replaceState`; `still=1` remains a legacy alias.
- Seed stepper that rebuilds the scene while keeping the canvas.
- Share action that copies a clean canonical URL without test switches or the hash.
- Idle fade for the header and footer, disabled under reduced motion and aware of focus and open
  panels.

## [0.0.0] - 2026-11-02

### Added

- Vite and strict TypeScript scaffold with a calm boot screen.
- Art direction, decision log, and publishing notes in `docs/`.
- ESLint, Prettier, commitlint, lint-staged and husky.
- Vitest unit tests and a Playwright boot smoke test.
- GitHub Actions for lint, typecheck, tests, build and end-to-end tests.
- Issue and pull request templates, Dependabot, contributing guide and code of conduct.

[Unreleased]: https://github.com/mpinedaj/atlas-of-small-weathers/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/mpinedaj/atlas-of-small-weathers/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/mpinedaj/atlas-of-small-weathers/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mpinedaj/atlas-of-small-weathers/compare/v0.0.0...v0.1.0
[0.0.0]: https://github.com/mpinedaj/atlas-of-small-weathers/releases/tag/v0.0.0
