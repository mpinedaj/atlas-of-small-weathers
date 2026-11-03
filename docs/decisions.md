# Decisions

A running, dated log of choices that a future contributor might otherwise have to reverse-engineer.
Each entry records the context, the decision, and what it costs. Entries are never deleted; a
decision that changes is superseded by a new entry.

---

## D1 — Hand-written WebGL2, no Three.js

**2026-11-02.** The brief asks for a simplified Navier–Stokes atmosphere, GPU brush particles and a
paper finish. Three.js would add a scene graph, material system and 600 kB we do not use. The
painting is a handful of full-screen passes and one instanced draw; raw WebGL2 is smaller, faster
and fully legible to a contributor who wants to change a shader.

**Cost:** we own context creation, framebuffer plumbing and capability detection. That code is
small, tested and documented in `docs/architecture.md`.

## D2 — Vanilla TypeScript for the interface

**2026-11-02.** The UI is a label, a combobox, three school buttons, a seed control and a share
button. A framework would dominate the bundle and the mental model. Plain DOM with explicit state
keeps the painting independent of any UI lifecycle, and makes the project approachable to artists
who do not know React.

**Cost:** we write the small amount of DOM code ourselves and keep transitions in CSS.

## D3 — The URL is the source of truth

**2026-11-02.** A painting is reproducible when the URL carries everything that defines it:
`city`, `lat`, `lon`, `school`, `seed` and `mode`. State changes call `history.replaceState`
rather than pushing history entries, so exploring seeds does not trap the back button. Opening a
URL restores the exact view.

**Cost:** every new persistent control must update both the URL and the parser, with tests.

## D4 — Warmth is relative to a latitude/season baseline

**2026-11-02.** "Warm" is meaningless without a norm: 18 °C is a warm winter in Bogotá and a cold
summer in Oslo. Rather than a second network request for climatology, the baseline is a documented
sinusoid of latitude and day-of-year, with a small continental offset. The painting reacts to the
_anomaly_, not the raw number.

**Cost:** it is an approximation. It is deterministic, free, offline-safe and good enough for
pigment. The function lives in `src/data/baseline.ts` with its limits stated.

## D5 — Cache with explicit TTLs and an honest offline mode

**2026-11-02.** Open-Meteo is free and keyless, which makes it easy to hammer. Current weather is
cached for 10 minutes, geocoding for 24 hours. Keys are versioned (`atlas:v1:…`) so a schema change
cannot poison a cache. When both network and cache fail, bundled fixtures paint a calm sample and
the interface says so in plain language.

**Cost:** a reading can be up to ten minutes old. The label says "as of 14:20", not "now".

## D6 — Seed 1844 is the default

**2026-11-02.** The default seed is a quiet nod to J. M. W. Turner's _Rain, Steam and Speed_
(1844). It gives every first visit a composed, warm opening instead of a random one. Seeds remain
fully editable and shareable.

## D7 — All three schools ship in v0.1.0

**2026-11-02.** The phase plan put Rothko and Hokusai in Phase 2, but the project brief requires
three clearly distinct schools "from the start". Shipping all three in v0.1.0 tests the plugin
contract against real, divergent work before the contract is frozen; a contract validated by one
school is a guess.

**Cost:** Phase 2 keeps the slow data-state transitions and the deeper school experience, but the
selector and the three folders are already present.

## D8 — One display face, one text face, bundled locally

**2026-11-02.** Fraunces (variable, optical sizing, soft serif) carries place names and the one
display moment; Instrument Sans carries data and controls. Both are installed from Fontsource, not
a CDN, so the project renders identically offline and in CI screenshots.

## D9 — Motion tokens live in CSS and are mirrored in TypeScript

**2026-11-02.** Tempo must be consistent across CSS transitions, the WebGL simulation and the idle
fade. `src/styles/tokens.css` is canonical; `src/ui/motion.ts` exports the same numbers for JS.
The tempo is breathing, not snappy: 900 ms paper veils, 180 ms control feedback, no spring bounce
in the chrome.

