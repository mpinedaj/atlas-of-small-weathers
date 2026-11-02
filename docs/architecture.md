# Architecture

The atlas is three layers with one contract between them. The weather layer
turns a place into numbers; the core turns numbers into a painting; schools
decide how that painting should feel. None of the three knows more about the
others than it needs to.

```
Open-Meteo ──► src/data ──► WeatherSnapshot ──► src/core ──► WebGL2 canvas
                    │                              ▲
                    └── cache, baseline,           │
                        gestures                   └── schools/* (palette, shaders, mapping)
```

## The contract

`src/core/types.ts` is the public vocabulary: `WeatherSnapshot`, `Palette`,
`GestureState`, `School` and `ShaderSet`. It imports nothing from the renderer,
the DOM or a concrete school. A school can be written, type-checked and tested
against that file alone.

Everything that crosses a layer boundary is normalised:

- weather values keep their human units (`°C`, `km/h`, `hPa`, `mm`);
- palette values are CSS hex strings;
- gestures are `0…1` or `-1…1`, with wind direction in radians and a screen-space
  unit vector;
- time is the place's wall clock, as Open-Meteo returns it, not a UTC instant.

## Weather layer (`src/data`)

| Module      | Responsibility                                                       |
| ----------- | -------------------------------------------------------------------- |
| `openMeteo` | URL builders, fetch with a 9 s timeout, pure response parsers        |
| `places`    | The default city and a small curated list for offline search         |
| `baseline`  | Seasonal expectation from latitude, elevation and day of year        |
| `wmo`       | WMO code → `Condition` and a plain description                       |
| `gestures`  | The default weather → gesture mapping, and palette context           |
| `cache`     | Namespaced memory + localStorage cache with per-entry TTL            |
| `geocoding` | City search with a 24 h cache and a curated fallback                 |
| `weather`   | Orchestration: fresh cache → network → stale cache → recorded sample |
| `fixtures`  | A recorded Open-Meteo response, parsed by the same code as live data |

### Failure order

1. A fresh cache entry (10 min) is returned without a request.
2. The network is asked. Success is written to both caches.
3. A stale cache entry is better than an invented sky, so it is used.
4. With nothing cached, the recorded Bogotá sample is painted and the interface
   says so in plain language.

An aborted request (the user typed another city) is never treated as a failure.
It is simply discarded, so a fast typist never sees the offline painting flash.

### The baseline is a sketch

`baselineTemperatureC` estimates the annual mean from latitude, subtracts
4.5 °C per kilometre of elevation, then adds a seasonal sinusoid whose amplitude
grows with latitude. The northern hemisphere peaks on 25 July; the southern
hemisphere peaks half a year later. It is not a climate model. It exists so that
18 °C can mean "warm for Reykjavík in February" and "cold for Lagos in July"
without a second network request. The approximation is deterministic, offline
safe and documented in code.

### Cache keys

Keys are `atlas:v1:<name>`. Weather is keyed by rounded coordinates and the
place slug, geocoding by the accent-free query. A schema change means a new
namespace, never a migration of unknown old data.

## Core and schools

The renderer is hand-written WebGL2: a ping-pong flow field, an instanced brush
draw and a final paper pass. Schools provide `school.json`, a palette function
and any subset of four shaders (`field`, `flow`, `brush`, `post`). They may
override individual gesture functions without replacing the whole mapping. The
core discovers schools from `schools/*` with `import.meta.glob`, validates their
metadata and refuses to boot a malformed one rather than painting something it
cannot explain.

### One frame

```
particles ──► flow shader ──► particle splat ──► projection ──► dye advection
                                                                     │
canvas ◄── post ◄── field ◄── brush splat ◄──────────────────────────┘
```

- **Velocity** is advected first. The school's `flow` shader then adds wind,
  curl, humidity and rain forces, and particles add local turbulence.
- **Projection** solves pressure with Jacobi iterations and subtracts the
  gradient, so the field stays divergence-free and the paint curls instead of
  exploding.
- **Dye** is advected along the field, then `brush` stamps add pigment. The dye
  buffer stores premultiplied colour and coverage.
- **Field** is the school's atmosphere. **Post** combines field and dye with
  paper fibre, grain, bloom and vignette.
- Particles are advanced entirely on the GPU with transform feedback. Their
  state never crosses into JavaScript.
- Shader slot bodies are statements inside `main()`. The core supplies
  `#version`, precision, uniforms, noise helpers and the signature.

### Determinism and tempo

Live mode advances the simulation by real elapsed time. `prefers-reduced-motion`
multiplies that by 0.34: the painting keeps breathing, slowly. `?still=1&warmup=N`
advances a fixed 1/60 s clock for N frames and draws once, which is what tests and
screenshots use. The same weather, seed and school produce the same frame.

### Falling back

WebGL2 with float colour buffers is the happy path. A missing context, a missing
extension or a shader that cannot compile at all hands the resolved scene to
`src/gl/fallback.ts`, a 2D canvas painter with the same palette, gestures and
seed. Individual school slots that fail to compile degrade to the house shader
instead of taking the whole page down.

## Interface (`src/ui`)

Plain DOM, no framework. The URL is the source of truth (`city`, `lat`, `lon`,
`school`, `seed`, `mode`), and every control writes back to it with
`history.replaceState`. The canvas carries a textual description for screen
readers. Debug controls (Tweakpane) are hidden behind a query parameter and are
never part of the published experience.

## Testing

- Pure logic (`baseline`, `wmo`, `cache`, parsers, gestures) is unit-tested with
  Vitest and recorded fixtures. No test touches the live API.
- The browser suite uses `?offline=1` so screenshots and assertions are
  deterministic. School screenshots are compared by eye and stored in
  `docs/screenshots`.
- CI runs lint, formatting, typecheck, unit tests, build and the Chromium suite
  on every pull request.
