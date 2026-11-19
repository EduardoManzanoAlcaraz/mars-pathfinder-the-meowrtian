# Mars Pathfinder / The Meowrtian status

Audit date: 2026-11-19. Source baseline: `c04a55fb5f7df16730040ac6a60952219d105edb`. Documentation-only change; existing release and scientific evidence retained.

## Newly executed checks

Windows, Node 24.21.0, npm 11.19.0; `npm ci` using the committed lockfile. Local Chrome/Chromium was available to the test harness.

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run build` | Passed after preserving original LF bytes |
| `npm test` | 37 passed, including real worker tests |
| `npm run test:interface` | 35 passed, including local browser/science checks |
| `npm run demo:routes` | Exit 0; independent edge audits passed for the manual example |

The first Windows checkout failed the scientific byte/hash check because Git converted `photos.json` to CRLF. Its HEAD blob matched the recorded hash. Original bytes were restored in the isolated checkout, then build and interface checks passed. No scientific values, expected hashes or product code were changed. The routing suite also passed with local-browser access available. Generated evidence was restored to its historical contents before this documentation commit.

The manual demo has a different destination from Start Mission→M3; do not reuse its distances as M3 results. No live production recheck, deployment, physical-device test, worldwide performance test, optional Python installation or full original-data suite was performed. Historical 22-test Python and production results remain in the existing reports, with their dates and environments.

## Implemented scope and decisions

Static educational mission-concept application, local A* distance/slope-penalty comparison, cancellation, map layers, science objectives, provenance and JSON export. Original-code license Apache-2.0; agency assets and dependencies retain their own terms. No runtime LLM, database, authentication or NASA API dependency is needed by the compact release.

NoData stays blocked. Martian coordinates are not Earth WGS84. Geology is uncertain contextual interpretation and photos locate rover poses, not rock targets. Soil, small obstacles, sand, radiation, weather and endurance remain outside the route model; neither candidate certifies safe travel.

## Proposed next steps

1. Consider a separately reviewed `.gitattributes` policy for byte-sensitive assets; this documentation change only provides the tested clone instructions.
2. Separate generated validation output locations from retained historical evidence when undertaking a future tooling change.
3. For a new scientific experiment, record endpoints, all assumptions, source hashes and independent reference checks; preserve prior releases.
4. Rerun full Python reproduction only in the documented original-data environment, and distinguish synthetic-only checks from full reproduction.

These are maintenance proposals, not implemented features or permission to redeploy or download large datasets.
