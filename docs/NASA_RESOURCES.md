# Recursos científicos NASA y USGS — Mars Pathfinder

**Auditoría posterior:** se revisó y corrigió la presentación de estos mismos datos sin modificar los paquetes científicos; véase [AUDITORIA_FINAL.md](AUDITORIA_FINAL.md) para el estado de entrega y las cifras del build actual. Las cifras de esta fase se conservan como registro de su ejecución.

**Fase verificada el 14 de noviembre de 2026.** Se incorporaron polígonos USGS SIM 3464, tres objetivos propuestos por The Meowrtian y dos fotografías Navcam con posición documental del rover. Se conservan HiRISE, su manifiesto, OpenLayers y A*. Mars Trek fue consultado: **no se incorporó ningún ráster Trek**, ni se cuenta una consulta de catálogo como un nuevo dato utilizado en el cálculo.

Las tres familias científicas del mapa son imagen orbital, topografía estéreo e interpretación geológica publicada. Pendiente, sombreado y colores son derivados, no tres fuentes independientes. Las fotografías añaden contexto de superficie, sin inferir coordenadas de las rocas visibles ni confirmar minerales en los objetivos.

## Fuentes consultadas y utilización real

| Recurso oficial / autores u organismo | URL | Uso y limitaciones |
| --- | --- | --- |
| MRO HiRISE; NASA/JPL/University of Arizona, DTM producido con USGS-Astrogeology | [Productos ESP_045994_1985](https://www.uahirise.org/dtm/ESP_045994_1985) | **Conservado**: DTEEC_045994_1985_046060_1985_U01.IMG y ESP_046060_1985_RED_C_01_ORTHO.JP2 mediante su LBL. Recortes 2 m, web 4 m, rutas 10 m. No nuevo procesamiento topográfico |
| Vivian Z. Sun y Kathryn M. Stack (2020), U.S. Geological Survey; mapa preparado para NASA | [SIM 3464](https://pubs.usgs.gov/publication/sim3464), [DOI](https://doi.org/10.3133/sim3464) | **Incorporado**: interpretación geológica 1:75.000; polígonos `GeoUnits_v1`, nombres, símbolos y OBJECTID originales. No son barreras geotécnicas |
| NASA Solar System Treks / JPL | [Mars Trek](https://trek.nasa.gov/mars/) | **Consultado**: catálogo sobre el AOI, servicios y capacidades WMTS. THEMIS nocturno puede complementar la topografía; CRISM exige verificar observaciones y píxeles útiles. No hay ráster nuevo en la app |
| NASA/JPL-Caltech, Perseverance Navcam | [Raw Images](https://mars.nasa.gov/mars2020/multimedia/raw-images/) | **Incorporadas**: dos imágenes browse JPEG auténticas, con ID, fecha, cámara, crédito y registro JSON. No son productos fotométricos calibrados ni mapas de composición |
| NASA/JPL-Caltech, mapa oficial Mars 2020 | [Waypoints](https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json), [configuración](https://mars.nasa.gov/maps/location/api/configure/get?mission=M20) | **Utilizados** para localizar el rover por coincidencia exacta de sol, sitio y drive/RMC. No se sustituye el DEM por las alturas de los waypoints |

Cita conservada: Sun, V.Z., and Stack, K.M., 2020, *Geologic map of Jezero crater and the Nili Planum region, Mars*: U.S. Geological Survey Scientific Investigations Map 3464, pamphlet 14 p., 1 sheet, scale 1:75,000, https://doi.org/10.3133/sim3464.

## SIM 3464: archivos y transformación ejecutada

Originales en `data/raw/usgs-sim3464/`, fuera de Git:

| Archivo oficial | Bytes locales | Función |
| --- | ---: | --- |
| [sim3464_database.zip](https://pubs.usgs.gov/sim/3464/sim3464_database.zip) | 349336873 | FileGDB, metadatos, simbología y rásteres auxiliares; se extrajeron solo vectores y metadatos |
| [sim3464.pdf](https://pubs.usgs.gov/sim/3464/sim3464.pdf) | 36406378 | Hoja publicada, leyenda y descripciones contrastadas |
| [sim3464_readme.txt](https://pubs.usgs.gov/sim/3464/sim3464_readme.txt) | 3914 | Cita, estructura GIS y advertencia de registro |
| [sim3464_metadata.txt](https://pubs.usgs.gov/sim/3464/sim3464_metadata.txt) | 20767 | XML de metadatos, aunque su extensión sea `.txt` |

Había **117817565184 bytes libres** antes de descargar. Se verificaron tamaños declarados cuando existían, SHA-256 locales y CRC de **todos** los miembros ZIP. SHA-256 del ZIP: `a88bd53a5573743cc4a20036c10e585106d08a433ad2f34af269e9cea1529f87`. No se afirma disponer de un checksum completo independiente publicado por USGS. Evidencias: [descarga](science-validation/usgs-downloads.json), [inspección de base y miembros](science-validation/sim3464-inspection.json), [hoja renderizada](science-validation/sim3464-sheet.png) y [texto extraído](science-validation/sim3464-map-text.txt).

La base contiene **1304 polígonos** de `GeoUnits_v1`. CRS original: `MTM_clon77.5E`, Transverse Mercator, meridiano central 77.5° E, escala 1, falso este/norte 0, esfera Mars 2000 de radio **3396190 m**. Se utilizó Pyogrio **0.13.0 / GDAL 3.12.4**, Shapely **2.2.0** y Pyproj **3.8.0** en `.venv`. Las comprobaciones independientes usan también Rasterio **1.5.2 / GDAL 3.12.2**, ya existente. No se asignó WGS84 terrestre.

CRS de destino, sin cambios:

```text
+proj=eqc +lat_ts=18.45 +lat_0=0 +lon_0=77.435 +R=3396190 +units=m +no_defs +type=crs
```

Se transformó la extensión hacia el CRS fuente para filtrar espacialmente con bordes densificados, se leyeron las geometrías WKB con su FID y se reproyectaron sus vértices. Después se intersectaron con el rectángulo exacto **[-1968,1091838,1968,1095398] m**. No se aplicó ninguna traslación de ajuste ni simplificación. En las seis geometrías candidatas no fue necesario reparar geometrías inválidas.

Resultados medidos: **6 polígonos recortados**, cinco unidades; todos válidos. Área del recorte y de su unión **14012160 m²**; área sin cobertura **0 m²**; solapamiento numérico **5.59×10⁻⁹ m²**. Máximo error numérico de transformación ida/vuelta en puntos interiores reales: **1.40×10⁻⁹ m**. Las pruebas verifican además pertenencia al polígono original y coincidencia con la transformación GDAL a **<0.001 m**. Estas cifras describen consistencia computacional, **no exactitud geológica**. [Informe medido](science-validation/geology-preparation.json).

| Símbolo | Nombre original FileGDB | Área recortada aproximada |
| --- | --- | ---: |
| NHjf2 | Jezero fan 2 unit | 2.468210 km² |
| Nue | Upper etched unit | 0.133066 km² |
| Nle | Lower etched unit | 3.249358 km² |
| Aeb | Eolian bedform unit | 0.221272 km² |
| Njf | Jezero floor unit | 7.940254 km² |

**Desfase preservado:** el README oficial indica offsets aleatorios de unos **100–200 m frente al CTX de operaciones de 2020**. No es un residual medido contra nuestro recorte HiRISE ni un intervalo estadístico garantizado. Reproyectar no corrige ese registro. La advertencia aparece en mapa, leyenda, fichas y exportación JSON; los contactos se dibujan discontinuos y no afectan a restricciones o costes de A*. Los colores son de The Meowrtian, no la simbología oficial reproducida.

## Tres objetivos científicos trazables

**M1–M3 son etiquetas del equipo, no estaciones ni nombres oficiales NASA/USGS.** Se escogieron centros de celdas válidas dentro de unidades presentes, priorizando la componente transitable que contiene el origen de demo a 15°. Dentro de cada unidad se maximiza la distancia al límite del polígono recortado. La conectividad se calculó con pendientes de celdas y segmentos, ocho vecinos y exclusión de esquinas. A* calculó posteriormente ambas rutas a los tres objetivos y las seis rutas pasaron auditorías independientes de aristas.

| Objetivo del equipo | Latitud planetocéntrica N / longitud E | x / y locales (m) | Celda col/fila | Unidad / OBJECTID | Margen al límite recortado |
| --- | --- | --- | --- | --- | ---: |
| M1 · Depósito de abanico | 18.468301750° / 77.412715725° | -1253 / 1094703 | 71 / 69 | NHjf2 / 1101 | 695.0 m |
| M2 · Unidad inferior erosionada | 18.441983606° / 77.439037135° | 227 / 1093143 | 219 / 225 | Nle / 983 | 558.5 m |
| M3 · Suelo de Jezero | 18.440633958° / 77.459489583° | 1377 / 1093063 | 334 / 233 | Njf / 1146 | 584.7 m |

Los identificadores exactos y atributos deben consultarse en [objectives.json](../public/data/jezero-science-v1/objectives.json); las pruebas cotejan el FID y la pertenencia también en la base original, antes del recorte.

- **M1:** comparar textura, relieve y posibles exposiciones estratificadas con el suelo; contrastar el contexto deltaico interpretado en SIM 3464. No se afirma haber observado estratificación en ese centro de celda.
- **M2:** documentar morfología y erosión de Nle y contrastar interpretaciones deposicionales. No se atribuyen minerales al punto a partir de una etiqueta de unidad.
- **M3:** comparar textura, craterización y relieve del suelo con las otras unidades. No se identifica una muestra o estación de Perseverance.

Cada ficha enlaza [Sun & Stack 2020](https://doi.org/10.3133/sim3464) y [los productos HiRISE](https://www.uahirise.org/dtm/ESP_045994_1985), conserva unidad original y método. Todos tienen máscara 1 y pendiente de celda ≤15°. La coordenada del centro se conoce en la malla; **la asignación geológica hereda el desfase documentado**. El tamaño 10 m de celda no es una precisión de localización del afloramiento. Tampoco un margen >200 m garantiza que la interpretación sea correcta o el terreno seguro.

## Fotografías Perseverance: correspondencia documental

Se consultó la API utilizada por Raw Images, se verificó que sus resultados pertenecieran al sol solicitado y se cruzaron `site` + `drive` con el **RMC exacto** de un waypoint oficial único del mismo sol. No se usó el campo `camera_position` como longitud/latitud: contiene coordenadas locales de cámara, no una geolocalización planetaria.

| Registro incorporado | Fecha UTC original | RMC coincidente | Latitud N / longitud E del rover |
| --- | --- | --- | --- |
| [Navcam, sol 14](https://mars.nasa.gov/mars2020/multimedia/raw-images/NLM_0014_0668187969_574ECM_N0030110AUT_04096_00_2LLJ) | 2021-03-05T03:47:52.335Z | 3_110 | 18.44454338° / 77.45094675° |
| [Navcam, sol 107](https://mars.nasa.gov/mars2020/multimedia/raw-images/NLF_0107_0676451875_145ECM_N0040644NCAM01107_01_195J) | 2021-06-08T19:20:40.929Z | 4_644 | 18.44187758° / 77.45067987° |

Ambas son `NAVCAM_LEFT`, crédito **NASA/JPL-Caltech**. Los JPEG medium de NASA se copiaron sin edición: **42430** y **57119 bytes**, respectivamente. Su correspondencia con el catálogo y hashes se conserva en [photos.json](../public/data/jezero-science-v1/photos.json) y [auditoría documental](science-validation/photo-localization.json). Los JSON originales de imagen y waypoint se guardaron en `data/raw/perseverance-photos/`.

Se verificaron posiciones dentro del recorte y máscara válida: celdas **286,210** y **284,226**. Las marcas R1/R2 representan el **rover**, no las coordenadas de rocas o paisajes visibles. El centro óptico no coincide exactamente con el centro del rover. El servicio no proporciona exactitud absoluta por waypoint: se conserva **null**, con advertencia, en vez de inventar ±N metros. No se enlazan esas fotos con M1–M3 por proximidad ni se infiere ubicación de blancos.

## Mars Trek: consultas reales, cobertura y decisión

La configuración pública permitió localizar el catálogo correcto: `/mars/TrekServices/ws/index/eq/searchItems`. Las variantes `EQ` y `equirect` devolvieron 404; se conservó el diagnóstico. Una búsqueda `within` sobre el pequeño AOI devuelve cero productos; **no implica ausencia de cobertura**. Con `intersects=true`, el catálogo devolvió **11 registros Jezero, 20 CRISM y 8 THEMIS** sobre `[77.40,18.42,77.47,18.48]`. No todos son rásteres ni mediciones nuevas. [Informe de consultas](science-validation/catalog-results.json) y [revisión de servicios](science-validation/trek-review.json).

| Producto consultado | Cobertura y compatibilidad comprobadas | Decisión |
| --- | --- | --- |
| THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018 | Bbox aproximadamente ±180° / ±65°, incluye Jezero; descripción oficial 100 m/píxel; servicio WMTS y GetCapabilities HTTP 200 | Aporta contexto de respuesta térmica nocturna. No integrado: no se descargaron ni calibraron píxeles; una tesela de visualización no sería un mapa de temperatura ni de peligro a 10 m |
| frt_07_brcarj_mtr3_ll, CRISM Carbonate Minerals V1 Fe-Mg | Intersección de catálogo; servicio **ArcGISFeature** disponible, correspondiente a cobertura/productos CRISM. No se verificaron espectros o píxeles útiles dentro del AOI | Candidato a fase espectral; **no demuestra carbonatos en nuestros objetivos** y no se usa en la app |
| HiRISE Jezero DEM Controlled, soc_006, 1 m | Bbox 77.2229331–77.583964° E, 18.3067994–18.669315° N; incluye AOI; catálogo consultado. La consulta de servicios de este registro devolvió cero servicios | Alternativa ya documentada en FUENTES; duplicaría topografía y exigiría nueva versión/registro. Se conserva el par PDS actual |
| CTX Jezero Mosaic Controlled, soc_008, 6 m | Bbox 77.1604655–77.6991776° E, 18.2110274–18.7211945° N; WMTS disponible | Duplica imagen con menor detalle; se conserva HiRISE |
| MOLA color/shade global, 463 m | Capabilities HTTP 200, extensión global y CRS marciano declarado | Contexto regional, innecesario para esta malla local; no integrado |

Las respuestas identifican `urn:ogc:def:crs:EPSG::104905`; esto **no se sustituye por WGS84**. La configuración de Trek contiene definiciones distintas de la esfera local —incluida una definición equirectangular geográfica elipsoidal—, por lo que una futura incorporación debe comprobar el CRS, tipo de latitud, resolución, datum y NoData del producto concreto y reproyectarlo. Se ha comprobado intersección de catálogo y disponibilidad de servicios; **no se declara compatibilidad de píxeles ni registro métrico de rásteres no procesados**. La app no hace consultas Trek en tiempo de ejecución.

## Créditos, condiciones de uso y dependencias

HiRISE declara sus imágenes de dominio público y solicita el crédito NASA/JPL/University of Arizona en su [política oficial](https://www.uahirise.org/media/usage.php). USGS considera sus datos producidos por la agencia de dominio público estadounidense, solicita atribución y distingue contenidos ajenos con derechos: [política USGS](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits). Se conserva la cita del producto y no se usa su marca como identidad de la app.

Las fotografías mantienen el crédito específico NASA/JPL-Caltech y enlaces a los registros. Se revisaron las [condiciones de uso de imágenes JPL](https://www.jpl.nasa.gov/jpl-image-use-policy/): conservar créditos, respetar excepciones y no atribuir aval de NASA/JPL/Caltech. La app no utiliza logos de las agencias ni imágenes de personas. La hoja USGS original conservada como evidencia mantiene sus marcas originales; no se presenta como diseño del equipo.

Se auditó lo instalado, sin asumir una licencia única para todo el proyecto:

| Material/software | Licencia/alcance comprobado |
| --- | --- |
| Next.js / React / React DOM | MIT; avisos originales y dependencias vendorizadas de Next conservados |
| OpenLayers | BSD-2-Clause |
| Lucide React | ISC, con sus avisos upstream, incluidos los relativos a iconos derivados |
| Manrope local | SIL OFL-1.1; tipografía sin modificaciones, avisos conservados |
| TypeScript / herramientas npm de pruebas y build | Inventario individual de las **88 distribuciones npm instaladas**. Sin licencias declaradas ausentes; avisos de seis paquetes sin archivo propio resueltos con la licencia del mismo proyecto upstream o el encabezado embebido de Esri/Lerc |
| Pyogrio / Pyproj | MIT; herramientas locales de preparación |
| Shapely / Rasterio / NumPy / SciPy / pytest y demás herramientas Python | Licencias individuales en inventario de **37 distribuciones** de `.venv`, sin distribución dentro de la web |
| PyMuPDF 2.1 | AGPL-3.0 o licencia comercial de Artifex, según metadata. Usado localmente para leer/renderizar el PDF, sin copiar su código al build. Sus paquetes auxiliares se registran en el inventario Python |
| Código, colores, fichas y selección de objetivos The Meowrtian | Autoría del equipo; el proyecto todavía **no declara una licencia abierta para su código propio**. No se hereda automáticamente MIT de las dependencias |

Los textos completos de licencias y copyrights npm están en [THIRD_PARTY_NOTICES.txt](../public/THIRD_PARTY_NOTICES.txt), también accesible desde Fuentes y método. Auditorías: [npm](science-validation/npm-licenses.json) y [Python](science-validation/python-licenses.json); versiones fijadas en `package-lock.json` y [requirements-geospatial.lock.txt](../requirements-geospatial.lock.txt). `pip check` no encontró dependencias incompatibles. Los scripts y HTML NASA consultados se conservan en `data/raw/resource-discovery/`; no se copian al producto web.

La auditoría Python recoge también archivos de licencia y clasificadores: Colorama declara BSD en su clasificador y conserva `LICENSE.txt`. Las distribuciones `pymupdf4llm` y `pymupdf_layout` 2.1 instaladas son metapaquetes sin código propio —solo cuatro archivos `.dist-info` cada una— y sin campo de licencia independiente; se registra esa ausencia, sin inventar una licencia. El código lector/renderizador está en PyMuPDF y conserva su declaración AGPL/comercial. Ninguno de estos paquetes Python se distribuye en `out/`.

## Archivos incorporados y reproducción

Paquete [jezero-science-v1](../public/data/jezero-science-v1/manifest.json): `geology.json`, `objectives.json`, `photos.json` y dos JPEG. Los cinco activos suman **249487 bytes**, más manifiesto. El loader verifica tamaños, SHA-256, CRS, identidad topográfica, celdas, coordenadas y relación RMC. Un error de integridad desactiva el contexto científico y deja disponible el planificador HiRISE; no se muestra un reemplazo ficticio.

Contrato explícito: geometrías poligonales y puntos en **metros proyectados de Marte**; no se anuncian como GeoJSON RFC 7946/WGS84. Manifiesto topográfico conservado: `31717c6421490dfea50ea17d8a4131d9b13408d8761e03d649e2588774009c85`. El manifiesto científico añade su propia identidad y `geologyAffectsRouting:false`; no modifica el manifiesto preparado original.

Desde las descargas oficiales conservadas:

```powershell
node scripts/data/download_science.mjs
& .\.venv\Scripts\python.exe scripts/data/inspect_science.py
& .\.venv\Scripts\python.exe scripts/data/prepare_geology.py
& .\.venv\Scripts\python.exe scripts/data/prepare_objectives.py
node scripts/data/prepare_photos.mjs
node scripts/data/seal_science.mjs
& .\.venv\Scripts\python.exe scripts/data/verify_science_reproducibility.py
node scripts/web/audit-licenses.mjs
npm run build
```

La preparación de fotos utiliza las respuestas NASA guardadas por `fetch_positions_trek.mjs` y `fetch_photo_candidates.mjs`; descarga páginas adicionales del sol si es necesario. Los scripts `research_resources.mjs`, `fetch_service_scripts.mjs`, `discover_services.mjs`, `resolve_nasa_services.mjs`, `query_science_catalogs.mjs` y `document_trek.mjs` conservan el diagnóstico de servicios, incluidas consultas inicialmente fallidas. Para reproducir el paquete validado se usan las respuestas conservadas, no una búsqueda nueva con datos potencialmente cambiantes. No hace falta ejecutar Python ni descargar originales para usar el build web.

Repetir reproyección, recorte y selección desde esos inputs dejó **6/6 archivos científicos idénticos en SHA-256**, incluidas las fotografías preservadas: [reproducibilidad](science-validation/reproducibility.json).

## Validación ejecutada y límites pendientes

| Comprobación | Resultado real | Evidencia |
| --- | --- | --- |
| A*, Dijkstra, métricas y workers originales | **37/37 Vitest** | log (local-only evidence omitted from source release), [JSON](routing-validation/vitest.json) |
| Interfaz/contratos, con casos nuevos | **27/27 Vitest**: 15 helpers/contratos y **12 pruebas Chrome** | log (local-only evidence omitted from source release), [JSON](interface-validation/vitest.json), [navegador](interface-validation/browser.json) |
| Datos originales + geología/objetivos/fotos | **22/22 pytest** | log (local-only evidence omitted from source release), JUnit (local-only evidence omitted from source release) |
| Typecheck | Correcto | log (local-only evidence omitted from source release) |
| Next.js estático | Correcto, **66 archivos / 6111083 bytes** | build (local-only evidence omitted from source release) |
| Repetición del paquete nuevo | **6/6 hashes idénticos** | [reproducibilidad](science-validation/reproducibility.json) |
| Integridad de entrega | Copias estáticas, 4 inputs USGS, 136 archivos extraídos, identificadores y enlaces cotejados | [comprobación final](science-validation/final-checks.json) |

Se probó un clic en **x=427, y=1093293 m**, que retornó **Nle / OBJECTID 983** en OpenLayers. Se contrastó el polígono con la base fuente y GDAL, sin pasar por coordenadas terrestres. Al mostrar/ocultar geología, el coste B del ejemplo se mantuvo exactamente en **4932.615239510466**, y los recorridos coinciden con el motor anterior.

Los tres marcadores M1–M3 se consultaron por clic sobre sus posiciones reales. La ruta B al objetivo M3 desde el origen de demo produjo **3118.650071 m** horizontales y coste **4487.520853**; su JSON descargado contiene contexto científico e incertidumbre y pasó auditoría independiente: [ficha real](science-validation/scientific-route-b.json). Las seis rutas a objetivos también pasaron las comprobaciones unitarias de celdas/aristas.

Las dos fotos se cargaron como JPEG reales, con fecha, RMC y créditos comprobados en navegador. Se verificaron escritorio y móvil, sin solicitudes externas ni errores JavaScript/HTTP de activos. Capturas inspeccionadas: [geología y leyenda](science-validation/geology-desktop.png), [Perseverance](science-validation/perseverance-desktop.png), [ficha móvil](science-validation/science-mobile.png). La consulta inicial de unidad interceptaba la etiqueta interactiva M2; se movió el clic de prueba dentro de la misma unidad y fuera del marcador, conservando la prioridad correcta de los objetivos.

No quedan fallos conocidos en los casos ejecutados. Permanecen como límites científicos: registro geológico de 100–200 m, escala de publicación, carácter interpretativo y fecha 2020, ausencia de precisión absoluta individual de los waypoints, imposibilidad de geolocalizar blancos de fotos por este método y ausencia de validación espectral local CRISM. No se han certificado seguridad EVA, transitabilidad física, composición por punto, otros navegadores/dispositivos físicos ni un hosting desplegado. No se publicó en producción.

Las comprobaciones finales se pueden repetir con `node scripts/routing/check-evidence.mjs`, `node scripts/web/check-evidence.mjs` y `node scripts/web/check-science-evidence.mjs`. Verifican archivos e informes ya generados; no sustituyen ejecutar las suites.
