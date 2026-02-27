---
description: How to create a new release with version bump, tag, and push
---

# Release Workflow

Uses `commit-and-tag-version` (conventional-commits-driven semver).

## Prerequisites
- All tests pass (`npx vitest run`)
- Working tree is clean (`git status`)
- You are on `main`

## Steps

// turbo
1. Run the test suite to confirm green state:
```bash
cd /Users/rservant/code/speech-evaluator && npx vitest run
```

2. Preview what will happen (dry run):
```bash
npx commit-and-tag-version --dry-run
```
Review the computed version bump and changelog entries.

3. Run the release:
```bash
# Auto-detect from commits (recommended):
npm run release

# Or force a specific bump:
npm run release:patch   # bug fixes only → 0.X.Y+1
npm run release:minor   # new features   → 0.X+1.0
npm run release:major   # breaking       → X+1.0.0
```

This will:
- Bump `package.json` version
- Update `CHANGELOG.md`
- Create a commit: `chore(release): vX.Y.Z`
- Create an annotated tag: `vX.Y.Z`

// turbo
4. Push the commit and tag:
```bash
git push origin HEAD --follow-tags
```

## Semver Rules (Conventional Commits)

| Prefix | Bump | Example |
|---|---|---|
| `fix:` | PATCH | `fix: prevent double-click (#29)` |
| `feat:` | MINOR | `feat: add upload endpoint (#24)` |
| `feat!:` / `BREAKING CHANGE:` | MAJOR | `feat!: remove legacy API` |
| `docs:`, `chore:`, `test:`, `refactor:` | none | Non-functional changes |

## Post-Release
- Verify: `git tag -l | tail -3`
- Check GitHub: `gh release list`
