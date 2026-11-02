# Art direction — Atlas of Small Weathers

The ten decisions every screen answers to. They come from the algorithmic-art, taste,
frontend-design, impeccable, Apple-design, Emil Kowalski, animation-performance,
canvas-design and doc-coauthoring skills, read before the first line of code.

1. **A weather portrait, not a dashboard.** One city, one seed, one small weather. The painting is the product; numbers are a caption, never a chart.
2. **The interface is a museum label.** Full-bleed artwork, a place name in the lower-left, a wordmark upper-left, one action upper-right. No cards, no navigation bar, no panels at rest.
3. **Type with a pulse.** Fraunces for place names (optical sizing, soft serif, tight display leading) and Instrument Sans for data and controls. One display moment per screen.
4. **Pigment belongs to the school.** Turner owns ochre, amber and slate; Rothko owns oxblood, plum and burnt orange; Hokusai owns indigo, sumi and vermilion. UI chrome stays ink on bone. No blue-to-red data ramps, ever.
5. **Composition is weather.** Pressure sets the visual weight line, cloud mass sets the upper density, humidity sets the veil. Layout follows the same physics: low and heavy, or high and light.
6. **Breath, not bounce.** Motion has one tempo: slow paper veils (900 ms), calm control feedback (160–180 ms), nothing that snaps. All durations and curves live in `src/styles/tokens.css`.
7. **Texture is painted in.** Paper fibre, film grain, pigment bloom and deckled edges are generated in the final shader, not pasted on as a filter.
8. **Accessible by construction.** A neutral scrim keeps captions at 4.5:1 over any painting, every control has a visible focus ring and a keyboard path, and reduced motion slows the weather instead of stopping it.
9. **Composite-only UI.** UI motion uses transform and opacity only; the simulation runs on the GPU with an adaptive render scale. Sixty frames per second comes before any flourish.
10. **Ship wall-worthy seeds.** Every seed should be a finished composition. We do not ship a seed we would not hang on a wall.
