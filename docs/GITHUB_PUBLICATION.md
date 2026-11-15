# GitHub source publication

**Final English release:** built source `78e29b929bc007814ea137043fdb23829f56645b` follows the English branch; subsequent changes package the reviewed PowerPoint/PDF, submission text and evidence. Apache-2.0 and third-party notices are explicit. [Current release](REVISION_PRESENTACION_FINAL.md). Earlier anonymous-clone records below identify their own snapshots.

**Current jury release, 15 November 2026:** the existing repository is reused with its full history. The deployed build is commit `29a4d63a9259c9f6ee8c8dde393cfcf23e29bb49`, following `cb2a0b0`; subsequent documentation/material changes preserve its runtime-input hashes. Current checks passed **37 routing/worker + 35 interface/science Vitest tests** and **22 Python tests** in the original-data environment, plus build/typecheck. [Release, HTTPS evidence and recovery](MEJORA_FINAL_JURADO.md). The account creation, file counts and reproduction scope below describe the initial publication, not this later release.

The improvements were fast-forwarded to `main` at `9fc031a7df38a2fbb2ae268524e408038f9fe8b9` and pushed without force, together with `before-jury-release-20261115`. A fresh anonymous clone matched all 410 reviewed files, all 63 production runtime inputs, and both validated presentation files. [Executed public verification](jury-release-20261115/public-source-verification.json). The subsequent audit-record commit changes documentation only.

Published on **15 November 2026** in the owner's account:

**https://github.com/EduardoManzanoAlcaraz/mars-pathfinder-the-meowrtian**

The account was checked before creation: 10 owned repositories were inspected, with no existing Mars/Meowrtian/Pathfinder repository. A new public repository was created. Other applications were not modified.

## Pinned code snapshot and public verification

Original source-publication commit: [`b3dd5a548f4a0340dea17ba16c2b1f3cfdd05a39`](https://github.com/EduardoManzanoAlcaraz/mars-pathfinder-the-meowrtian/commit/b3dd5a548f4a0340dea17ba16c2b1f3cfdd05a39). Later documentation-only changes record this publication; `git rev-parse HEAD` identifies the current checkout commit.

At **11:16:26 UTC**, a separate clone was downloaded without credentials. System and global Git configurations were disabled and the credential-helper list was cleared. All **296 files / 40,401,979 bytes** matched the reviewed publication tree in SHA-256. The largest file was the 3,106,729-byte presentation; original NASA/USGS rasters were absent. README local links resolved in that clone.

Four anonymous HTTPS requests returned **200**: the GitHub repository page, repository API, pinned README and pinned LICENSE. The API reported `public`, branch `main` and license identifier `Apache-2.0`. The GitHub connector independently retrieved the README and LICENSE. [Machine-readable public verification](source-publication/public-verification.json).

## License and preservation

The team explicitly approved **Apache-2.0 for original code** before it was added or published. [LICENSE](../LICENSE), [NOTICE](../NOTICE), [approval record](source-publication/license-approval.json) and [scope/third-party conditions](LICENSING.md) are included. The complete upstream notices remain unchanged. Agency materials, photographs, fonts and dependencies retain their own terms.

The source selection excludes credentials, account state, personal workstation paths, security/device logs, original scientific rasters, environments, temporary files and generated builds. Copies of historical reports redact personal paths. Original working files and scientific inputs remain preserved locally. Text/filename checks and document-metadata inspection found no publication blockers in the reviewed selection.

## Reproduction evidence

An independent directory outside the original project passed a fresh locked npm installation, static build, typecheck, **37 routing/worker + 27 interface/science tests**, and **8 synthetic Python geospatial tests**. Tested source and scientific assets matched the published selection. [Commands, results and limitations](SOURCE_RELEASE_CHECKS.md).

The original-data 22-test Python suite remains a historical result; it requires downloads intentionally excluded from the compact checkout. It was not represented as rerun in this publication phase.

The [Netlify demo](https://mars-pathfinder-the-meowrtian.netlify.app), application code, prepared data and scientific model were not changed or redeployed. No Git-to-Netlify integration, paid service or build hook was enabled.

The team can now include both the public source and live-demo URLs in its official entry. Publishing this repository does not accept the challenge terms or submit that entry.
