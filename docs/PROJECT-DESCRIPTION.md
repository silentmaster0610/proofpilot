# ProofPilot — project description draft

**Tagline:** Your life admin, with receipts.

**Category:** Best Apps and Agents.

## What it does

ProofPilot helps people turn invoices and policies into a clear next step for a warranty claim or expense request. It gathers only the documents the user selects, prepares a draft with source quotations, and lets the user inspect and edit every word before creating an email file. Each approved draft has a receipt recording its content fingerprint, evidence fingerprints and approval time. Saved preferences and calendar-exportable follow-ups help the user continue later.

## Why we built it

The friction in a claim often comes before sending it: finding the right invoice, locating the relevant policy, explaining the problem and remembering to follow up. ProofPilot puts those steps in one reviewable workflow. Its focus is traceable preparation and user control, not predicting what a merchant will decide.

## How it works

The app uses Next.js, React and SQLite/libSQL storage. Private sessions separate owner data from visitor and judge workspaces. A Nebius Token Factory adapter is implemented for NVIDIA Nemotron 3 Super (`nvidia/nemotron-3-super-120b-a12b`). It sends selected documents and explicitly enabled preferences, requests structured output and checks source quotes before presenting a plan. Approval is bound to the exact draft and evidence; edits invalidate previous approval. The executor creates an unsent `.eml` artifact, action receipt and reminder.

**Current validation note:** the sample workflow is working and deterministic. Live Nebius inference has been deferred until an API key is available; it has not yet been demonstrated. Replace this note only after completing and recording a successful provider run. Explain how Token Factory helped based on that actual experience.

## Design and scope

Readable typography, responsive layouts and light/dark themes keep the evidence and approval steps easy to follow. The app does not send email automatically, submit merchant claims, process PDF/image OCR or monitor an inbox. Reminders are stored in the workspace and can be exported to a calendar. Free hosting can sleep, so background scanning is not continuous.

## Before pasting into Devpost

Add the verified public demo/repository/video URLs, actual platform feedback and earlier-project disclosure. Review every sentence against the recorded build. Do not imply live AI is working until it has been tested.
