# Contributing to Atlas of Small Weathers

Thank you for wanting to make this small weather a little better. This project is a slow,
generative painting engine: most changes are judged by how they feel on screen as much as by
whether the tests pass.

## Before you start

- Read [`docs/art-direction.md`](docs/art-direction.md). It is ten decisions long and it is the
  tiebreaker for visual questions.
- Read [`docs/decisions.md`](docs/decisions.md) for the reasoning behind the architecture.
- For anything larger than a typo, open an issue first. Describe the weather, the feeling, or the
  school you have in mind. Small, well-scoped pull requests merge faster.

## Setup

Requirements: Node.js 22.12 or newer (see `.nvmrc`) and a browser with WebGL2.

```bash
git clone https://github.com/mpinedaj/atlas-of-small-weathers.git
cd atlas-of-small-weathers
npm install
npm run dev
```

Husky installs two hooks during `npm install`: `lint-staged` on commit and `commitlint` on the
commit message. They are there to keep the history readable, not to slow you down.

## Everyday commands

| Command                | What it does                                      |
| ---------------------- | ------------------------------------------------- |
| `npm run dev`          | Vite dev server with hot reload                   |
| `npm run build`        | Type-checked production build into `dist/`        |
| `npm run preview`      | Serve the production build locally                |
| `npm run lint`         | ESLint over source, schools, tests and configs    |
| `npm run format`       | Prettier, writes changes                          |
| `npm run format:check` | Prettier, fails when something is unformatted     |
| `npm run typecheck`    | `tsc --noEmit` under strict settings              |
| `npm run test`         | Vitest unit tests                                 |
| `npm run test:e2e`     | Playwright Chromium tests (starts the dev server) |

Install the browser once with `npx playwright install chromium`.

## Branches

Never commit directly to `main`. Use a short, prefixed branch:

```
feat/city-search
fix/url-seed-rounding
docs/school-guide
chore/update-dependencies
refactor/fluid-pass
test/rothko-palette
```

Open a pull request against `main`. CI must be green before merge. Pull requests are
squash-merged so that `main` stays linear, and the branch is deleted afterwards.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/) are enforced by commitlint:

```
feat(schools): add the gustav klimt school
fix(data): keep cached weather when the network drops
docs(art): clarify the paper grain recipe
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`,
`chore`, `revert`. Write the subject in the imperative mood, lower case, no trailing period.
Explain _why_ in the body when the change is not obvious.

## Pull requests

- Keep the scope small enough to review in one sitting.
- Reference the issue with `Closes #12`.
- Include screenshots for visual changes, at desktop and mobile widths.
- Update `docs/decisions.md` when you make an architectural choice, and `CHANGELOG.md` under
  `Unreleased` when the change is user-visible.
- Add a unit test for pure logic and an end-to-end test when the change is observable in the
  browser. Weather-dependent tests must use the offline fixtures, never the live API.

## Adding a school

A school is a folder, not a fork. The registry discovers every directory under `schools/` at
build time, validates its metadata, and offers it in the interface. To add one:

```
schools/<name>/
  school.json     # id, name, year, blurb, author, palette description
  palette.ts      # exported palette, colours as OKLCH or hex
  mapping.ts      # optional: weather -> gesture overrides
  brush.frag      # how a stroke is laid down
  flow.frag       # how the field moves
  post.frag       # paper, grain, veils
```

Rules:

- The folder name and `school.json.id` must match.
- Shaders receive the documented uniforms from `src/core/types.ts`; do not reach outside them.
- All randomness comes from the seeded PRNG or a seed uniform. No `Math.random()`.
- The painting must still breathe when `prefers-reduced-motion` is set; it slows down, it does
  not stop.
- Include a palette test and a Playwright screenshot at 1440×900. A school is not finished until
  it looks like itself.

## Accessibility and tone

Interfaces are keyboard reachable, focus is visible, and every canvas has a textual description
of the weather it paints. Copy is calm and specific. Avoid exclamation marks, growth language, and
jokes at the weather's expense.

## Reporting problems

Use the issue templates. For a visual bug, include the full shareable URL: city, school, seed and
time window are all in there. For security concerns, do not open a public issue; contact the
maintainer through GitHub first.

## Branch protection

The intended `main` configuration requires the CI checks, one approving review, and squash merges,
and forbids force pushes. Repository administrators can apply it under
**Settings → Branches → Branch protection rules**. If you fork the project, enable the same rules
for your own `main`.

## License

By contributing you agree that your work is released under the [MIT License](LICENSE).
