# Presentation and submission-material validation

**Current final revision:** seven slides and seven PDF pages, new production captures, A* and M3 trade-offs, Maximum modeled slope, Model Checks and Limits, source/AI credits and Apache-2.0. Native PowerPoint and all seven rendered PDF pages were inspected. [Current checks](final-review-20261115/materials-validation.json), [release](REVISION_PRESENTACION_FINAL.md). Earlier revision records below are historical.

**Current jury release, 15 November 2026:** the existing deck was updated with current production captures, Start Mission to M3, 72 Vitest tests and the team-approved Apache-2.0 license. PPTX/PDF retain exactly seven slides/pages. Native PowerPoint open/export, embedded image hashes, editable slide-5 table, PDF text/link checks and individual visual review passed. [Current checks](jury-release-20261115/materials-validation.json), [release evidence](MEJORA_FINAL_JURADO.md). The narrative below records the earlier deck revision.

## Historical first-deck record

The remainder records the first deck revision, completed earlier on 15 November 2026. Its sizes, test counts, license status and load measurements describe that revision only. The linked deliverables have since been replaced by the verified seven-slide jury release described above; use the current materials report for their hashes and sizes.

## Final files

- [Editable PowerPoint](../deliverables/spaceapps-2026/Mars-Pathfinder-The-Meowrtian.pptx), 3,106,729 bytes, exactly seven slides.
- [Submission PDF](../deliverables/spaceapps-2026/Mars-Pathfinder-The-Meowrtian-Submission.pdf), 446,718 bytes, exactly seven pages.
- [English submission fields](../deliverables/spaceapps-2026/SUBMISSION_TEXT_EN.md): summary, description, technologies, NASA resources, other data, AI declaration and references.
- [Submission review and remaining team decisions](../deliverables/spaceapps-2026/SUBMISSION_REVIEW_EN.md).

The original-code license remains a team decision. No license file was created. No source repository was published, terms accepted or official project submitted.

## Checks actually completed

| Check | Result |
|---|---|
| PowerPoint package structure | Pass, zero findings |
| Layout geometry and heading fit | Pass, zero findings |
| Declared slide count | Seven, including opening and closing slides |
| Font | Arial, verified available in the installed runtime |
| Editability | Native text shapes throughout; native table on slide 5 |
| Microsoft PowerPoint | Read-only open succeeded, version 16.0; exported all seven slides to PNG and PDF |
| PDF page count and text | Seven pages; headings and route metrics checked |
| PDF URL | Clickable HTTPS demo link on page 7 |
| Visual review | Inspected all seven native PowerPoint PNGs and all seven final PDF page renders individually at 1600 × 900 |
| Language | All authored slide text and notes in English; map-canvas captures contain map symbols rather than untranslated HTML controls |
| Metric provenance | Values copied from the verified origin-to-M3 production exports |
| AI disclosure | OpenAI Codex and ChatGPT, with team-confirmed roles; visible disclosure on slide 6 and details in notes/fields |
| Scientific photographs | Real mission JPEG and real app-rendered imagery; no generative image tool used |
| Logos | No NASA, JPL or USGS logo used |
| Existing project preservation | 63 archived application/data files compared against the release backup: all hashes unchanged |
| Deployment | No Netlify project mutation or deploy command invoked in this phase |
| Antivirus gate | Defender enabled, no related threats/detections and review not required at the pre-authoring check |

The review found no unintended overlap, clipped text, illegible labels or missing images in the final renders. This is a presentation check, not a new scientific field validation or a legal eligibility certification.

## Measured results used

The comparison on slide 5 uses the documented production experiment: origin cell (59,302), M3 (334,233), 15-degree cap, lambda 0 and 4, engine 1.0.0, dataset `jezero-hirise-v1`. It is not the app's default-example destination.

| Metric | A | B |
|---|---:|---:|
| Horizontal distance | 3,035.81 m | 3,118.65 m |
| Cumulative ascent | 36.39 m | 31.88 m |
| Maximum modeled slope | 14.54° | 9.02° |

Test totals cite the executed release records: 37 routing/worker plus 27 interface/science Vitest tests, and 22 pytest tests. This phase does not claim to have rerun those suites or invented new results. The performance range 1.16-1.79 s comes from the two verified clean production browser sessions. The slide notes describe the measurement scope and CDN/cache limitations.

## Captures and source handling

`scripts/presentation/capture.mjs` visits the public app in a fresh Chrome context and selects its existing layers and documented route. It saves the real map browser view and the exact PNG serialization of the rendered OpenLayers canvas. It does not edit DOM labels, translate screenshots, redraw terrain or invent route geometry. HTML endpoint/control labels sit outside that canvas. The deck embeds the original canvas PNG bytes and crops their transparent margins as native picture crops. The source/coordinates remain unchanged.

The initial slope capture was taken before its raster finished rendering and was rejected during visual inspection. The script now waits for opaque, colored interior raster pixels before export. Only the subsequent complete capture appears in the deck. No application code was changed to obtain it.

Source paths, hashes, browser timestamp and crop settings: [capture record](presentation-validation/captures.json), [slide source record](presentation-validation/slide-sources.json). Per-slide notes retain scientific citations. Visible credits accompany the visuals. The original photo and NASA/USGS products remain unchanged.

## Export repairs and final verification

The bundled exporter initially placed fill elements after font elements in eight table-text style records. The package validator rejected that draft. `canonicalize-pptx.py` corrected only the XML child order, verified that every nonchanged package part was byte-identical and that all slide text was preserved. The strict package/layout/import checks then passed. [Repair record](presentation-validation/xml-repair.json), [final PowerPoint validation](presentation-validation/pptx-validation.json).

PowerPoint's PDF export retained the visible URL but emitted no link annotations. `finish-pdf.py` added a link rectangle over that existing URL on page 7, preserving the exported page content and extracted text. The seven final PDF pages were rendered again and inspected. [Native PowerPoint open/export record](presentation-validation/powerpoint-validation.json), [material checks and final SHA-256 values](presentation-validation/materials-validation.json).

## Reproduction and evidence

The presentation uses the preinstalled `@oai/artifact-tool` 2.8.148 runtime for editable authoring, the supplied finalizer for package checks, Microsoft PowerPoint for native export, and pypdf/PDFium for the final PDF check/render. No replacement presentation libraries or global dependencies were installed.

Scripts: `prepare.mjs`, `capture.mjs`, `build-deck.mjs`, `canonicalize-pptx.py`, `render-powerpoint.ps1`, `finish-pdf.py` and `verify-materials.py` under `scripts/presentation/`. Runtime paths are explicit in those scripts. Rebuilding should target a new final filename because the finalizer preserves existing deliverables.

Private draft PNGs, final native/ PDF page previews and logs are under `.cache/presentation-2026/`. Durable machine reports are under `docs/presentation-validation/`. No private build or large NASA original is included in the four-file submission-material output directory.

## Terms review boundary

The 2026 legal page's current search-index text, the official NASA Space Apps Navigator guidance and NASA/JPL/USGS/HiRISE use policies informed the review. Direct requests to some Space Apps pages failed; [record](presentation-validation/official-http.json). Those failures are documented in the team review rather than represented as successful page retrievals. Licensing and source availability require the team's decision before submission. The assistant has not chosen a license or confirmed all participant eligibility conditions.
