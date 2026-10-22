# Submission readiness — 22 October 2026

Official [rules](https://nebiusglobalaihackathon.devpost.com/rules) and [challenge](https://nebiusglobalaihackathon.devpost.com/).

Recommended category: **Best Apps and Agents**. The free hosting setup may sleep, so do not describe it as an always-on Personal AI system.

Deadline from the official rules: **30 October 2026, 10:00 AM PDT / 10:30 PM IST**. Keep the demo and repository accessible through the judging period, ending 15 December 2026. Confirm the official page before submitting in case the organizer changes the schedule.

| Requirement | Current status | Remaining action |
| --- | --- | --- |
| Working application | Local sample verified; free Render server deployed | Import database secret and verify the hosted workflow |
| NVIDIA open-source model on Nebius | Nemotron 3 Super adapter implemented | API key/free credits and successful live run; deferred by owner |
| Category | Best Apps and Agents recommended | Select it in Devpost |
| Project description | English draft included | Add final links and verified live results |
| Working demo URL | [Render URL](https://proofpilot-5ij0.onrender.com) assigned and server deployed | Complete private configuration and end-to-end verification |
| Public repository and open-source license | [Public GitHub repository](https://github.com/silentmaster0610/proofpilot), source, README and MIT license published | Complete |
| Setup guidance | Updated README and deployment guide included | Verify from a fresh clone after publication |
| Public YouTube video, maximum 3 minutes | 2:45 script included | Record real working version and upload publicly |
| Platform/model feedback | Evidence template included | Write feedback after actual Nebius use |
| Earlier-project disclosure | Template below | Confirm actual dates and significant changes |
| IRL city | Not supplied | Select only if the team actually attended |

## Submission blockers

**A sample-only build is not yet eligible.** A real NVIDIA model call through Nebius Token Factory or NVIDIA model deployment on Nebius AI Cloud is mandatory. Render frontend hosting is compatible with using Token Factory for inference, but Render alone does not fulfill the Nebius requirement.

GitHub source is public, the free database exists, and the free Render server has deployed. A database authentication error in Render requires correcting its private token before hosted workflow verification. Browser access was denied, so that private field requires the owner's action. Email/password signup now supports passwords from eight characters and persistent, isolated accounts. No paid service has been created. Video recording/upload, live feedback, registration, eligibility declarations and final submission remain with the team.

## Product scope for judging

Demonstrate a specific audience: people preparing warranty and expense requests from paperwork they already have. Show selected evidence, exact source quotations, review/editing, approval, an unsent email artifact, receipt and calendar follow-up. The implemented action is creating an email file; do not claim automatic delivery, merchant acceptance or independently verified eligibility.

## Earlier-project disclosure — complete if applicable

“ProofPilot [did/did not] exist before the official submission period. Earlier work consisted of [describe and date it]. During the submission period, we significantly updated [verified changes and dates].”

The current work includes a standalone Node/Next.js migration, independent session authentication, Turso-compatible persistence, larger typography, responsive light/dark themes, review and receipt flows, and a configurable Nebius Nemotron adapter. Do not assign these changes to the official period without checking the actual dates.

## Feedback evidence to collect

- Model and endpoint actually used; date and request IDs.
- Latency/token usage from real runs, with sample count.
- Whether structured output and exact source quoting succeeded.
- Concrete failures, retries and missing-information cases.
- What Nebius/NVIDIA features helped, and one specific improvement request.

No platform feedback or performance statistics have been invented. The team must review and accept the official rules itself; this development task has not submitted an entry.
