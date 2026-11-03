# Inbox screenshots

The English and Chinese images in `assets/deepcanary-panel-*.png` were captured from the running 0.1.8-rc.1 client in DSH 0.2.2-alpha.3 on 4 November 2026 (Asia/Shanghai). The Host source is pinned to `05b1cae8db6e674c5685101494d4eec24652424a`.

The samples use actual public Host services in an isolated profile: a timed question, a background Node job that exits with code 1, and a completed Session. These are controlled acceptance samples, not user conversations or model-quality results. Session titles remain in the Host; DeepCanary resolves them for display without retaining their text in its ledger.

Playwright captured the implemented panel directly. No mockup, composited UI or edited notification is used. The dark appearance follows the Host theme. The 880 px panel is constrained by the current browser height; full-window, light-theme and responsive checks are retained with the local acceptance evidence rather than included in the npm package.
