# Mars Pathfinder - The Meowrtian

Copy the text under each field into the corresponding submission field. These are drafts for the team's final review. Field lengths below are not claimed to be the platform's official limits. The team must complete its own submission. The team approved Apache-2.0 for original code on 15 November 2026.

## Project title

Mars Pathfinder

## Team

The Meowrtian

## Challenge

Interplanetary Survival Guide: Martian Map

## Public demo

https://mars-pathfinder-the-meowrtian.netlify.app

## Summary

Plan a science Marswalk in Jezero Crater. Mars Pathfinder is a working web prototype that compares routes to team-selected science objectives on real Martian terrain. The Meowrtian combines MRO/HiRISE imagery and stereo elevation data with USGS SIM 3464 geology and documented Mars 2020/Perseverance photographs. Two A* modes compare shortest horizontal distance with a slope-penalized alternative under the same terrain constraints. The English interface exposes data provenance, uncertainty and downloadable results. It supports education and mission concept discussions and does not certify astronaut safety.

## Project description

Planning a scientific traverse requires more than drawing a short line across an image. A candidate route must account for relief and unknown terrain while keeping the scientific context and the limitations of the evidence visible.

Mars Pathfinder is a deployed Next.js and OpenLayers application for a verified region of Jezero crater. It uses a prepared HiRISE stereo DEM and orthoimage in a local Martian coordinate reference system. A 394 by 356 grid at 10 m supports deterministic A* routing. The engine checks data validity, conservative cell slopes, grades between cell centers and diagonal corner constraints. It never fills unknown areas or treats them as traversable. Two Web Workers calculate a minimum-horizontal-distance route with lambda 0 and a slope-penalized route with lambda 4, using the same 15-degree slope cap in the documented experiment.

The public app combines orbital imagery, topographic derivatives and the published USGS SIM 3464 geological interpretation. Start Mission automatically frames the study area and computes both routes to the verified team objective M3. In the mapped Jezero floor unit, M3's scientific intent is to characterize texture, cratering and relief and compare them with the fan and Lower etched unit. It is a team-selected objective, not an official station or identified sample. A lightweight regional overview places the study area within mapped Jezero floor and fan units; it does not trace the crater rim or extend navigation coverage. Users can inspect three science objectives, select other endpoints, compare measured trade-offs, inspect elevation profiles and export JSON. Controls, legends, errors and cards default to English. Export annotations include English translations while retaining the original scientific records. Two authentic Perseverance photographs include documented rover positions, acquisition dates and source credits. They locate the rover camera, not the terrain visible in the photograph. Geological contacts retain documented 100-200 m positional offsets and do not act as navigation barriers.

In the verified production Start Mission experiment from cell (59,302) to team objective M3 at (334,233), Route A measures 3,035.81 m horizontally with 36.39 m ascent and a 14.54-degree maximum modeled slope. Route B measures 3,118.65 m with 31.88 m ascent and a 9.02-degree maximum modeled slope. Computed from the full-precision exports, B adds 82.84 m, reduces cumulative ascent by 4.51 m and reduces maximum modeled slope by 5.52 degrees. Both downloaded results match the local engine and pass independent edge audits. Software validation includes 72 passing Vitest tests (37 routing/worker and 35 interface/science), 22 passing pytest tests, independent Dijkstra comparisons, typecheck and a static production build. Fresh private desktop and mobile browser contexts exercised both the preview and final public demo without authentication. These checks validate software and data consistency, not physical EVA safety.

Our contribution is an inspectable connection between scientific context and reproducible route trade-offs. We distinguish official observations from team-derived slope, masks, hillshade, objective selections and optimization results. This is an educational and mission-concept prototype. Orbital resolution, uncertain geological registration and unmodeled soil stability, sand, small obstacles, radiation, weather and EVA endurance prevent any claim of operational astronaut safety.

## Technologies used

Next.js 16.4.6, React 19.3.1, TypeScript 7.0.2 and OpenLayers 10.11.0; deterministic A* with an indexed binary min-heap, eight neighbors and two Web Workers; Python 3.14.7, Rasterio/GDAL, NumPy, SciPy, Pyproj, Pyogrio and Shapely for prepared geospatial data; Vitest, pytest and Playwright/Chrome for validation; static export on Netlify. All essential scientific assets, fonts and workers are local to the deployed site. No LLM service participates in route calculation.

## NASA data and resources used

1. **MRO HiRISE stereo topography and orthoimage.** Catalog: https://www.uahirise.org/dtm/ESP_045994_1985 . Actual DTM: `DTEEC_045994_1985_046060_1985_U01.IMG`. Actual orthoimage: `ESP_046060_1985_RED_C_01_ORTHO.JP2`, georeferenced through its detached `.LBL`. The team prepared aligned 2 m crops, 4 m web visualizations and a conservative 10 m routing grid. Credit: NASA/JPL/University of Arizona, with USGS Astrogeology involvement in the DTM. Usage policy: https://www.uahirise.org/media/usage.php . DEM-derived slope, hillshade and masks are team derivatives, not additional independent NASA datasets.

