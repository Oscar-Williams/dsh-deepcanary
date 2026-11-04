# Security policy

[简体中文](SECURITY.zh-CN.md) · [Data and privacy](docs/security.md)

## Report a vulnerability

Use [GitHub's private vulnerability report](https://github.com/Oscar-Williams/dsh-deepcanary/security/advisories/new). Include the affected versions, a minimal reproduction, expected and observed behavior, and the potential impact.

Remove credentials, authentication URLs, and private conversation content from attachments. An ordinary bug without security impact can be reported through [Issues](https://github.com/Oscar-Williams/dsh-deepcanary/issues).

## Supported versions

| DeepCanary | DSH | Security updates |
| --- | --- | --- |
| `0.1.9-rc.1` | `0.2.1-rc.5` or `>=0.2.2-alpha.3` | Current |
| Earlier releases | See the documentation for that release | Upgrade to the current release |

Install the current release to receive security fixes. Keep your DSH data directory and profile when upgrading. [Update instructions](README.md#update-or-remove) · [Changelog](CHANGELOG.md) · [Compatibility](docs/compatibility.md).

## Data and permissions

DeepCanary reads task state through authenticated DSH APIs and keeps reminder metadata in your DSH profile. The reminder files can reveal when you worked and which sessions needed your attention. Restrict access to the profile and review your system's notification preview settings. [Data and privacy](docs/security.md).
