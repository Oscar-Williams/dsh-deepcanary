# Web and Desktop acceptance

DeepCanary 0.1.8 supports DSH 0.2.1-rc.5 and 0.2.2-alpha.3 with one package and interface. Test profiles have separate state and share no daily credentials or reminder files.

## What to verify

| Observation | What it establishes |
| --- | --- |
| Installation through the host CLI or manager | The host accepts the package and resolves its dependencies |
| Comparison with the frozen manifest | Installed files match the candidate |
| Cold start and loaded plugin version | The running host loaded that candidate |
| Native question or approval | Authoritative C3 classification and closure |
| Automation run in a reused session | The new occurrence uses its own trigger and execution boundary |
| Browser or Desktop interaction | Layout, input, focus, and navigation behavior |
| Native notification show and click | Delivery and activation of that notification |

Use one frozen file on alpha.3/RC5 × Web/Desktop. For a package containing only documentation and a version change, confirm installation and loading; reuse unchanged behavior from the preceding candidate and identify that evidence explicitly.

## Observed 0.1.8 behavior

The four host combinations have installed and loaded the frozen rc.2 package. Native questions, late replies, approvals, cancellation, and automation have targeted real-host results. Explicit user cancellation stays in Activity and produces no interruption.

Both Windows Desktop builds have notification observations. The operator confirmed visible system banners and return to the corresponding reminder. The alpha.3 build is unsigned and comes from fixed source; RC5 uses the official application.

A real daily Web question produced a native notification while the DSH page was hidden. Native show and click events were recorded, the correct session was selected, and the answered question closed. The operator confirmed notification and return behavior.

Actual Edge browser zoom at 200% reduced the CSS viewport from 1544×661 to 772×330. The panel and visible controls stayed inside it. The browser was restored to 100%. Other layout, theme, keyboard, touch-emulation, migration, and controlled-load results retain their recorded candidate identity.

## Lifecycle boundaries

Keep the host and a renderer running for notifications. Browser permission, Windows notification settings, quiet hours, and delivery policy affect system banners. Closing a Desktop window can hide it while the application continues running. Fully quitting the application stops the plugin.

A notification click opens its current reminder and session when available. A removed or stale target returns to the inbox with an explanatory message. A notification never finishes the native task.

## Record and reuse results

Record the package version, hash, host build, profile, observation time, and actual outcome. Keep controlled samples distinguishable from natural use.

Run a failed or affected case again after fixing its cause. Reuse successful results for unchanged code. Physical touch hardware, other operating systems, and untested future hosts remain outside the observed coverage.
