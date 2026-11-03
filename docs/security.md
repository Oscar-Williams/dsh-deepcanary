# Security and privacy

DeepCanary performs local reminder metadata changes and public navigation. It does not approve, reject, restart, terminate, execute a shell command, or answer a question on the user's behalf.

All /api/dsh-deepcanary routes use the Host's authenticated connection.fetch registry. There is no unauthenticated WebServer fallback. Request bodies are bounded; protocol 3 requires action identity and revision checks. Claims and callbacks are fenced by notification generation.

Persistent state contains opaque Session identities needed for navigation, hashed joins, reason codes, structured task and reminder states, budgets and bounded delivery records. Local profile paths and credentials stay outside the package and repository.

Tool failure collection reads only public tool identity and structured outcome metadata. It does not copy, truncate or hash error.message, raw tool output, command arguments, prompts, answers, model output or trajectory text. This includes alpha.3's preserved raw failed-tool results.

A save must succeed before notification construction is authorized. A failed save exposes an error and pauses authorization until retry succeeds. Corrupt or unknown metadata remains intact; migration logic is repaired for valid historical structures rather than discarding them.

The package uses a public file whitelist. The freeze command scans package contents and new Git blobs, records file hashes and one immutable tgz. Device installation checks consume that manifest. Browser authentication URLs and automation tokens remain in process memory and never enter public documentation, screenshots or package files.

Notification text uses localized safe summaries. OS/renderer delivery and visibility have explicit evidence levels; a constructor return value is not a visibility guarantee.
