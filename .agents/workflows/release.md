---
description: How releases are created using Google's release-please
---

# Release Workflow

Releases are fully automated via [release-please](https://github.com/googleapis/release-please).

## How It Works

1. On every push to `main`, the `release-please` GitHub Action scans conventional commits.
2. It opens (or updates) a **Release PR** with:
   - Bumped `package.json` version
   - Updated `CHANGELOG.md`
   - A descriptive title like `chore(main): release 0.7.0`
3. **When you merge the Release PR**, release-please:
   - Creates an annotated git tag (`v0.7.0`)
   - Creates a GitHub Release with release notes

## Semver Rules (Conventional Commits)

| Prefix | Bump | Example |
|---|---|---|
| `fix:` | PATCH | `fix: prevent double-click (#29)` |
| `feat:` | MINOR | `feat: add upload endpoint (#24)` |
| `feat!:` / `BREAKING CHANGE:` | MAJOR | `feat!: remove legacy API` |
| `docs:`, `chore:`, `test:`, `refactor:` | none | Non-functional changes |

## Manual Steps

None required! Just keep writing conventional commits. To release:

// turbo
1. Check for an open Release PR:
```bash
gh pr list --label "autorelease: pending"
```

2. Review and merge the Release PR when ready.

## Post-Release
- Verify: `git tag -l | tail -3`
- Check GitHub: `gh release list`
