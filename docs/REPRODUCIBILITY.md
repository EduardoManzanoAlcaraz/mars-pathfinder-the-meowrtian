# Reproduction scope

The compact routing binaries and manifest, optimized map images, geological units, objectives, documented photographs and notices are included. A fresh checkout can run the web build, routing tests and interface tests without downloading large NASA/USGS originals. Chromium is required for browser checks. Node 24+ and `package-lock.json` define the application dependencies.

The 22-test Python release suite also checks original HiRISE/USGS products, prepared GeoTIFFs and official rover metadata. Those originals are deliberately excluded. Follow `VALIDACION_GEOESPACIAL.md` and `NASA_RESOURCES.md` to download official inputs and regenerate them before running that full suite. Keep originals under ignored `data/raw/`. The narrower synthetic suite is `python -m pytest tests/test_geospatial.py -q` and needs no original rasters. Synthetic fixtures are never displayed as observations of Mars.

The public source uses explicit selection. Interpreter/package caches, `.netlify`, credentials, local backups, original rasters, generated builds and account-specific publication/presentation helpers stay outside Git. Copies of validation reports replace personal workstation paths with neutral placeholders; private execution logs and security/device details are omitted. Scientific manifests and binaries are not rewritten.

Historical results remain labeled as historical. New checkout checks are recorded separately. Full geospatial reproducibility was measured in the locked Windows environment, not asserted across arbitrary GDAL/PROJ versions. Publishing source does not update or redeploy Netlify.
