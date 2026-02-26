---
description: How to deploy and verify the application is running correctly
---

# Deploy & Verify Workflow

This workflow is referenced by the Definition of Done in the Engineering Manifesto.
Currently the app runs locally (no CI/CD pipeline yet). When CI/CD is added,
update this workflow accordingly.

## Steps

// turbo
1. Build the TypeScript:
```bash
cd /Users/rservant/code/speech-evaluator && npm run build
```

// turbo
2. Run the full test suite:
```bash
npx vitest run
```

3. Start the server:
```bash
node dist/index.js
```

4. Verify the health endpoint:
```bash
curl -s http://localhost:3004/health | python3 -m json.tool
```
Expected: `{ "status": "ok" }`

5. Verify the version endpoint:
```bash
curl -s http://localhost:3004/api/version | python3 -m json.tool
```
Expected: `{ "version": "X.Y.Z" }` matching `package.json`

6. Open in browser and verify:
- Navigate to `http://localhost:3004`
- Confirm the page loads without console errors
- Confirm the footer shows the correct version
- Confirm the design renders correctly (dark theme, Outfit font, red accents)

7. Stop the server (Ctrl+C)

## Future: CI/CD Pipeline
When a CI/CD pipeline is set up (e.g., GitHub Actions → Cloud Run):
- Update this workflow to reference the pipeline
- Add `gh run watch` to monitor the deployment
- Add live URL verification step
- Embed screenshots in the walkthrough artifact as proof of deployment
