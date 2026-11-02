# Publishing

The repository lives at <https://github.com/mpinedaj/atlas-of-small-weathers>. `gh` is installed and
authenticated in the development environment, so the commands below are a recovery path, not the
normal workflow.

## If the remote does not exist yet

```bash
git init
git add README.md LICENSE .gitignore
git commit -m "chore: initialize repository"
gh repo create atlas-of-small-weathers --public --source=. --remote=origin --push
```

## Everyday flow

```bash
git switch main
git pull --ff-only
git switch -c feat/my-school

# work, then
git add -A
git commit -m "feat(school): add a cyanotype school"
git push -u origin feat/my-school
gh pr create --base main --fill
```

Merge only with CI green, using **Squash and merge** and the pull request title as the commit
subject. Delete the branch afterwards.

## Branch protection

With repository admin rights:

```bash
gh api -X PUT repos/mpinedaj/atlas-of-small-weathers/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f "required_status_checks[strict]=true" \
  -f "required_status_checks[contexts][]=ci" \
  -f "enforce_admins=true" \
  -f "required_pull_request_reviews[required_approving_review_count]=0" \
  -f "restrictions="
```

If the token lacks the `admin` scope, the rule still applies socially: nothing reaches `main`
without a green pull request. Document the limitation in the phase notes.

## Releases

```bash
npm version 0.1.0 --no-git-tag-version
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore(release): v0.1.0"
gh release create v0.1.0 --target main --title "v0.1.0 — First weathers" \
  --notes-file docs/releases/v0.1.0.md ./docs/screenshots/*.png
```
