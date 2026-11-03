# Local candidate and publication

1. Complete core reliability, task organization, Inbox interactions and settings. Repair discovered defects in the current step; preserve valid historical data.
2. Run verify:candidate once for the final inputs. Include RC5 on Node 22, privacy, migration, cancellation, concurrent actions, notification claims and automation Session reuse. Re-run a gate only when a change or failure invalidates it.
3. Capture the implemented UI with the same real Host sample content in light/dark themes, 1440/1024/360 px, 200% zoom, keyboard and touch. Verify all window interactions and scoped load behavior.
4. Synchronize English/Chinese documentation and tracked lib. Commit only intended public files. Freeze one tgz with file whitelist, content scan and hashes.
5. Install that tgz in alpha.3/RC5 × Web/Desktop. Check first install, upgrade, restart, actual loaded identity, question/approval closure, precise return and front/background/hidden notification behavior. Record actual evidence and external capability gaps; do not mark unobserved behavior passed.
6. Back up daily configuration and necessary state. Upgrade daily Web and official Desktop to RC5 with the verified package, preserving home, profiles, Sessions and workspace registration; check continuity.

The local delivery contains the candidate, its checksum/manifest, source commit and actual acceptance record. A source-built alpha.3 Desktop is labeled unsigned/local. An unavailable official alpha.3 installer does not prevent using that fixed-source build for plugin testing.

GitHub push, remote CI, Release and npm publication require a later user instruction. When authorized, use the frozen file and compare its SHA-256 rather than repacking or repeatedly inspecting file lists. Keep the chosen prerelease npm tag explicit; do not silently promote a candidate to latest.
