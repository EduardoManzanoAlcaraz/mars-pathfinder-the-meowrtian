# Public source release checks

Verified on **15 November 2026** for Mars Pathfinder 0.1.0, routing engine 1.0.0 and dataset `jezero-hirise-v1`. This publication does not change or redeploy the existing [Netlify application](https://mars-pathfinder-the-meowrtian.netlify.app).

## Clean reproduction

The explicitly selected source files were copied to a newly created Windows temporary directory outside the original project and installed with `npm ci --no-fund --no-audit`. No original NASA/USGS download, parent `node_modules`, local environment file, Python raster preparation or API credential was used by the web build. Node 24.21.0, locked package versions and Chrome 157.0.8103.51 were used.

| Executed check | Actual result | Evidence |
|---|---|---|
| `npm ci --no-fund --no-audit` | Exit 0; 88 packages installed | Locked versions in `package-lock.json` |
| `npm run build` | Exit 0; static Next.js export generated | [Build output](source-publication/isolated-build.txt) |
| `npm run typecheck` | Exit 0 | [Typecheck output](source-publication/isolated-typecheck.txt) |
| `npm test` | 37/37 passed, including real Chrome workers | [Test output](source-publication/isolated-routing.txt), [worker evidence](source-publication/workers-browser.json) |
| `npm run test:interface` | 27/27 passed, including 12 actual browser cases | [Test output](source-publication/isolated-interface.txt), [browser evidence](source-publication/interface-browser.json) |
| `python -m pytest tests/test_geospatial.py -q` | 8/8 synthetic primitive checks passed | [Python output](source-publication/isolated-python-primitives.txt) |

[Machine-readable results](source-publication/clean-checks.json) retain actual start times, durations and exit codes. The Python check used the existing isolated pinned environment; it did not reinstall Python. The historical 22-test original-data suite was **not** rerun against this compact source selection: those other tests need deliberately excluded scientific originals and GeoTIFFs. [Reproduction scope](REPRODUCIBILITY.md).

The browser suite exercised the map layers, objectives, documented photos, real routes and JSON download. Its downloaded results are retained separately as [A](source-publication/export-route-a.json) and [B](source-publication/export-route-b.json). They use the existing default-example endpoints; the presentation's origin-to-M3 experiment has different endpoints. No result was substituted for another experiment.

The tested application code, tests, processing/routing scripts, package versions, compact grid and public assets were compared against the selected publication files and were byte-identical. Personal path redaction applies only to public copies of reports, not scientific manifests or values.

## Publication and licensing gates

- The owner account was checked for an existing Mars/Meowrtian/Pathfinder repository before creation. Other applications were left untouched.
- The team explicitly approved Apache-2.0 for original code. The canonical Apache license, root `NOTICE`, package metadata and [licensing scope](LICENSING.md) record that decision. Apache-2.0 appears on the [OSI approved license page](https://opensource.org/license/apache-2.0).
- All existing third-party copyright/license notices remain intact, including the full 88-package notice collection. Upstream agency data, photos, fonts, icons and software retain their conditions.
- Original `.IMG`, `.JP2`, USGS archives, local GeoTIFFs, environments, dependencies, generated builds, account state, backups, credentials and temporary/private files were excluded through explicit file selection and ignore rules.
- Text-pattern and filename checks found no credential material or personal Windows paths in that selection. PPTX package XML and PDF metadata/text were also checked; both retain seven slides/pages and their original bytes. These checks are scoped inspections, not a guarantee about arbitrary future commits.
- Windows Defender status/history was read before execution: protection active, no project-related threats/detections/events requiring review. Security/device details remain local.

## Observations

The first build inside the original project's cache emitted Next.js's multiple-lockfile warning. The independent-directory build above passed without that warning. No configuration change was needed.

npm 11 reported that esbuild's postinstall script was not approved by its `allowScripts` mechanism. No global approval or protection change was made. The shipped locked platform binary built the worker successfully, and all suites passed.

No source-publication test failures remain. This release supplies public, reproducible source and its license; the team must still put the source and demo links into its official challenge entry. Earlier audit reports retain their historical deployment and pending-license statements; current licensing is recorded above.
