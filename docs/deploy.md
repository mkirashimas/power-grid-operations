# Deploying to Google Cloud Run

**How deploys work:**

- Two Cloud Run services run in `us-central1`:
  - `pgo-web`: the Next.js app
  - `pgo-realtime`: the WebSocket service behind `/alarms` (since M6)
- On every push to `main`, GitHub Actions does three things, in order:
  1. builds both container images
  2. pushes them to Artifact Registry
  3. deploys `pgo-realtime`, then `pgo-web` with `REALTIME_URL` set to the realtime service's
     `wss://` URL
- Pushes to `development` and pull requests only run the checks.
- GitHub signs in to Google Cloud with Workload Identity Federation, so no service-account key
  exists anywhere.

## Setup record

| Item                         | Value                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| Project ID                   | `power-grid-operations`                                                                     |
| Project number               | `142186164859`                                                                              |
| Region                       | `us-central1`                                                                               |
| Billing                      | Blaze (pay as you go)                                                                       |
| APIs enabled                 | iam, run, cloudbuild, artifactregistry, secretmanager, iamcredentials, sts                  |
| Deploy service account       | `deployer@power-grid-operations.iam.gserviceaccount.com`                                    |
| Its roles                    | `roles/run.admin`, `roles/artifactregistry.writer`, `roles/iam.serviceAccountUser`          |
| Workload identity pool       | `github`                                                                                    |
| Provider                     | `projects/142186164859/locations/global/workloadIdentityPools/github/providers/github-repo` |
| Provider trusts only         | `mkirashimas/power-grid-operations`                                                         |
| Repo binding                 | `roles/iam.workloadIdentityUser` on the deploy account                                      |
| Artifact Registry repository | `web` (Docker, `us-central1`)                                                               |
| Image                        | `us-central1-docker.pkg.dev/power-grid-operations/web/pgo-web:<commit sha>`                 |
| Realtime image               | `us-central1-docker.pkg.dev/power-grid-operations/web/pgo-realtime:<commit sha>`            |

The GitHub repository has these **variables**, read as `vars.*` in the workflow. They are
variables, not secrets.

| Variable                         | Value                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| `GCP_PROJECT_ID`                 | `power-grid-operations`                                                                     |
| `GCP_REGION`                     | `us-central1`                                                                               |
| `GCP_SERVICE_ACCOUNT`            | `deployer@power-grid-operations.iam.gserviceaccount.com`                                    |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/142186164859/locations/global/workloadIdentityPools/github/providers/github-repo` |
| `EIA_SECRET_NAME` (optional)     | `eia-api-key`, set once the secret exists (see "EIA API key")                               |

The deploy job in `.github/workflows/ci.yml` is skipped while `GCP_PROJECT_ID` is empty.

## Create the Artifact Registry repository

Run this once in Cloud Shell:

```bash
gcloud artifacts repositories create web --repository-format=docker --location=us-central1 --project=power-grid-operations
```

Expected output:

```text
Create request issued for: [web]
Created repository [web].
```

Check:

```bash
gcloud artifacts repositories list --location=us-central1 --project=power-grid-operations
```

Expected output: one row with `REPOSITORY` = `web` and `FORMAT` = `DOCKER`.

## Budget alert

1. Open https://console.cloud.google.com/billing/budgets?project=power-grid-operations.
2. Click **Create budget**.
3. Set the scope to project `power-grid-operations`.
4. Set the amount to e.g. 10 (in your billing currency).
5. Keep the default thresholds (50 %, 90 %, 100 %) and **Finish**.

With minimum instances at 0, demo traffic stays within the Cloud Run free tier.

## Secrets

- **Local:** `apps/web/.env.local`, which is git-ignored. The template is
  `apps/web/.env.example`. Next.js only reads env files from the app's folder.
- **Production:** Secret Manager, mounted into Cloud Run with `--set-secrets`.
- **Runtime account:** Cloud Run runs as the default compute service account,
  `142186164859-compute@developer.gserviceaccount.com`. It needs
  `roles/secretmanager.secretAccessor` on each secret it reads.

### EIA API key

Without this, the live site serves the committed EIA snapshot. With it, the site fetches fresh
EIA data, cached for an hour. Run in Cloud Shell:

**1. Store the key.** The first line asks for the key without echoing it, so it never lands in
the shell history.

```bash
read -rs -p "EIA API key: " EIA_KEY && echo
printf '%s' "$EIA_KEY" | gcloud secrets create eia-api-key --data-file=- --replication-policy=automatic --project=power-grid-operations
unset EIA_KEY
```

Expected output: `Created version [1] of the secret [eia-api-key].`

**2. Let Cloud Run read it.**

```bash
gcloud secrets add-iam-policy-binding eia-api-key --member=serviceAccount:142186164859-compute@developer.gserviceaccount.com --role=roles/secretmanager.secretAccessor --project=power-grid-operations
```

Expected output: `Updated IAM policy for secret [eia-api-key].`

**3. Tell CI to mount it.** In GitHub, go to Settings → Secrets and variables → Actions →
**Variables** and add `EIA_SECRET_NAME` = `eia-api-key`. The next deploy from `main` passes
`--set-secrets EIA_API_KEY=eia-api-key:latest`.

**To rotate the key:** add a new version with step 1, replacing `create` with
`versions add eia-api-key --data-file=-` (and dropping `--replication-policy`). Then redeploy.

## Realtime service (`pgo-realtime`)

The deploy job creates it on the first release after M6; no setup is needed.

| Setting           | Value   | Why                                                                    |
| ----------------- | ------- | ---------------------------------------------------------------------- |
| `--timeout`       | `3600`  | A WebSocket stays open at most this long (60 min); the page reconnects |
| `--max-instances` | `1`     | One instance holds the shared alarm state, so every visitor sees it    |
| `--min-instances` | `0`     | Scales to zero when nobody has `/alarms` open                          |
| `--memory`        | `512Mi` | The simulator and up to a few hundred connections fit easily           |

**Check it after a release (Cloud Shell):**

```bash
URL=$(gcloud run services describe pgo-realtime --region=us-central1 --project=power-grid-operations --format='value(status.url)')
curl -s "$URL/healthz"
```

Expected output:

```text
ok
```

```bash
gcloud run services describe pgo-web --region=us-central1 --project=power-grid-operations --format='value(spec.template.spec.containers[0].env)'
```

Expected output: a list that contains `REALTIME_URL` with a `wss://pgo-realtime-…run.app` value.

