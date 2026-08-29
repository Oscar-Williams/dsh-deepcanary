# Release checklist

## Runtime and source

- [ ] Confirm the official DSH release tag and update README.md, README.en.md, CHANGELOG.md, and docs/compatibility.md together.
- [ ] Use a clean, isolated DSH_HOME for the public installation check.
- [ ] Verify dsh --version, dsh --profile web --dump-config, and a real dsh web startup.
- [ ] Do not use an older npm runtime directory as an implicit test baseline.

## Plugin gates

- [ ] npm run typecheck
- [ ] npm run typecheck:tests
- [ ] npm test
- [ ] npm run build
- [ ] npm run verify:distribution
- [ ] npm pack --dry-run contains lib/, docs, license, and bundle patch, and excludes source/tests/state.
- [ ] AttentionGold scenarios pass without network access.
- [ ] State persistence test confirms prompts and raw Session/Workspace identifiers are absent.

## Integration

- [ ] Install the built package into the official alpha Web profile with dsh plugin --profile web add.
- [ ] Confirm the bundle patch is active and the plugin tools are registered.
- [ ] Confirm /dsh-deepcanary/health returns HTTP 200.
- [ ] Confirm the client script is injected and the inbox can acknowledge/snooze an item.
- [ ] If a settings provider is mounted, confirm the dsh-deepcanary namespace resolves and live policy changes take effect.
- [ ] Restart/unload the profile and confirm no duplicate routes or tools remain.

## Publication

- [ ] Update version, lockfile, README links, and changelog together.
- [ ] Publish only after the immutable tag used in the README exists.
- [ ] Record the exact DSH tag, commit, Node.js, pnpm, OS, and gate results in benchmark/release-receipt.json.
