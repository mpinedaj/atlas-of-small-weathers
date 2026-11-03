# Schools

A school is a way of painting weather. It owns a palette, may nudge the
weather-to-gesture mapping, and may replace any of the four shader stages. The
core owns everything else: the fluid, the particles, the clock and the frame.

Adding a school means adding a folder. It never means editing `src/`.

## Folder contract

```
schools/
  turner/
    school.json          required — identity and provenance
    palette.ts           required — exports `palette(weather, context)`
    mapping.ts           optional — exports `mapping`, partial overrides
    shaders/
      field.frag         optional — background atmosphere
      flow.frag          optional — forces added to the velocity field
      brush.frag         optional — one pigment mark
      post.frag          optional — paper, grain, bloom, vignette
```

The folder name is the school id. It must be lowercase letters, digits and
hyphens, and it must match `school.json`'s `id`. Files that are absent fall back
to the house implementation, slot by slot.

Discovery is automatic. `src/schools/registry.ts` globs
`schools/*/{school.json,palette.ts,mapping.ts,shaders/*.frag}` at build time with
`import.meta.glob`. There is no list to update, no import to add and no core
change to forget.

## `school.json`

```json
{
  "id": "turner",
  "name": "Turner",
  "author": "Atlas of Small Weathers",
  "license": "MIT",
  "description": "Weather as weather: luminous horizons, storm masses and long scumbled strokes.",
  "references": ["J. M. W. Turner, Rain, Steam and Speed (1844)"],
  "version": "0.1.0"
}
```

| Field         | Rule                                                        |
| ------------- | ----------------------------------------------------------- |
| `id`          | 1–40 chars, lowercase letters/digits/hyphens, equals folder |
| `name`        | 1–60 chars, shown in the interface                          |
| `author`      | 1–80 chars                                                  |
| `license`     | 1–40 chars, an SPDX identifier where possible               |
| `description` | 1–280 chars, one or two sentences                           |
| `references`  | 1–6 non-empty strings; inspiration, never reproduction      |
| `version`     | semantic version, e.g. `0.1.0`                              |

Unknown keys are ignored, so a future field cannot break an older core. A
missing or invalid field excludes the school and is reported in the console; the
rest of the atlas still opens.

## `palette.ts`

```ts
import type { Palette, PaletteContext, WeatherSnapshot } from '../../src/core/types';

export function palette(weather: WeatherSnapshot, context: PaletteContext): Palette {
  // Choose pigment from the condition, then shift it with context.warmth,
  // context.cloud, context.rain and context.light as the school sees fit.
  return {
    ground: '#efe7d9', // paper
    ink: '#17140f', // darkest mark
    accent: '#a9472b', // one sparing note
    washes: ['#f8eccd', '#efd8a8', '#dfba79', '#c88e5d', '#9e654a', '#6c4a3e'],
    highlight: '#fff7e0',
    shadow: '#332a23',
  };
}
```

- Every colour is a six-digit CSS hex string, `#rrggbb`.
- `washes` is ordered light to dense; the renderer maps entries 0–5 to
  `uWash0`–`uWash5`. Keep six for a predictable result.
- `weather` is the complete reading. `context` is the compact, normalised view:
  `condition`, `isDay`, `warmth` (`-1…1` relative to the seasonal baseline),
  `humidity`, `cloud`, `pressure`, `rain` (all `0…1`) and `seed`.
- Palettes must be pure and deterministic. The same weather and seed must produce
  the same pigments, or screenshots stop meaning anything.

## `mapping.ts`

The default mapping is already opinionated; a school overrides only what it
hears differently.

```ts
import type { DataToGesture, WeatherSnapshot } from '../../src/core/types';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const mapping: Partial<DataToGesture> = {
  strokeLength: (weather: WeatherSnapshot) =>
    clamp01(0.28 + clamp01(weather.windSpeedKmh / 55) * 0.68),
};
```

Overridable keys: `warmth`, `windSpeed`, `windDirection`, `windVector`,
`tension`, `humidityVeil`, `cloudMass`, `pressureWeight`, `rainGrain`, `light`,
`strokeLength`. Every override is merged over `defaultMapping` in
`src/data/gestures.ts`. Returning a value outside its documented range is not a
crash, but it is a bug: shaders assume `0…1` or `-1…1`.

The contract the atlas is trying to keep:

| Weather     | Becomes                                |
| ----------- | -------------------------------------- |
| temperature | relative warmth; palette temperature   |
| wind        | speed, direction, long curling strokes |
| humidity    | veils and soft edges                   |
| cloud       | mass in the upper field                |
| pressure    | visual weight, low and heavy           |
| rain        | grain, runs and drip                   |

## Shaders

A shader file is a **body**, not a complete shader. The core prepends
`#version 300 es`, precision qualifiers, the uniform block, the shared helpers
and `void main() { ... }`, so the body contains statements only.

Rules:

- No `#version`, no `precision`, no `void main()`, no `fragColor` declaration.
- Write the result to `fragColor`. It is declared by the core.
- Use only the uniforms and varyings listed below, plus the shared helpers.
- Keep loops bounded by constants. Uniform-bounded loops are not portable.
- The body runs for every pixel, every frame. Prefer a few cheap octaves to many
  expensive ones.