2. **Mars 2020/Perseverance Navcam photographs and documented rover waypoints.** Raw images: https://mars.nasa.gov/mars2020/multimedia/raw-images/ . Sol 14 image `NLM_0014_0668187969_574ECM_N0030110AUT_04096_00_2LLJ`, acquired 5 March 2021, RMC `3_110`; sol 107 image `NLF_0107_0676451875_145ECM_N0040644NCAM01107_01_195J`, acquired 8 June 2021, RMC `4_644`. Individual image pages: https://mars.nasa.gov/mars2020/multimedia/raw-images/NLM_0014_0668187969_574ECM_N0030110AUT_04096_00_2LLJ and https://mars.nasa.gov/mars2020/multimedia/raw-images/NLF_0107_0676451875_145ECM_N0040644NCAM01107_01_195J . Official positions: https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json . Each photo matches a unique official waypoint with the same sol, site and drive. Credit: NASA/JPL-Caltech. The positions locate the rover, not image targets. Image-use policy: https://www.jpl.nasa.gov/jpl-image-use-policy/ . Exact metadata and documentary joins are preserved in `public/data/jezero-science-v1/photos.json`.

3. **NASA Mars Trek, consulted.** https://trek.nasa.gov/mars/ . We inspected relevant Jezero catalog coverage and services. No additional Mars Trek raster is incorporated, and catalog consultation is not counted as a dataset used by A*. We do not claim local CRISM mineral detections.

## Space agency partner and other data

**USGS SIM 3464.** Sun, V.Z., and Stack, K.M., 2020, *Geologic map of Jezero crater and the Nili Planum region, Mars*: U.S. Geological Survey Scientific Investigations Map 3464, scale 1:75,000, https://doi.org/10.3133/sim3464 . Publication and database: https://pubs.usgs.gov/publication/sim3464 . The team reprojected and clipped the original `GeoUnits_v1` polygons to the local Martian CRS, retaining original symbols, names and identifiers. Six clipped polygons represent five units. The documented 100-200 m offsets remain an explicit limitation. USGS is the publisher of this geological interpretation and is credited separately from NASA imagery.

## Use of artificial intelligence

We used **OpenAI Codex** for code development and implementation, NASA/USGS processing scripts, the A* engine, integration of Next.js, OpenLayers and Web Workers, automated tests, debugging, deployment, documentation and preparation of these submission materials. We used **ChatGPT (OpenAI)** for project planning, challenge-requirement interpretation, architecture and functionality proposals, instructions for Codex, and advice on scientific resources, methodology, validation and presentation.

NASA/USGS sources supply the scientific observations and published interpretation. The team and its processing code derive slope, masks, hillshade, route metrics and proposed objectives. We checked technical and scientific claims through executed code, automated tests and official sources. AI assistance is not the source of NASA/USGS measurements, and it does not replace the original data or their uncertainty. The presentation contains real project/browser captures and authentic mission photographs, with no AI-generated scientific photographs. Routing uses deterministic A* in the browser, not a generative AI model. The team remains responsible for final review, attribution and submission.

## Reference list and software attribution

- HiRISE catalog and data: https://www.uahirise.org/dtm/ESP_045994_1985
- Sun & Stack (2020), SIM 3464: https://doi.org/10.3133/sim3464
- Perseverance Raw Images: https://mars.nasa.gov/mars2020/multimedia/raw-images/
- Official Mars 2020 waypoints: https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json
- Mars Trek, consulted only: https://trek.nasa.gov/mars/
- Next.js: https://nextjs.org/ ; React: https://react.dev/ ; TypeScript: https://www.typescriptlang.org/
- OpenLayers: https://openlayers.org/ ; GDAL: https://gdal.org/ ; Rasterio: https://rasterio.readthedocs.io/
- NumPy: https://numpy.org/ ; SciPy: https://scipy.org/ ; Pyproj: https://pyproj4.github.io/pyproj/ ; Pyogrio: https://pyogrio.readthedocs.io/ ; Shapely: https://shapely.readthedocs.io/
- Vitest: https://vitest.dev/ ; pytest: https://docs.pytest.org/ ; Playwright: https://playwright.dev/
- Manrope: https://fontsource.org/fonts/manrope/about ; Lucide: https://lucide.dev/ ; Netlify: https://www.netlify.com/
- OpenAI Codex: https://openai.com/codex/ ; ChatGPT: https://chatgpt.com/
- Full package notices and licenses, including indirect dependencies: https://mars-pathfinder-the-meowrtian.netlify.app/THIRD_PARTY_NOTICES.txt . Do not replace these notices with a blanket license for the original code.

## Team action before submission

The team explicitly approved Apache-2.0 for the original Mars Pathfinder code on 15 November 2026. Source: https://github.com/EduardoManzanoAlcaraz/mars-pathfinder-the-meowrtian . Third-party software, fonts, agency datasets and photographs retain their own conditions and attribution. The repository's LICENSE, NOTICE and docs/LICENSING.md describe the scope. The team remains responsible for reviewing the current submission terms and submitting the project; publishing source does not submit the entry.

## Source-link availability note for team review

On 15 November, anonymous HEAD requests and private Chrome navigation to the cited mars.nasa.gov records and JPL image-use page returned HTTP 403 from the validation environment. Their original URLs, image IDs, source hashes and attribution are preserved; the app serves the authentic prepared photographs locally. The official mission landing page remained accessible: https://science.nasa.gov/mission/mars-2020-perseverance/ . This is an access limitation, not evidence that the original records or documentary joins are invalid. The obsolete Manrope repository link in this field draft was replaced by the verified Fontsource package page; complete upstream license text remains unchanged.