## D10 — Quality adapts, beauty does not

**2026-11-02.** The renderer watches frame time and steps internal resolution and particle count
down before frames drop. A lower-resolution painting is still a painting; a stuttering one is not.
The fallback for missing WebGL2 is a composed 2D painting with the same palette and a poetic note,
not an error card.

## D11 — A single squashed initial commit

**2026-11-02.** The repository began with two scaffold commits (an empty initial commit and a
README). To honour the "one initial commit on `main`, then never commit directly to `main`" rule,
those two were squashed into `chore: initialize repository` and force-pushed to a brand-new public
repository with no collaborators. All subsequent work arrives through short branches and reviewed
pull requests.

## D12 — CI is the merge contract

**2026-11-02.** Every pull request runs lint, typecheck, unit tests, production build and a
Chromium end-to-end suite. A red pipeline is not merged. `main` is protected when the token allows
it; otherwise the same rule is documented in `CONTRIBUTING.md` and followed manually.

## D13 — Elevation joins the seasonal baseline

**2026-11-02.** Latitude alone would read Bogotá as a hot equatorial city and paint its 14 °C
afternoon as a cold snap. The forecast response already includes elevation, so the baseline
subtracts 4.5 °C per kilometre before adding the seasonal sinusoid. This keeps D4's promise of no
second request while making mountain cities feel like themselves. The lapse rate is a boundary-layer
approximation, not a climate model; the function and its limits live in `src/data/baseline.ts`.

## D14 — One fixed pipeline, four school slots

**2026-11-02.** The renderer is a fixed sequence rather than a scene graph: advect velocity, let the
school's flow shader add weather force, splat particle turbulence, project to divergence-free,
advect dye, splat brush pigment, draw the field, composite paper and grain. Schools can change how
each stage looks, but not the order; that order is what makes the motion read as fluid rather than
as particles.

Three consequences are deliberate. Brush particles live in GPU buffers and advance through
transform feedback, so the CPU never touches thousands of positions per frame. A school shader body
is the inside of `main()`, not a complete shader, which keeps the uniform contract identical across
schools. And still mode (`?still=1&warmup=N`) runs the same pipeline at a fixed 1/60 s for N frames,
then draws once with `preserveDrawingBuffer`; screenshots and visual tests therefore share the same
deterministic clock as each other, while live mode follows real time (slowed, never stopped, under
`prefers-reduced-motion`).

The pipeline needs WebGL2 plus `EXT_color_buffer_float`. When either is missing, the app does not
show an error card: it hands the same scene to a 2D canvas painter (D10).

## D15 — A school is a folder, not a registration

**2026-11-02.** `import.meta.glob` discovers `schools/*` at build time, so adding a school never
requires an import in core code. Metadata, palette, mapping and shader files are validated at
discovery; a malformed folder is reported and excluded while the rest of the atlas boots. This is
stricter than silently painting a half-defined school and looser than failing the page. Shader
files are bodies inside `main()`, not complete programs, so every school shares one uniform and
helper contract; if a single slot fails to compile, that slot degrades to the house shader and the
renderer reports it. `?school=<id>` selects a school, and an unknown id falls back to Turner. The
complete authoring contract lives in `docs/schools.md`.

## D16 — A school change is a veil through paper, not a loading state

**2026-11-02.** Changing hands is the most visible interaction in the atlas, and a spinner would
turn a painting into an application. Instead the stage fades to bare paper, the new programs,
palette and particles are installed while nothing is visible, and the paper lifts again. The
selector's buttons stay in the document and keep keyboard focus during the change; the group is
marked busy and ignores extra activation rather than disabling the button that was just pressed.
The whole gesture is 900 ms (180 ms under `prefers-reduced-motion`), which is long enough to read as
a deliberate cut and short enough not to feel like waiting.

**Cost:** the renderer now has a `setScene` path that must rebuild every GPU resource and restart
still-mode warm-up without ever replacing the canvas. The crossfade is a real transition, so the
end-to-end suite waits for the new scene's frame counter rather than for a click to return.
