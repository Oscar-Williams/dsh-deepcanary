# Security policy

[简体中文](SECURITY.zh-CN.md) · [Data and privacy](docs/security.md)

## Report a vulnerability

Use [GitHub's private vulnerability report](https://github.com/Oscar-Williams/dsh-deepcanary/security/advisories/new). Include the affected versions, a minimal reproduction, expected and observed behavior, and the potential impact.

Remove credentials, authentication URLs, and private conversation content from attachments. An ordinary bug without security impact can be reported through [Issues](https://github.com/Oscar-Williams/dsh-deepcanary/issues).

## Supported versions

Security fixes target the current 0.1.8 release line. Use the newest published version in that line and a DSH version accepted by its compatibility declaration. Older DeepCanary release lines receive no separate backports.

The [changelog](CHANGELOG.md) identifies dependency and security fixes. [Compatibility](docs/compatibility.md) lists supported hosts and actual verification scope.

## Data and permissions

DeepCanary runs inside DSH and uses its authenticated public services. Its actions manage reminder metadata and return to native DSH interfaces. Conversation content and credentials stay outside the reminder ledger.

Profile data and notification previews can still reveal information about your work. Protect access to the host and its profile, and choose system notification settings appropriate to your environment.

See [Data and privacy](docs/security.md) for stored fields, transport, migration, and delivery behavior.

## Update safely

Use the DSH plugin manager or the matching host CLI. Download release files from this repository or the npm package and verify supplied checksums. Keep the existing home and profile when upgrading.
