# dsh-deepcanary

> DeepCanary watches your agents so you don’t have to.

dsh-deepcanary is a local attention-supervision plugin for DeepSeek Harness. It turns Session, Tool, Agent, and Subagent runtime facts into traceable signals, then applies deterministic policy to decide what can stay quiet and what deserves a human’s attention.

The package is currently 0.1.0-rc.1. Its test baseline is the official dsh-v0.1.2-alpha.1 source checkout. At the time of this verification, the alpha was not available as an npm package, so the supported setup is the upstream checkout followed by pnpm install, pnpm run build, and the source CLI. The old npm 0.1.1-rc.2 runtime is not the test baseline.

## What it does

- observes Human Needed, suspected stalls, tool-failure loops, context pressure, subagent pressure, and completion signals;
- uses C0–C3 attention levels, deduplication, bundling, and an hourly interrupt budget;
- adds a small Web inbox with gray/yellow/orange/red status;
- supports acknowledge, snooze, mute, feedback, and navigation hints;
- never terminates or restarts a task, approves or rejects a request, or executes arbitrary commands.

The guiding rule is evidence before escalation. Model judgment is optional; the final level remains deterministic, and C3 requires Host or Runtime authority.

## Install against official alpha.1

Requirements: Node.js 22.19+ and pnpm 11.7.0. The local verification used Node.js 24.

    git clone --depth 1 --branch dsh-v0.1.2-alpha.1 https://github.com/deepseek-ai/deepseek-harness.git dsh-runtime-alpha1
    Set-Location .\dsh-runtime-alpha1
    npx --yes pnpm@11.7.0 install
    npx --yes pnpm@11.7.0 run build
    npx --yes pnpm@11.7.0 dsh --version

The last command should print 0.1.2-alpha.1. See the official [dsh-v0.1.2-alpha.1 release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.1).

Build and install the plugin from the DSH checkout:

    Set-Location F:\Agent_Related\ZCode_Related\plugin2
    npm install
    npm run build

    Set-Location F:\Agent_Related\Deepseek-Harness_Related\dsh-runtime-alpha1
    npx --yes pnpm@11.7.0 dsh plugin --profile web add F:\Agent_Related\ZCode_Related\plugin2
    npx --yes pnpm@11.7.0 dsh web

After changes, rebuild the plugin and update the profile dependency:

    npx --yes pnpm@11.7.0 dsh plugin --profile web update dsh-deepcanary

## Development

    npm install
    npm run typecheck
    npm run typecheck:tests
    npm test
    npm run build
    npm run verify:distribution
    npm pack --dry-run

The package builds from src/ to lib/. The bundle entry is declared in cordis.patch.yml; production installations should use a built package or immutable Git tag.

## Privacy and safety

By default, ~/.dsh/dsh-deepcanary/inbox.json contains only timestamps, levels, stable reason codes, hashed Session/Workspace references, evidence summaries, and feedback. Prompts, model output, tool arguments, credentials, and full conversation content remain in DSH.

See docs/architecture.md, docs/security.md, and docs/release-checklist.md.

## License

MIT
