# Data and privacy

[简体中文](security.zh-CN.md) · [Security policy](../SECURITY.md) · [Documentation](README.md)

## Where data is stored

By default, DeepCanary stores data in `profiles/<profile>/state/deepcanary/` inside your DSH data directory. The default directory for DSH data is `~/.dsh`. If you set `DSH_HOME`, start from that directory instead.

- `inbox.json` contains reminder states and times, session identifiers for navigation, task references, snooze schedules, notification limits, and recent delivery records.
- `suppressions.json` stores the types of reminders you have muted.
- `outcomes.json` records feedback on reminders and whether the corresponding task recovered.
- DeepCanary asks DSH for the current session title when displaying a reminder. It leaves titles, conversation text, prompts, answers, tool arguments, model output, credentials, and raw error messages out of the inbox file.

Keep the DSH directory private. Session identifiers and timestamps can still reveal information about your work.

## Access and updates

The inbox uses requests to the same DSH origin. DSH checks the request origin and authentication before routing it to `/api/dsh-deepcanary/`. DeepCanary limits JSON writes to 32,000 bytes and checks that a reminder still matches the state shown in the browser before changing it.

Each profile has its own reminder files. Pages connected to the same running profile share them. DeepCanary saves a record of each delivery attempt before it requests a system notification. After a restart, it uses the saved records to avoid repeating alerts.

If a save fails, check that the account running DSH can write to its profile directory, then click **Refresh status** in the inbox. DeepCanary pauses system alerts while it cannot save their state.

## Notifications

System banners display localized summaries. Depending on your browser and operating system settings, a banner can appear outside DSH or on the lock screen. Adjust system notification previews if you work with sensitive tasks.

Use the private reporting form for vulnerabilities. [Security policy](../SECURITY.md).
