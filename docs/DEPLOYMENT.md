# Deploy using free services only

The user has authorized **no paid resources**. The included Blueprint requests `plan: free` with no persistent disk, worker, cron job or Render Postgres. Do not change plans or add payment details.

## Current publishing state

The local Next.js build is verified. The public repository is https://github.com/silentmaster0610/proofpilot. The application source and MIT license are published. A Turso Free database named `proofpilot` exists in Mumbai, with a database-specific 90-day token. Render deployment is pending; it has not been claimed as live. The old ChatGPT Site is a separate earlier version and does not contain these updates.

## 1. Public source repository

Create `silentmaster0610/proofpilot` as a public GitHub repository. Publish only the clean application source, README, MIT license, tests and documentation. Never upload `.env`, `.env.local`, `.dev.vars`, `.worker.env`, `.git`, local databases, dependencies or generated build output. The source ZIP delivered with this project excludes these files. The public source was checked against local secret values before upload.

If pushing with Git, use a new `github` remote; the existing `origin` points to the earlier ChatGPT Sites repository and must not receive this migration. Publish the prepared `render-nemotron` branch as `main`, or import the clean ZIP into an initialized repository.

## 2. Turso Free

After signing in at [Turso](https://app.turso.tech), select the $0 plan and create a `proofpilot` database. Do not enable paid upgrades. Generate a database auth token and save the URL/token only as local or hosting secrets. Schema initialization happens automatically on the first request.

Turso is needed for durability on the free Render instance. Local development needs no Turso account and uses SQLite. See [current Turso pricing](https://turso.tech/pricing).

## 3. Render Free

Use Aditya's workspace (already selected by the owner). Connect the new public GitHub repository and apply `render.yaml`, or create a web service with:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Plan | Free |
| Region | Singapore |
| Build | `npm ci --include=dev && npm run build` |
| Start | `npm start` |
| Health path | `/api/health` |
| Node | `24.19.0` |

Set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `REQUIRE_REMOTE_DB=true`, `FOLLOWUP_SCANNER=true`. Generate strong random owner/judge keys (at least 32 characters) in `PROOFPILOT_OWNER_KEY` and `PROOFPILOT_JUDGE_KEY`. The Blueprint generates them automatically. Do not reuse local development keys in public hosting.

Leave `NEBIUS_API_KEY` unset for this sample-only release. The Blueprint intentionally does not require it. The model default is configured for later use. Render supplies `RENDER_EXTERNAL_URL`; set `APP_URL` only when using a different canonical domain.

## 4. Verify before sharing

Wait for Render to report a successful live deployment. Open `/api/health`, test the public sample workflow, reload and verify saved data, and confirm private owner data is inaccessible from a new sample session. Recheck persistence after a restart with the remote database connected. Do not claim deployment success from a configuration file alone.

Free Render instances sleep after inactivity and can take time to wake. Follow-up checks run only while awake. See [Render free service limitations](https://render.com/docs/free). No service to prevent sleeping is configured.

## Later live AI verification

The team must supply Nebius access with available free credits if it wants to avoid payment. Configure the server secret, perform a consented real-input run, and preserve actual request metadata for the demo. A source adapter and deterministic sample alone do not fulfill the mandatory Nebius/NVIDIA usage requirement.
