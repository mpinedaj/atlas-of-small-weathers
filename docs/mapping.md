# Data to gesture

How a weather reading becomes a painting. Each mapping is a pure function in
`src/data/gestures.ts`; the justification lives in the code comment next to it.

| Weather                | Gesture                                             | Notes                                                           |
| ---------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| Temperature            | Dominant hue and warmth of the palette              | Relative to a latitude/season baseline (D4, D13), not absolute. |
| Wind speed + direction | Long, undulating strokes; particle field direction  | Speed controls stroke length and tension.                       |
| Humidity               | Veils and transparency of layers                    | Higher humidity softens edges.                                  |
| Cloud cover            | Density and mass of upper colour fields             |                                                                 |
| Pressure               | Visual weight: low/dense vs. high/light composition |                                                                 |
| Precipitation          | Grain, drip, running pigment                        |                                                                 |
| Time of day            | Light and shadow balance                            | From the place's wall clock.                                    |

The baseline subtracts 4.5 °C per kilometre of elevation before adding the seasonal sinusoid,
so mountain cities read as themselves. See `src/data/baseline.ts`.
