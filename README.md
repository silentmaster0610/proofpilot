# ProofPilot

**Your life admin, with receipts.** Turn invoices and policies into a reviewable warranty or expense-request draft, with source quotes, explicit approval, an email file and an action receipt.

Built for the **Best Apps and Agents** track of the Nebius × NVIDIA Global AI Hackathon. This version is a standalone Next.js app, ready for GitHub and a free Render web service. It no longer requires ChatGPT Sites authentication or Cloudflare D1.

> Current status: the complete fictional sample workflow runs without an API key. The NVIDIA Nemotron 3 Super integration is implemented but **live inference is deferred and unverified**. A real Nebius run is still required for hackathon eligibility. The public repository is [silentmaster0610/proofpilot](https://github.com/silentmaster0610/proofpilot). Free Render deployment and a public demo video are in progress/pending.

## Run locally

Requires Node.js 24 and npm. Windows, macOS or Linux:

```sh
npm ci
npm run setup
npm run dev
```

Open [localhost:3000](http://127.0.0.1:3000). Select **Try the sample workspace**; no account or API key is needed. For your own documents and memories, open the generated, ignored `.env` file and copy `PROOFPILOT_OWNER_KEY` into the login form. Do not share the owner key or commit `.env`.

The setup command preserves existing environment files. Local data is stored in `data/proofpilot.sqlite` and initialized automatically. Back up that file when the app is stopped, or export your workspace from Settings. A sample session expires after one day; owner/judge sessions expire after 30 days. Owner data remains across sign-ins. Each judge/sample sign-in has a separate workspace; expired non-owner data is cleaned by the reminder scanner.

Production build and local preview:

```sh
npm run build
npm start
```

## Try the complete sample

1. Sign in to the sample workspace, then choose **Try a sample claim**.
2. Open the fictional invoice and policy from Selected evidence.
3. Prepare the sample claim. Expand each fact to see the exact source quote.
4. Review the recipient and text; edit the draft if desired. Editing changes its approval fingerprint.
5. Tick the review checkbox and create the email draft.
6. Download the `.eml`, JSON receipt and `.ics` calendar reminder. Reload to check persistence.
7. Switch between light and dark themes; the layout adapts to mobile screens.

The sample is deterministic. It never calls a model or silently substitutes for a failed live call. The email file is an **unsent draft**, and no merchant submission happens automatically.

## What is implemented

- Private owner workspace and isolated judge/sample sessions using random HttpOnly session cookies, hashed server-side tokens and origin checks.
- Document vault for pasted text and `.txt`, `.md`, `.eml` imports; saved preferences with individual cloud-sharing choices.
- Warranty and reimbursement skills; only selected documents and opted-in memories reach the model.
- NVIDIA Nemotron 3 Super adapter with schema, exact-quote and recipient checks, request metadata and explicit failure handling.
- Review and editing, approval bound to the draft and evidence fingerprints, idempotent draft creation and SHA-256 action receipts.
- Persistent reminders, calendar export, workspace export, and a server reminder scanner while the process is running.
- Larger typography, light/dark palettes, responsive navigation and keyboard-accessible dialogs.

## Free Render deployment

See [deployment guide](docs/DEPLOYMENT.md). `render.yaml` defines exactly one **free** web service; no paid disk, worker or database is provisioned. Durable remote storage uses a separately configured **Turso Free** database. Local SQLite must not be used for durable data on Render's ephemeral filesystem.

The public GitHub repository and Turso Free database are available. Render deployment requires the database token. Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` as private Render environment values. The Blueprint generates separate owner and judge keys. Keep the owner key private; give judges only the judge key if they need real-input access. The public sample requires no key.

Free Render sleeps when idle. Reminder scans resume after wake-up; this is not an always-on service. Calendar reminders work independently after importing the `.ics` file. No keep-awake service or paid resource is configured.

## Enable live Nemotron later

Add `NEBIUS_API_KEY` to ignored `.env.local` locally, or as a Render environment secret. Restart/redeploy. Never put it in `NEXT_PUBLIC_*`, source code or a screenshot.

- API base: `https://api.tokenfactory.us-central1.nebius.com/v1`
- Default model: `nvidia/nemotron-3-super-120b-a12b`
- Override: `NEBIUS_MODEL` accepts NVIDIA Nemotron identifiers.
- Daily limit: `LIVE_DAILY_LIMIT` defaults to 30 calls per role across sessions. This limits calls, not spending. Provider billing/credits are controlled separately; this task authorizes no paid usage.

In the owner/judge workspace, add an invoice and a policy, create a task, explicitly consent to cloud processing and run it. Check the actual model, request ID, token use and duration in Activity. A configured key alone does not prove access. The code records the model actually used and does not fabricate inference receipts.

References: [Nebius Nemotron](https://nebius.com/services/token-factory/nemotron), [official Super cookbook](https://github.com/nebius/token-factory-cookbook/blob/main/models/nemotron/nemotron3-super-120B.md).

## Architecture

```text
Next.js dashboard -> session + origin checks -> versioned libSQL workspace
  -> selected evidence + opted-in memory -> Nebius / NVIDIA Nemotron
  -> schema + quote validation -> review + exact-payload approval
  -> unsent email file + action receipt + reminder
```

- `lib/domain.ts`: data model, validation, sample fixture, email generation and hashes.
- `lib/agent.ts`: model prompt, provider call, output checks and inference metadata.
- `lib/auth.ts`: access keys, sessions and origin validation.
- `app/api/workspace/route.ts`: permission checks, transitions, optimistic concurrency and approval.
- `db/index.ts`: automatic SQLite/libSQL schema initialization; local or Turso storage.
- `lib/scheduler.ts`: due reminder scans and expired session cleanup.
- `app/dashboard.tsx`, `app/design.css`: product interface and themes.

No agent can directly send messages, browse arbitrary sites or run tools. Exact quoting establishes textual provenance, not factual correctness or claim eligibility. Receipts detect content changes; they are not independently signed or tamper-proof attestations. Hosting/database administrators can access stored data. This is a single-owner application with scoped judge/sample access, not a general multi-user account service.

## Verification

```sh
npm run test:domain
npm run build
npm run test:api
npm run typecheck
```

API tests launch the production server on a random loopback port with an isolated SQLite database, no provider key and generated test credentials. They do not touch owner data or make live model calls. See [verification record](docs/VERIFICATION.md).

## Optional external reminder runner

The app already scans every minute while awake. For a separately managed runner, create a scoped token in Settings, put it in ignored `.worker.env` based on `.worker.env.example`, then run:

```sh
node --env-file=.worker.env scripts/followup-worker.mjs --once
```

Omit `--once` for a local process that scans every minute. Tokens can be rotated/revoked. The endpoint returns counts only and cannot read documents, approve drafts or send email. No external scheduler is deployed, and the supplied free hosting setup does not guarantee uninterrupted scans.

## Current limits and submission

Live inference, public hosting, video upload and actual platform feedback remain pending. No email sending, inbox connector, PDF/image OCR, automatic policy retrieval or merchant claim submission is implemented. Do not present the sample as live AI.

See [submission checklist](docs/SUBMISSION.md), [description draft](docs/PROJECT-DESCRIPTION.md) and [three-minute demo plan](docs/DEMO.md). Public entry and acceptance of hackathon rules remain with the team.

Design inspiration: generous typography and spacing from the [Awwwards UI directory](https://www.awwwards.com/websites/ui-design/) and [Flux Theory reference](https://www.awwwards.com/sites/flux-theory). No third-party artwork or site code was copied.

## License

[MIT](LICENSE) for ProofPilot. Dependencies and NVIDIA models retain their respective licenses and terms.
