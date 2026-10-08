# Deploying to Google Cloud Run

The web app runs on Cloud Run as the service `pgo-web`. GitHub Actions builds the container
image, pushes it to Artifact Registry and deploys it on every push to `main` (work happens on
`development`; merging or pushing to `main` releases). GitHub signs in to
Google Cloud with Workload Identity Federation, so no service-account key is stored anywhere.

You do this setup once. The commands use bash syntax; on Windows, run them in Git Bash.

## 1. Variables

```bash
PROJECT_ID=power-grid-operations   # the existing Firebase project (a Firebase project is a GCP project)
REGION=europe-west1
GITHUB_REPO=mkirashimas/power-grid-operations
```

## 2. Billing and APIs

The project already exists (created in the Firebase console). Cloud Run needs billing, so in the
Firebase console go to **Usage and billing > Details & settings > Modify plan** and switch from
Spark to **Blaze (pay as you go)**.

```bash
gcloud auth login
gcloud config set project "$PROJECT_ID"

gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  iamcredentials.googleapis.com sts.googleapis.com
```

Set a budget alert in the console under Billing > Budgets & alerts, e.g. €10 a month.

## 3. Artifact Registry repository

```bash
gcloud artifacts repositories create pgo --repository-format=docker --location="$REGION"
```

## 4. Deploy service account

```bash
gcloud iam service-accounts create github-deployer --display-name="GitHub deployer"
SA="github-deployer@$PROJECT_ID.iam.gserviceaccount.com"

for role in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA" --role="$role"
done
```

## 5. Workload Identity Federation (trusts only this repository)

```bash
gcloud iam workload-identity-pools create github --location=global --display-name="GitHub"

gcloud iam workload-identity-pools providers create-oidc github-repo \
  --location=global --workload-identity-pool=github \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository == '$GITHUB_REPO'"

POOL_ID=$(gcloud iam workload-identity-pools describe github --location=global --format='value(name)')

gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/$POOL_ID/attribute.repository/$GITHUB_REPO"

# Value for GCP_WORKLOAD_IDENTITY_PROVIDER:
gcloud iam workload-identity-pools providers describe github-repo \
  --location=global --workload-identity-pool=github --format='value(name)'
```

## 6. GitHub repository variables

Add these under Settings > Secrets and variables > Actions > **Variables**. None of them is a
secret.

| Variable                         | Value                                               |
| -------------------------------- | --------------------------------------------------- |
| `GCP_PROJECT_ID`                 | the project ID                                      |
| `GCP_REGION`                     | e.g. `europe-west1`                                 |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | output of the last command in step 5                |
| `GCP_DEPLOY_SERVICE_ACCOUNT`     | `github-deployer@<project>.iam.gserviceaccount.com` |

The `deploy-web` job in `.github/workflows/ci.yml` is skipped until `GCP_PROJECT_ID` is set.
After that, the next push to `main` deploys. The service URL is shown in the job log and in the
Cloud Run console.

## Testing the container locally (optional, needs Docker)

```bash
docker build -f apps/web/Dockerfile -t pgo-web .
docker run --rm -p 8080:8080 pgo-web
```
