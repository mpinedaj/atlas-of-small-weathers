# Create your first school in 15 minutes

1. Copy `schools/turner` to `schools/<your-id>`.
2. Edit `school.json`: name, author, license, description, references.
3. Adjust `palette.ts` for each condition.
4. Optionally override `mapping.ts` or any shader in `brush.frag`, `flow.frag`,
   `field.frag`, `post.frag`.
5. Run `npm run dev` and open `?school=<your-id>`.
6. Run `npm test` and `npm run test:e2e`.

The full contract is in [`docs/schools.md`](schools.md). A malformed folder is
reported and skipped; it never takes the atlas down.
