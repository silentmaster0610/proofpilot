# Deploy using free services only

The user has authorized **no paid resources**. The included Blueprint requests `plan: free` with no persistent disk, worker, cron job or Render Postgres. Do not change plans or add payment details.

## Current publishing state

The local Next.js build is verified. The public repository is https://github.com/silentmaster0610/proofpilot. The application source and MIT license are published. A Turso Free database named `proofpilot` exists in Mumbai, with a database-specific 90-day token. The free Render service is https://proofpilot-5ij0.onrender.com. Its production build succeeded and Render reports the process live; database secret import and end-to-end verification remain pending. The old ChatGPT Site is a separate earlier version and does not contain these updates.

### Finish the existing deployment

1. Open [the ProofPilot Render service](https://dashboard.render.com/web/srv-dbclk68m7kps73c4viog), then **Environment → Add from .env**.
2. Copy the locally prepared, ignored `.env.render-upload` file into that field. This includes the database credential and separate generated owner/judge keys. Never send this file in chat or publish it. Import/overwrite matching environment variables and choose **Save and deploy**. No rebuild is needed for these runtime values.
3. In the service's Settings, set **Health Check Path** to `/api/health`. The connector-created service initially uses Render's default TCP health check; a running process alone does not confirm database access.
4. Complete the verification below before advertising the URL as a working demo.

Dashboard browser access was denied by its saved permission gate, so the private import requires the owner's action. The secrets were not printed in tool output. Follow Render's [environment import documentation](https://render.com/docs/configure-environment-variables).

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

Set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `REQUIRE_REMOTE_DB=true`, `FOLLOWUP_SCANNER=true`. Users create their accounts on `/login` with an 8-character-or-longer password. `PROOFPILOT_OWNER_KEY` and `PROOFPILOT_JUDGE_KEY` are optional legacy/invitation credentials; the Blueprint generates them automatically. Do not reuse local development keys in public hosting. Existing owner data can be linked to an email/password account only by proving possession of its existing key.

### Database authentication troubleshooting

On 22 October, Render logs showed libSQL HTTP 401 during sign-in. A read-only `SELECT 1` using the privately saved Turso token succeeded, isolating the problem to the deployed database configuration. Copy only the token value (without `TURSO_AUTH_TOKEN=`) into Render's environment field and choose **Save and deploy**. The locally ignored `.env.turso-token.txt` contains just that verified token for easy copying. Never commit it or paste it into chat. The new sign-in handler returns a readable JSON error when storage is unavailable, and the page handles empty upstream responses.

The server tolerates surrounding whitespace, matching quotes and a single `TURSO_AUTH_TOKEN=` assignment prefix. Startup logs report only the token format (`missing`, `multiple_lines`, `jwt` or `unrecognized`) and the connection result; no token, URL, payload or credential digest is logged. `ProofPilot database connected; schema ready.` confirms the deployed server has reached the database and initialized its schema.

### Using an existing Render Secret File

Secret Files are mounted files; their contents do not automatically become environment variables. For this service, the owner confirmed the filename is `proofpilot`. Set the non-sensitive environment variable `TURSO_AUTH_TOKEN_FILE=/etc/secrets/proofpilot` and deploy. The app reads exactly that configured file, without scanning other files. It accepts a raw token, a dotenv file containing `TURSO_AUTH_TOKEN`, or the prepared JSON form containing `tursoAuthToken`. It reads only the database token, not other credentials in the file. A non-empty `TURSO_AUTH_TOKEN` environment value takes precedence. Missing, unreadable, oversized or malformed files fail closed with a sanitized error. See [Render Secret Files](https://render.com/docs/configure-environment-variables#secret-files).

Leave `NEBIUS_API_KEY` unset for this sample-only release. The Blueprint intentionally does not require it. The model default is configured for later use. Render supplies `RENDER_EXTERNAL_URL`; set `APP_URL` only when using a different canonical domain.

## 4. Verify before sharing

Wait for Render to report a successful live deployment. Open `/api/health`, test the public sample workflow, reload and verify saved data, and confirm private owner data is inaccessible from a new sample session. Recheck persistence after a restart with the remote database connected. Do not claim deployment success from a configuration file alone.

Free Render instances sleep after inactivity and can take time to wake. Follow-up checks run only while awake. See [Render free service limitations](https://render.com/docs/free). No service to prevent sleeping is configured.

## Later live AI verification

The team must supply Nebius access with available free credits if it wants to avoid payment. Configure the server secret, perform a consented real-input run, and preserve actual request metadata for the demo. A source adapter and deterministic sample alone do not fulfill the mandatory Nebius/NVIDIA usage requirement.
