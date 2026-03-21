# Operations Runbook

> Living document — update after every incident or infrastructure change.

## System At-a-Glance

| Item | Value |
|------|-------|
| **Service** | speech-evaluator |
| **URL** | https://eval.taverns.red |
| **Platform** | Google Cloud Run |
| **Region** | northamerica-northeast1 (Montréal) |
| **Project** | toast-stats-prod-6d64a |
| **Image** | northamerica-northeast1-docker.pkg.dev/toast-stats-prod-6d64a/speech-evaluator/app |
| **Memory** | 2Gi |
| **Max instances** | 5 |
| **Timeout** | 3600s |

---

## Health Checks

### Quick Status

```bash
# Is the site up?
curl -s https://eval.taverns.red/api/health | jq .

# What version is deployed?
curl -s https://eval.taverns.red/api/version | jq .

# Cloud Run service status
gcloud run services describe speech-evaluator \
  --region=northamerica-northeast1 \
  --format='table(status.conditions[].type,status.conditions[].status)'
```

### CI Status

```bash
# Latest CI runs
gh run list -L 5

# Watch a running CI job
gh run watch <run-id>
```

---

## Common Scenarios

### 1. Deploy Failed in CI

**Symptoms**: GitHub Actions deploy job fails

**Triage**:
```bash
# Check the failing run
gh run view <run-id> --log-failed

# Common causes:
# - Docker auth region mismatch (must be northamerica-northeast1)
# - Cloud Run quota exceeded
# - Image build failure (dependency issue)
```

**Fix**: Check the error in CI logs → fix the root cause → push again.

### 2. Site Is Down (5xx)

**Severity**: P0

**Triage**:
```bash
# Check Cloud Run logs
gcloud run services logs read speech-evaluator \
  --region=northamerica-northeast1 --limit=50

# Check if the container is crashing
gcloud run revisions list \
  --service=speech-evaluator \
  --region=northamerica-northeast1 \
  --format='table(name,status.conditions[0].status,spec.containers[0].image)'
```

**Rollback**:
```bash
# Find the last working revision
gcloud run revisions list \
  --service=speech-evaluator \
  --region=northamerica-northeast1

# Route traffic to the last working revision
gcloud run services update-traffic speech-evaluator \
  --region=northamerica-northeast1 \
  --to-revisions=<good-revision>=100
```

### 3. Deepgram Transcription Not Working

**Symptoms**: Live mode records but no transcript appears

**Triage**:
- Check browser console for WebSocket errors
- Check server logs for Deepgram connection failures
- Verify `DEEPGRAM_API_KEY` is set and valid

**Fix**: If API key expired, update in Cloud Run environment variables:
```bash
gcloud run services update speech-evaluator \
  --region=northamerica-northeast1 \
  --set-env-vars="DEEPGRAM_API_KEY=<new-key>"
```

### 4. Evaluations Not Saving to History

**Symptoms**: Evaluations work but don't appear in History tab

**Triage**:
```bash
# Check GCS bucket access
gsutil ls gs://speech-evaluator-uploads-ca/results/

# Check server logs for GCS errors
gcloud run services logs read speech-evaluator \
  --region=northamerica-northeast1 --limit=50 \
  | grep -i "gcs\|history\|storage"
```

**Common causes**:
- Service account permissions revoked
- GCS bucket doesn't exist or wrong region
- Quota exceeded

### 5. Auth Not Working

**Symptoms**: Login page loops, 401 errors

**Triage**:
- Verify `ALLOWED_EMAILS` env var contains the correct email
- Verify `FIREBASE_API_KEY` is set
- Check Firebase console for auth configuration

### 6. Flaky Test Blocking Push

**Symptoms**: Tests pass locally but fail in CI (or vice versa)

**Triage**:
```bash
# Run the specific test in isolation
npx vitest run <file> --reporter=verbose

# Run it multiple times to confirm flakiness
for i in {1..5}; do npx vitest run <file> 2>&1 | tail -3; done
```

**Known flaky**: `server.test.ts > set_consent` — see [Test Strategy](./test-strategy.md#known-flaky-tests).

---

## Environment Variables

See [architecture.md](./architecture.md#environment-variables) for the full list.

### Updating Env Vars on Cloud Run

```bash
gcloud run services update speech-evaluator \
  --region=northamerica-northeast1 \
  --set-env-vars="KEY=value"
```

### Viewing Current Env Vars

```bash
gcloud run services describe speech-evaluator \
  --region=northamerica-northeast1 \
  --format='yaml(spec.template.spec.containers[0].env[])'
```

---

## Deployment

### Automated (Normal)
Push to `main` → CI runs → Docker build → Cloud Run deploy → Health check

### Manual Rollback
See "Site Is Down" scenario above.

### Manual Deploy (Emergency)
```bash
# Build and push image manually
docker build -t northamerica-northeast1-docker.pkg.dev/toast-stats-prod-6d64a/speech-evaluator/app:manual .
docker push northamerica-northeast1-docker.pkg.dev/toast-stats-prod-6d64a/speech-evaluator/app:manual

# Deploy the manual image
gcloud run deploy speech-evaluator \
  --image=northamerica-northeast1-docker.pkg.dev/toast-stats-prod-6d64a/speech-evaluator/app:manual \
  --region=northamerica-northeast1 \
  --platform=managed
```

---

## Data Retention

- Evaluations auto-expire after **90 days** (configurable via `DATA_RETENTION_DAYS`)
- Retention sweep runs every **24 hours** (configurable via `RETENTION_CHECK_INTERVAL_HOURS`)
- First sweep runs 30 seconds after server start
- Sweep deletes files from GCS under `results/` prefix older than the threshold
