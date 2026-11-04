# Data and privacy

[简体中文](security.zh-CN.md) · [Security policy](../SECURITY.md) · [Documentation](README.md)

## Stored data

DeepCanary stores reminder metadata in the selected DSH profile. It includes identifiers needed to return to sessions, hashed joins, reason codes, task and reminder states, snooze times, budgets, and bounded delivery records.

Session titles are resolved from the running host for display. Conversation text, prompts, answers, tool arguments, model output, credentials, and raw failure text are excluded from the reminder ledger. Tool failures contribute a tool name, a safe error category, or an exit code.

Treat profile data as private. Metadata and identifiers can describe work even without conversation text.

## Local decisions and actions

Reminder decisions use deterministic local rules. A current authoritative question or approval is required for C3. Explicit user cancellation uses the public outcome enums.

Plugin actions acknowledge, snooze, mute, or annotate reminders and navigate to DSH. Task execution, question answers, and approval decisions use DSH's native flow.

## Authentication and concurrency

Routes under `/api/dsh-deepcanary/` use DSH's authenticated Connection Fetch registry. Write bodies are bounded. Protocol 3 checks request identity, revision, and execution generation; notification callbacks also carry their notification generation.

One host owns each ledger. Pages connected to that host share state. Different profiles keep separate ledgers.

## Persistence and migration

The store writes schema 2 atomically and preserves schedules, budgets, and delivery claims. Existing valid data is migrated. Invalid or unsupported data is retained and reported as an activation error.

A notification claim must be saved before construction is authorized. Failed saves pause authorization and expose a retry.

## Notifications

Notification bodies use localized summaries. Windows and browser permissions control where they are displayed. A banner can be visible outside the DSH window, including on a lock screen if system settings allow it.

Construction, delivery, visibility, and click are recorded separately. Notification delivery never finishes the underlying task.

To report a vulnerability, use the private channel in [Security](../SECURITY.md). Ordinary reports should include only the minimum information needed to reproduce the problem.
