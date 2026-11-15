# Submission review and handoff

**Source-release update, 15 November 2026:** the team has now explicitly approved Apache-2.0 for original code. The source is public at https://github.com/EduardoManzanoAlcaraz/mars-pathfinder-the-meowrtian and has passed anonymous clone/HTTPS checks. The license and source-access items below describe the earlier review and are resolved. Third-party conditions remain intact. See [publication evidence](../../docs/GITHUB_PUBLICATION.md) and [current licensing](../../docs/LICENSING.md). The team still needs to complete its official form review and submission. The seven-slide PPTX/PDF retain their original bytes and historical notes.

## Historical review before source publication

Reviewed on 15 November 2026, Europe/Madrid. This is a practical evidence review, not a declaration of legal clearance or a completed submission.

## Items the team must resolve

1. **Original-code license.** No original-code `LICENSE` or equivalent was found at the project root. The [2026 participant terms, updated 7 August 2026](https://www.spaceappschallenge.org/legal/) require original content to be freely available without restriction or under an OSI-compliant license, and state that NASA will distribute original content under Apache 2.0 when no specific OSI-compliant license is supplied. The team must make an informed decision before accepting submission terms. No license has been selected or added by Codex.
2. **Source access.** The working directory has no Git repository or commit. The deployed demo is public, but a public source-repository URL has not been verified. Decide how judges and others can obtain the source and its license; a local recovery ZIP is not a public source link. No repository was created or published in this phase.
3. **Final form review.** Copy the English field drafts, check the actual form's limits and required fields, confirm team registration and local-event requirements, review the acknowledgments and submit. The assistant did not accept terms or submit the project.

## NASA/USGS materials and branding

- **HiRISE:** the [official image policy](https://www.uahirise.org/media/usage.php) permits public-domain image use and requests the credit NASA/JPL/University of Arizona. That credit appears with the orbital/terrain visuals.
- **NASA media:** the [NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) allow factual educational use with attribution, distinguish third-party rights and prohibit implying agency endorsement. Branding identifiers carry separate restrictions. This presentation uses no NASA, JPL or USGS logo and no identifiable people.
- **Perseverance:** authentic JPEGs keep their NASA/JPL-Caltech credit. The [JPL policy](https://www.jpl.nasa.gov/jpl-image-use-policy/) requires credits and excludes implied endorsement. The slide image is an original mission browse image, not generated scenery. The original image metadata supplies the specific credit and acquisition record.
- **USGS:** [USGS copyrights and credits](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits) distinguish agency-produced public-domain material from protected third-party items and request source acknowledgment. The deck credits Sun & Stack (2020), USGS SIM 3464, and cites the DOI. Team colors, reprojection and clipping do not transfer authorship of the published interpretation to the team.
- **Derived results:** masks, slope, hillshade, objective selections and routes are team-derived. They are not official NASA route recommendations. M1-M3 are team-proposed points, not official stations. Photos locate documented rover poses, not their visible targets. The deck states these boundaries and the absence of EVA safety certification.

## AI transparency

The team confirmed use of OpenAI Codex and ChatGPT. Their roles are stated in the presentation notes, visibly on slide 6, and in the submission fields. No scientific raster, mission photograph or numerical test result is invented by an image generator. Browser automation captures the running public app; the OpenLayers canvas capture excludes HTML controls without translating or retouching the image. Native slide text, table values and captions are in English.

The [Navigator answer in NASA's Space Apps repository, 12 November 2026](https://github.com/nasa/spaceapps/discussions/1947) describes the seven-slide limit including opening/closing slides, requests disclosure of AI use, and distinguishes visible marking for generated imagery. The material here uses real imagery and provides an AI-assistance disclosure. This answer is guidance in the official repository, not a substitute for the binding submission form.

## Official-source availability and scope

Direct requests to the legal page, Project Submission Guide and Participant FAQs returned gateway/network failures during this review. The search index returned the current **2026** legal page with its update date and license clause. The official NASA GitHub Navigator answer provided the presentation/AI guidance. Older staging-site rules and other years' guides were not treated as the 2026 source of truth. The team should reopen the binding pages in its own browser before accepting terms.

Official links:

- Terms: https://www.spaceappschallenge.org/legal/
- Submission guide: https://www.spaceappschallenge.org/resources/project-submission-guide/
- Participant FAQs: https://www.spaceappschallenge.org/resources/participant-faqs/
- Challenge: https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/
- Official NASA repository guidance: https://github.com/nasa/spaceapps/discussions/1947
- 2026 event/submission timeline: https://www.spaceappschallenge.org/2026/

The 2026 event page confirms the close on 15 November at 11:59 PM local time. The team's stated deadline is **15 November 2026, 23:59 Europe/Madrid**. Local event judging may have an earlier deadline. Submit with time for a final link/access check.

## Evidence used in the materials

- Latest deployment and metrics: `docs/DESPLIEGUE_FINAL.md`, `docs/deployment-validation/final-checks.json` and the two exported desktop route JSON files.
- Scientific provenance and limits: `docs/NASA_RESOURCES.md`, `docs/VALIDACION_GEOESPACIAL.md`, `docs/VALIDACION_RUTAS.md`, and the topographic/scientific manifests.
- Tests: 37 routing/worker plus 27 interface/science Vitest tests, 22 pytest tests, typecheck, build and two private production browser sessions. This phase cites those actual records; it does not claim a new scientific experiment or a new test run that did not happen.
- Public release: app version 0.1.0, engine 1.0.0, dataset `jezero-hirise-v1`, deploy `6af97dee2c4df4cb0f9da6cc`. Release inventory SHA-256: `2f151b3b1e6a29d8089ef17b14615b23b5891c8a639edb94c440495abbf34c74`. No source commit exists.
- AI declaration: the team's confirmation in this session, distinguishing the roles of Codex and ChatGPT.

## Presentation rehearsal

Keep the seven-slide PDF as the simplest playback copy and the PowerPoint as the editable version. Rehearse the live flow with the public URL and keep the already verified local `out/` demo as a network backup. The deck's results use the origin-to-M3 experiment. The app's default example has a different destination, so it produces different, also documented distances.

The app code, prepared datasets and deployed version remain unchanged. This phase only creates presentation/submission files and captures the public app through read-only browser interactions.