### Uniforms available everywhere

| Uniform           | Type    | Meaning                                                 |
| ----------------- | ------- | ------------------------------------------------------- |
| `uTime`           | `float` | seconds since the scene started                         |
| `uResolution`     | `vec2`  | drawing-buffer size in pixels                           |
| `uSeed`           | `float` | integer seed as a float                                 |
| `uGround`         | `vec3`  | palette ground                                          |
| `uInk`            | `vec3`  | palette ink                                             |
| `uAccent`         | `vec3`  | palette accent                                          |
| `uHighlight`      | `vec3`  | palette highlight                                       |
| `uShadow`         | `vec3`  | palette shadow                                          |
| `uWash0`…`uWash5` | `vec3`  | palette washes, light to dense                          |
| `uCondition`      | `float` | clear 0, cloudy .2, fog .4, rain .62, snow .82, storm 1 |
| `uWarmth`         | `float` | `-1…1` relative warmth                                  |
| `uWindSpeed`      | `float` | `0…1`                                                   |
| `uWindVector`     | `vec2`  | screen-space direction the wind travels towards         |
| `uTension`        | `float` | `0…1`, tautness of the field                            |
| `uHumidity`       | `float` | `0…1`                                                   |
| `uCloud`          | `float` | `0…1`                                                   |
| `uPressure`       | `float` | `0…1`, heavier is higher                                |
| `uRain`           | `float` | `0…1`                                                   |
| `uLight`          | `float` | `0…1`                                                   |
| `uStrokeLength`   | `float` | `0…1`                                                   |

### Slots

| Slot    | Inputs beyond the common block                        | Output                           |
| ------- | ----------------------------------------------------- | -------------------------------- |
| `field` | `vUv`                                                 | atmosphere into `fragColor.rgb`  |
| `flow`  | `vUv`, `uVelocity`, `uDye`, `uTexel`                  | new velocity into `fragColor.rg` |
| `brush` | `vUv`, `vSeed`, `vAlpha`, `vSpeed`, `vAngle`, `vLife` | premultiplied pigment            |
| `post`  | `vUv`, `uField`, `uDye`                               | final canvas colour              |

- `field` draws what is behind the paint: sky, horizon, weather mass, light.
- `flow` reads the current velocity field and returns the next one. Add forces;
  do not integrate positions. The projection pass removes divergence afterwards.
- `brush` is one instanced quad, stretched along the particle's direction. `vUv`
  is the quad in `-1…1`, long in x and thin in y. `vAlpha` already carries the
  particle's life fade. Return **premultiplied** colour:
  `fragColor = vec4(colour * alpha, alpha);`. The default alpha scale is small
  (roughly `0.009`) because thousands of marks accumulate.
- `post` receives the field and the dye (premultiplied colour plus coverage in
  alpha). Composite them, then paper, grain, bloom and vignette.

### Shared helpers

`atlasHash11`, `atlasHash21`, `atlasNoise`, `atlasFbm`, `atlasCurl`, `atlasLuma`,
`atlasBloom`, `atlasPaper`, plus `ATLAS_PI`. They are declared once in
`src/gl/shaders/common.ts`; do not redefine them.

## A minimal school

```
schools/quiet/
  school.json
  palette.ts
  shaders/field.frag
```

`field.frag`:

```glsl
vec3 paper = mix(uGround, uWash0, 0.4);
float veil = atlasFbm(vUv * vec2(3.0, 4.0) + uSeed * 0.01);
vec3 colour = mix(paper, uWash3, veil * (0.2 + uCloud * 0.5));
float horizon = exp(-pow((vUv.y - 0.5) * 8.0, 2.0));
colour += uHighlight * horizon * uLight * 0.25;
fragColor = vec4(colour, 1.0);
```

Flow, brush and post are omitted, so those stages use the house shaders. The
school appears in the registry on the next dev-server reload, and can be opened
with `?school=quiet`.

## Failure behaviour

Discovery is deliberately forgiving in one direction and strict in the other:
a broken school must not break the atlas, but it must not paint either.

- A malformed `school.json`, a missing palette, an unknown mapping key or an
  empty/unknown shader file excludes that school and records the reasons.
- The console receives a grouped warning. The selector only ever lists valid
  schools.
- An unknown `?school=` value falls back to `turner` (or the first valid school).
- If no school is valid, the app paints the house scene rather than an empty
  canvas.
- If one shader slot fails to compile on the GPU, that slot alone degrades to the
  house shader. The renderer reports the degraded slots in its stats.
- If WebGL2 itself is unavailable, the resolved palette, gestures and seed are
  handed to the 2D canvas painter.

## Checklist for a new school

- [ ] Folder id matches `school.json` and is URL-safe.
- [ ] Palette returns six valid hex washes plus ground, ink, accent, highlight and shadow.
- [ ] Palette and mapping are pure functions of weather, context and seed.
- [ ] Shader bodies contain statements only and write `fragColor`.
- [ ] Brush output is premultiplied.
- [ ] The school frames at 1440×900 and 390×844 with `?offline=1&still=1`.
- [ ] A screenshot is added to `docs/screenshots/`.
- [ ] `npm run lint`, `typecheck`, `test` and `build` are green.