Then open `<web URL>/alarms`: the chip turns **Live** within a few seconds (longer after a cold
start).

## Troubleshooting

| Symptom in the deploy job                                                           | Cause and fix                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth` step: `Permission 'iam.serviceAccounts.getAccessToken' denied`               | The repo binding is missing or the repo name differs. Re-check `roles/iam.workloadIdentityUser`.                                                                                                   |
| `docker push`: `name unknown: Repository "web" not found`                           | The Artifact Registry repository is missing. Run the create command above.                                                                                                                         |
| `docker push`: `denied: Permission "artifactregistry.repositories.uploadArtifacts"` | The deploy account lacks `roles/artifactregistry.writer`.                                                                                                                                          |
| `gcloud run deploy`: `PERMISSION_DENIED ... iam.serviceaccounts.actAs`              | The deploy account lacks `roles/iam.serviceAccountUser`.                                                                                                                                           |
| `gcloud run deploy`: `Permission denied on secret ... for Revision service account` | The runtime account cannot read the secret. Run step 2 of "EIA API key".                                                                                                                           |
| The deploy job is skipped                                                           | The push wasn't to `main`, the checks failed, or `GCP_PROJECT_ID` isn't set.                                                                                                                       |
| `/alarms` stays on **Connecting…** or **Reconnecting…**                             | `REALTIME_URL` is missing on `pgo-web`, or `pgo-realtime` failed to start. Run the checks above.                                                                                                   |
| After a deploy, the app still shows the old version                                 | Expected: the service worker waits for **Reload** in the update prompt. If no prompt appears, check that `curl -sI <url>/serwist/sw.js` shows `Cache-Control: no-cache` (set in `next.config.ts`). |

## Testing the container locally (optional, needs Docker)

```bash
docker build -f apps/web/Dockerfile -t pgo-web .
docker run --rm -p 8080:8080 pgo-web
```

Then open http://localhost:8080.

The realtime service:

```bash
docker build -f services/realtime/Dockerfile -t pgo-realtime .
docker run --rm -p 8081:8080 pgo-realtime
```

Then `curl http://localhost:8081/healthz` prints `ok`.
