---
description: How to create a new release with version bump, tag, and push
---

# Release Workflow

## Prerequisites
- All tests pass (`npm run test`)
- Working tree is clean (`git status`)
- You are on the branch to release from

## Steps

// turbo
1. Run the test suite to confirm green state:
```bash
cd /Users/rservant/code/speech-evaluator && npx vitest run
```

2. Determine the new version based on changes since the last tag:
```bash
git log $(git describe --tags --abbrev=0)..HEAD --oneline
```
- **Patch** (0.4.X): Bug fixes only
- **Minor** (0.X.0): New features or PRD phase completion
- **Major** (X.0.0): Breaking changes

3. Update the version in `package.json`:
```bash
# Replace NEW_VERSION with the determined version (e.g., 0.5.0)
npm version NEW_VERSION --no-git-tag-version
```

4. Rebuild to verify the new version compiles:
```bash
npm run build
```

// turbo
5. Re-run tests to confirm nothing broke:
```bash
npx vitest run
```

6. Commit the version bump:
```bash
git add package.json package-lock.json
git commit -m "chore: bump version to vNEW_VERSION"
```

7. Create an annotated git tag:
```bash
git tag -a vNEW_VERSION -m "vNEW_VERSION: [brief description of what's in this release]"
```

8. Push the commit and tag:
```bash
git push origin HEAD --follow-tags
```

## Post-Release
- Verify the tag appears on GitHub: `gh release list`
- Update any tracking issues that are now resolved
