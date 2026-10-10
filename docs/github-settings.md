# GitHub repository settings

This file records the settings for `mkirashimas/power-grid-operations` that live on GitHub, not in the code.

| Setting        | Value                                                                 | Where                                      |
| -------------- | --------------------------------------------------------------------- | ------------------------------------------ |
| Default branch | `development`                                                         | Settings → General → Default branch        |
| Release branch | `main`. A push deploys to Cloud Run.                                  | `.github/workflows/ci.yml`                 |
| Actions vars   | `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_SERVICE_ACCOUNT`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `EIA_SECRET_NAME` | Settings → Secrets and variables → Actions → **Variables** |
| Actions secrets | none, because Workload Identity Federation means no keys are stored  |                                            |
| Branch ruleset | `protect-main-dev`                                                    | Settings → Rules → Rulesets                |

The values of the Actions variables are listed in [deploy.md](deploy.md#setup-record).

## Branch flow

`feature/*` → PR into `development` → PR `development` → `main`, which releases.

## Ruleset `protect-main-dev`

| Field             | Value                                                         |
| ----------------- | ------------------------------------------------------------- |
| Enforcement       | **Active**                                                    |
| Bypass list       | Repository admin, mode **For pull requests only**             |
| Target branches   | `Default` (`development`) and the pattern `main`              |

**Rules turned on:**

- **Restrict deletions**
- **Block force pushes**
- **Require a pull request before merging**, with required approvals set to `0`. It is a solo repo, and GitHub does not let you approve your own PR.
- **Require status checks to pass**:
  - `Lint, test, build, e2e`
  - `Rust and WASM`

`Deploy to Cloud Run` is deliberately left out of the required checks. It only runs after a merge to `main`, so a PR would wait for it forever.

### Set it up

1. Settings → Rules → Rulesets → **New ruleset → New branch ruleset**.
2. Name: `protect-main-dev`. Enforcement: **Active**.
3. Bypass list: **Add bypass**, choose **Repository admin**, and set its mode to **For pull requests only**. With **Always allow**, the admin (you) can still force-push and delete these branches, so the protection does nothing for you.
4. Target branches:
   - **Add target → Include default branch**.
   - **Add target → Include by pattern**, type `main`, then click **Add inclusion target**.
5. Turn on the rules listed above. Pick the status checks from the list; checks show up there only after CI has run once.
6. Click **Create**, or **Save changes** when editing.

**Check:** the ruleset list shows `protect-main-dev` as Active, targeting 2 branches.

### Troubleshooting

| Symptom                                                                  | Fix                                                                                                                       |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| "This ruleset does not target any resources and will not be applied"     | Step 4 is missing. Typing a pattern is not enough; you also have to click **Add inclusion target**. Then save.            |
| Rules don't block anything                                               | Enforcement is set to Disabled or Evaluate. Set it to **Active**.                                                         |
| PR merge is blocked and says it is waiting for a status check            | The check name doesn't match the job `name:` in `ci.yml` exactly. Remove it and pick it again from the list.               |
| `git push --force` is rejected                                           | This is expected. Open a PR instead.                                                                                      |
