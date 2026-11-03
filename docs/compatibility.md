# Host compatibility

DeepCanary 0.1.8 uses one package for DSH 0.2.2-alpha.3 and 0.2.1-rc.5, on WebUI and Windows Desktop.

```json
"engines": {
  "node": "^22.19.0 || >=24.0.0",
  "dsh": "0.2.1-rc.5 || >=0.2.2-alpha.3"
}
```

The alpha.3 Host requires Node >=24.9.0; RC5 also accepts Node 22.19+. The plugin emits ES2022. Host services are supplied by the Host, without installing a second service graph through plugin peers.

| Contract | Shared behavior and adapter boundary |
| --- | --- |
| Session events | Public snapshots and sequence watermarks; fork inheritance is excluded from new observations |
| Projections | Await registration before inspecting its resolved shape; RC5 disposer and alpha.3 asynchronous handle both release on unload |
| Jobs | Public owner, lifecycle, counts and settlement; subscription depends on both jobs and sessions |
| Questions | Watermark-checked userQuestions projection, exact call identity and open/continued/settled state |
| Automation | RC5 Session binding and alpha.3 target-session receipts normalize to schedule occurrence + admitted message + execution boundary |
| Menus | alpha.3 unified context menu; RC5 public session slots and the Inbox's keyboard/context menu |
| Settings | Shared revision-aware ConfigForm; alpha.3 settings.section.icon is optional and disposable |
| Notifications | Public renderer capability only; no private Electron bridge or invented wake API |

The declared range admits later DSH releases without an upper bound or whitelist. A future release is verified only after actual installation and runtime checks. Newly optional services cannot be imported as hard runtime dependencies on RC5.

Current local acceptance is tracked separately from the declaration. A source-built alpha.3 Desktop is an unsigned local build, not evidence for an official signed alpha.3 installer. Immutable older receipts describe their own versions.
