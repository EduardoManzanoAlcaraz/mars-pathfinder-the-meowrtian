# Revisión final internacional y publicación — 15 noviembre 2026

**Aplicación inglesa publicada y validada; siete diapositivas y siete páginas PDF revisadas. No se ha enviado la candidatura a NASA.**

## Publicación y código

- [Producción HTTPS](https://mars-pathfinder-the-meowrtian.netlify.app), deploy `6af9df2e7b6cf78bbc6d135b`, estado `ready`.
- [Prueba previa](https://final-review-20261115--mars-pathfinder-the-meowrtian.netlify.app), deploy `6af9ddf7309fb9a985fd9a2b`.
- [Instantánea de producción](https://6af9df2e7b6cf78bbc6d135b--mars-pathfinder-the-meowrtian.netlify.app).
- Sitio existente `89d24aa6-4300-4b08-afcc-84f51da7f164`; sin otro proyecto, Git CD ni servicios de pago.
- Código construido: `78e29b929bc007814ea137043fdb23829f56645b`, posterior a la rama inglesa `4592333`. Los commits posteriores completan documentos y materiales; las **64 entradas de ejecución** coinciden con [release.json](https://mars-pathfinder-the-meowrtian.netlify.app/release.json), SHA-256 conjunto `8a25b784844890f5ef128f2daf90cb04d4f82f7fdbc5917a3fef6ad0b1a2a63e`.
- Paquete: **68 archivos / 6.197.327 bytes**, inventario SHA-256 `003f24c992487cb17598e90a14196118715a6c2cd5186e94e032b6ef73d909d4`.
- Se publicó el mismo paquete que superó el borrador, con `--no-build`. La API de una subida manual no proporciona `commit_ref`; se usa la correspondencia propia de hashes, sin inventar metadatos del proveedor.

[Registro del borrador](final-review-20261115/preview/deploy.json), [producción](final-review-20261115/production/deploy.json), [comprobación final](final-review-20261115/final-checks.json).

### Verificación pública de GitHub y entregables

La rama inglesa se integró en `main` por avance rápido y push normal, commit `4dd79798c0ce7625fea8cf239af85853e82189c9`, junto al tag remoto `before-english-release-20261115`. Una clonación anónima, con configuración global/sistema y helpers de credenciales desactivados, cotejó **538 archivos / 72.050.983 bytes**: todos los hashes coinciden. Las 64 entradas de ejecución coinciden con producción y el commit construido es ancestro de `main`; el historial anterior y el tag se comprobaron.

Una sesión privada de Chrome abrió GitHub y la demo, ejecutó Start Mission y descargó por HTTPS el PPTX, PDF, candidatura, README, LICENSE y NOTICE publicados. Todos respondieron 200 y coinciden con las copias revisadas. [Clonación y correspondencia](final-review-20261115/public-source-verification.json), [enlaces y descargas](final-review-20261115/delivery-links.json), [captura GitHub](final-review-20261115/github-public.png). Los 403 externos NASA/JPL se registran aparte, sin contarlos como enlaces accesibles.

El commit posterior que incorpora este registro es documental; `git rev-parse HEAD` identifica la revisión final. No requiere recompilar ni sustituir el paquete publicado.

## Interfaz, datos y licencia

Se continuó la implementación inglesa existente, sin repetirla. `lang=en`, números ingleses, controles, estados, errores, fuentes, leyendas, perfil y fichas en inglés. No existía selector español; no se añadió infraestructura bilingüe. Las exportaciones conservan sus campos originales y añaden `warningEn` y `designationEn` para lectura internacional; las métricas, geometrías y parámetros no cambian.

**54/54 hashes protegidos idénticos**, excluyendo únicamente el aviso de licencia autorizado. Motor A*, workers, coordenadas, datos preparados y dependencias conservados. No se reprocesaron ni modificaron originales NASA/USGS.

Se corrigió la afirmación obsoleta de `public/THIRD_PARTY_NOTICES.txt` y su generador `scripts/web/audit-licenses.mjs`. El código original mantiene **Apache-2.0 aprobada explícitamente por el equipo**. Los **766.600 bytes** de avisos upstream son idénticos: SHA-256 `a303075cd08384655adbcadeed978b99956fbc067d9bfd223bb43f5e004f2721`. No se sustituyeron licencias de terceros por la del proyecto. [Comprobación](final-review-20261115/license-check.json).

## Pruebas realmente ejecutadas

| Comando | Resultado |
|---|---|
| `npm run build` | Exit 0, exportación estática, 36,572 s |
| `npm run typecheck` | Exit 0 |
| `npm run test:report` | **37/37**, rutas y workers |
| `npm run test:interface:report` | **35/35**, interfaz/ciencia y 15 casos de navegador |
| `.venv/Scripts/python.exe -X utf8 -m pytest -q` | **22/22**, entorno aislado completo con originales locales |

Total **72 Vitest + 22 pytest**, sin incrementar contadores con casos ficticios. [Resultados](final-review-20261115/checks.json), [build](final-review-20261115/build.txt), [typecheck](final-review-20261115/typecheck.txt), [Vitest rutas](final-review-20261115/routing.txt), [interfaz](final-review-20261115/interface.txt), [Python](final-review-20261115/python.txt).

Se revisó Defender antes de las ejecuciones: sin alertas/detecciones relacionadas ni revisión pendiente. Fue lectura de estado/historial, no un análisis completo nuevo. No se cambiaron instalaciones globales. La advertencia de Next sobre el lockfile del directorio padre ajeno al checkout no impidió el build; el lockfile del proyecto y sus dependencias se conservaron.

## HTTPS, escritorio y móvil

Pasaron **dos contextos privados nuevos de Chrome 157** por entorno, 1440×900 y 390×844, sin credenciales ni caché de navegador. Solicitudes externas bloqueadas durante la demo. Start Mission→M3 y selección manual por clic, cámara/capas/parámetros, ambas rutas, métricas, resumen, minimapa, M1–M3, geología, fotografías, fechas/créditos, fuentes y perfil funcionaron. Se descargaron y auditaron **ocho JSON por entorno**; sus celdas/métricas coinciden con el motor y ninguna arista incumple las restricciones.

Cero errores JavaScript/consola ni activos fallidos en los flujos finales. Se cotejaron los **68 archivos servidos** con el paquete: únicamente se admite el comentario HTML inerte Netlify ya documentado, con igualdad de todos los bytes restantes. [Auditoría previa](final-review-20261115/preview/browser-audit.json), [producción](final-review-20261115/production/browser-audit.json).

Readiness observada en producción: **2461,6 ms escritorio / 3301,0 ms móvil emulado**. Son observaciones únicas en este equipo/red; CDN no purgada, sin garantía global ni prueba de teléfono físico. El tiempo de carga inicial no es el tiempo interno del algoritmo; ambos se conservan por separado en los informes.

Capturas reales: [escritorio](final-review-20261115/production/1440-production-routes.png), [comparación móvil](final-review-20261115/production/390-production-comparison.png), [objetivo](final-review-20261115/production/390-production-objective.png), [fotografía](final-review-20261115/production/390-production-perseverance.png). Los nombres `*-production-*` de la carpeta `preview/` corresponden al borrador HTTPS del guion compartido, no a producción.

## Siete slides y PDF

Se editó el deck existente, conservando fuentes Arial, estilo, créditos y tabla nativa en slide 5:

1. Portada con **Plan a science Marswalk in Jezero Crater**, equipo y desafío oficial; sin nombres individuales no confirmados/con consentimientos ausentes.
2. Leyenda de pendiente con rango 0–30°+, colores, NoData y cap de demo; decisión de alcanzar M3 con distintos costes.
3. MRO/HiRISE y Mars 2020/Perseverance visibles; fotografías explicadas mediante posiciones documentadas del rover.
4. A* y los dos objetivos de optimización; detalles de heap, vecinos, workers y preparación en notas.
5. Start Mission→M3, **Maximum modeled slope** y deltas calculados desde los JSON completos.
6. **Model Checks and Limits**, separación entre comprobaciones y límites; Codex/ChatGPT, Apache-2.0 y advertencia EVA conservados.
7. Captura real de la interfaz inglesa actual, rutas A/B y minimapa; objetivo de M3 y URL pública.

Datos M3 verificados: origen `(59,302)`, destino `(334,233)`, cap 15°, λ=0/4. A: **3035,807358 m**, ascenso **36,391357 m**, pendiente máxima modelada **14,535635°**. B: **3118,650071 m**, ascenso **31,878418 m**, pendiente máxima **9,018862°**. Diferencias sin redondear: **82,842712 m**, **4,512939 m**, **5,516773°**; presentación: **+82.84 m / −4.51 m / −5.52°**. No se interpretan como una reducción demostrada del riesgo EVA.

El borrador inicial del marco importado deformaba la última imagen; se sustituyó solo ese objeto por una imagen nativa con proporción exacta del PNG. Los bytes de la captura permanecen intactos. PowerPoint 16 abrió el PPTX en lectura, exportó siete PNG/PDF y conservó el hash del archivo. Se inspeccionaron **individualmente los siete renders nativos y las siete páginas PDF finales**. La tabla sigue editable; texto nativo y enlace PDF funcionan. Se comprobaron metadatos sin nombres personales y las seis imágenes de producción embebidas con sus hashes; la foto NASA mantiene sus bytes originales.

[Validación de materiales](final-review-20261115/materials-validation.json), [PowerPoint](final-review-20261115/powerpoint-validation.json), [capturas fuente](final-review-20261115/presentation-captures.json), [slides renderizados](final-review-20261115/slides/slide-1.png).

Archivos finales en `deliverables/spaceapps-2026/`: PPTX **3.080.344 bytes**, SHA-256 `7eca1d78db64c8afd94728466c6fd868d1c031dee87a33bb33c758879b99bd5a`; PDF **535.255 bytes**, SHA-256 `8c0083408a5a0ee676b581bf5195a7f1813a60dd13d740e7efee162d3bddee78`. `SUBMISSION_TEXT_EN.md` incorpora el mismo escenario, misión científica, deltas, pruebas y declaración de IA.

## Enlaces externos y límites pendientes

Los enlaces de la candidatura se comprobaron anónimamente. Los de HiRISE, USGS, Mars Trek y la mayoría del software respondieron 200. Cinco referencias NASA/JPL respondieron **403 tanto a HEAD como a navegación GET privada** desde este entorno: catálogo y dos páginas de fotografías, waypoints y política JPL. Se conservan sus URLs originales/documentación, imágenes locales auténticas e incertidumbres. El portal oficial [Perseverance](https://science.nasa.gov/mission/mars-2020-perseverance/) sí respondió 200 y se añadió como referencia de acceso. No se atribuye una causa no demostrada al 403 ni se afirma que esos enlaces fueran accesibles.

El antiguo enlace del repositorio Manrope respondió 404; se corrigió la referencia del texto de candidatura a [Fontsource](https://fontsource.org/fonts/manrope/about), verificada 200. El enlace original dentro de los avisos upstream se conserva íntegramente con su licencia. [Comprobaciones](final-review-20261115/reference-links.json), [reintentos reales](final-review-20261115/reference-link-retries.json).

La demo y los materiales funcionan sin esos servicios externos. Persisten las limitaciones científicas del prototipo, el móvil emulado y la ausencia de una auditoría WCAG completa. El equipo debe revisar su formulario oficial y realizar el envío. Esta fase no acepta términos ni envía nada a NASA.

## Recuperación

Referencia anterior: tag **`before-english-release-20261115`**, commit `fa79089bb5bfed8ce0f1c2fdaf7b4d515a3d2213`, deploy `6af9c6aa89bcb0bfe5fb7e09`. Paquete anterior preservado en `.cache/english-preview-20261115/out-production/`, **68 archivos / 6.194.991 bytes**. Materiales anteriores preservados en `.cache/final-review-20261115/before/` y en Git.

Si aparece un problema, publicar ese paquete como **un despliegue nuevo** en el mismo sitio y verificarlo:

```powershell
node .tools/netlify-cli/node_modules/netlify-cli/bin/run.js deploy --prod --no-build --dir .cache/english-preview-20261115/out-production --site 89d24aa6-4300-4b08-afcc-84f51da7f164 --message "Recover verified pre-English package" --json
```

La corrección del código se conserva mediante commit/revert revisado y push normal, sin force push. No se ha ejecutado recuperación: la nueva producción supera sus verificaciones.
