# Instrucciones para agentes — mars-pathfinder-the-meowrtian

Se aplica a todo el repositorio. Codex debe leer este archivo; con Claude u otra herramienta, incluirlo explícitamente si no lo carga automáticamente.

## Antes de cambiar archivos

Read `README.md`, `ARCHITECTURE.md`, `PROJECT_STATUS.md`, `docs/REPRODUCIBILITY.md`, `docs/NASA_RESOURCES.md`, `docs/LICENSING.md` and `NOTICE` before touching the relevant source.

Comprueba `git status --short` y la rama. Conserva cambios ajenos y lee las instrucciones de cualquier subdirectorio afectado. Contrasta los documentos con el código: un plan o resultado antiguo no demuestra una función actual. Limita cada cambio al encargo recibido.

## Reglas del proyecto

- Preserve scientific provenance, exact asset bytes, SHA-256 values, CRS, units, north-first layout and mask semantics. Use an LF-preserving clone as documented; never edit expected hashes just to pass a failed check.
- Keep A* pure and deterministic apart from measured timing. Retain legal-edge checks, independent Dijkstra comparison, nonnegative costs and the distinction between horizontal length and slope cost.
- Preserve cancellation by worker termination/recreation and stale-request checks. Do not replace independent reference tests with calls to the production engine.
- Geology must not silently become a precise navigation barrier. Team objectives and slope caps must remain labeled as assumptions. Do not imply NASA endorsement or astronaut-safety certification.
- No original raster download, regeneration, deploy script, account-specific audit helper or public-service request is a routine prerequisite for documentation or compact web development.
- Preserve credits and third-party licensing; Apache-2.0 applies to original code, not every dataset or photo.
- Browser tests and demo scripts may rewrite tracked reports/screenshots/routes. Use an isolated copy, review the resulting diff, and stage only intended changes. Keep historical reports dated rather than presenting them as fresh checks.

## Validación y entrega

Use Node 24+, `npm ci`, `npm run typecheck`, `npm run build`, `npm test`, `npm run test:interface`. Browser checks require installed Chrome/Edge/Chromium or `MARS_TEST_BROWSER`; a missing browser is not a passing test. Build before interface tests. `npm run demo:routes` checks the manual example and writes reports, not necessarily the M3 presentation route. Optional Python: use an isolated environment and the pinned lockfile; `python -m pytest tests/test_geospatial.py -q` checks synthetic primitives only. Full Python reproduction needs excluded originals; follow its existing documentation and report missing inputs.

En cambios solo de documentación, comprueba rutas, enlaces relativos y comandos contra los archivos reales; no hace falta repetir toda la suite si no cambia el comportamiento. No inventes pruebas ausentes ni marques como aprobado un comando que no ejecutaste. Informa comando, resultado y alcance pendiente.

Revisa el diff antes de hacer commit. No incluyas dependencias instaladas, archivos generados, datos personales, credenciales, cookies, tokens ni archivos de entorno privados. Mantén los documentos útiles existentes y actualiza el estado si cambia una decisión o una limitación. Los commits deben explicar el resultado y su validación; separa documentación y cambios funcionales.
