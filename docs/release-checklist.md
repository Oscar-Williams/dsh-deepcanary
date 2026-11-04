# Release guide

[简体中文](release-checklist.zh-CN.md) · [Development](development.md)

Each release has one reviewed source commit and one frozen package.

## Prepare

1. Complete the intended changes and fix failures that affect them.
2. Align the English and Chinese instructions, version identifiers, compatibility, and changelog.
3. Run affected tests and the final candidate checks. Reuse valid results for unchanged inputs.
4. Check documentation rendering, links, package contents, runtime dependencies, and pending Git changes for private material.
5. Commit source, documentation, and generated `lib/`.
6. Run `node scripts/freeze-local-candidate.mjs <version>`. Keep the tgz and manifest unchanged.
7. Install the package on the supported hosts and confirm the loaded version after restart.

Use the same file on alpha.3/RC5 × Web/Desktop. Identify the fixed source alpha.3 Desktop build as unsigned. For documentation changes, confirm package installation and loading while reusing earlier behavior checks with their original identities.

## Publish to GitHub

Push the reviewed commit and wait for its required CI jobs. Correct failures before creating the version tag.

Create the tag at that commit. Prepare a GitHub release draft with concise English and Chinese notes, the frozen tgz, and its checksum file. Mark an RC version as a prerelease. Verify the uploaded asset before making the release public.

Keep process logs, device records, authentication data, and local reports outside Git and release assets. Publish the plugin package, its checksum, and user documentation.

## Publish to npm

Choose the intended npm tags explicitly. Authenticate with an account that has package publication permission.

```sh
npm publish <frozen-file.tgz> --tag next --access public
```

Download the registry tarball into a separate directory and compare its SHA-256 and integrity with the frozen file. Update `latest` only when that channel is part of the release decision.

GitHub and npm can be published separately. Read the actual channel state before resuming an interrupted publication.

## Preserve versions

A published version is immutable. Changes to package contents use a new version. Keep earlier package bytes locally and identify the checks that apply to each release.
