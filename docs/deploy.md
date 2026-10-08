# Deploying to Google Cloud Run

**How deploys work:**

- The web app runs on Cloud Run as the service `pgo-web` in `us-central1`.
- On every push to `main`, GitHub Actions does three things, in order:
  1. builds the container image
  2. pushes it to Artifact Registry
  3. deploys it
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

The GitHub repository has these **variables**, read as `vars.*` in the workflow. They are
variables, not secrets.

| Variable                         | Value                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| `GCP_PROJECT_ID`                 | `power-grid-operations`                                                                     |
| `GCP_REGION`                     | `us-central1`                                                                               |
| `GCP_SERVICE_ACCOUNT`            | `deployer@power-grid-operations.iam.gserviceaccount.com`                                    |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/142186164859/locations/global/workloadIdentityPools/github/providers/github-repo` |

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

- **Local:** `.env.local`, which is git-ignored. The template is `.env.example`.
- **Production:** Secret Manager, mounted into Cloud Run with `--set-secrets`.
- The Cloud Run runtime service account needs `roles/secretmanager.secretAccessor` on each
  secret it reads.

## Troubleshooting

| Symptom in the deploy job                                                           | Cause and fix                                                                                    |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `auth` step: `Permission 'iam.serviceAccounts.getAccessToken' denied`               | The repo binding is missing or the repo name differs. Re-check `roles/iam.workloadIdentityUser`. |
| `docker push`: `name unknown: Repository "web" not found`                           | The Artifact Registry repository is missing. Run the create command above.                       |
| `docker push`: `denied: Permission "artifactregistry.repositories.uploadArtifacts"` | The deploy account lacks `roles/artifactregistry.writer`.                                        |
| `gcloud run deploy`: `PERMISSION_DENIED ... iam.serviceaccounts.actAs`              | The deploy account lacks `roles/iam.serviceAccountUser`.                                         |
| The deploy job is skipped                                                           | The push wasn't to `main`, the checks failed, or `GCP_PROJECT_ID` isn't set.                     |

## Testing the container locally (optional, needs Docker)

```bash
docker build -f apps/web/Dockerfile -t pgo-web .
docker run --rm -p 8080:8080 pgo-web
```

Then open http://localhost:8080.
