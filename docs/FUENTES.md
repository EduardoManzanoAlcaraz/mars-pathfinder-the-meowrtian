# Fuentes y comprobación de datos — Mars Pathfinder

**Actualización científica posterior:** SIM 3464 se descargó, abrió, reproyectó y recortó realmente; tres objetivos del equipo y dos fotos Perseverance con correspondencia RMC/sol ya están integrados. Mars Trek se consultó, sin incorporar sus rásteres. Resultados, créditos y límites en [NASA_RESOURCES.md](NASA_RESOURCES.md). Las comprobaciones iniciales de este documento se conservan como registro histórico.

Investigación inicial realizada el **14 de noviembre de 2026**. Timestamps UTC, respuestas y tamaños exactos en [http-checks.json](research/evidence/http-checks.json); historial de ejecuciones conservadas (local-only evidence omitted from source release). Esa investigación usó HEAD y lecturas pequeñas. **Después se descargó y validó realmente el par HiRISE PDS**, como se documenta en la sección 7 y en [VALIDACION_GEOESPACIAL.md](VALIDACION_GEOESPACIAL.md).

## 1. HiRISE PDS: opción preferida por volumen

Instituciones: NASA/JPL-Caltech/University of Arizona; la etiqueta identifica también USGS-Astrogeology como productor. Producto estéreo MRO HiRISE.

- [Ficha del DTM y ortoimágenes](https://www.uahirise.org/dtm/ESP_045994_1985).
- [Directorio oficial de productos](https://www.uahirise.org/PDS/DTM/ESP/ORB_045900_045999/ESP_045994_1985_ESP_046060_1985/).
- [DEM DTEEC_045994_1985_046060_1985_U01.IMG](https://www.uahirise.org/PDS/DTM/ESP/ORB_045900_045999/ESP_045994_1985_ESP_046060_1985/DTEEC_045994_1985_046060_1985_U01.IMG): **380,814,764 bytes**, PDS3 con etiqueta adjunta; HEAD 200, GET parcial 206.
- [Orto ESP_046060_1985_RED_C_01_ORTHO.JP2](https://www.uahirise.org/PDS/DTM/ESP/ORB_045900_045999/ESP_045994_1985_ESP_046060_1985/ESP_046060_1985_RED_C_01_ORTHO.JP2): **33,534,820 bytes**, JPEG2000; 200/206.
- [Etiqueta de la ortoimagen](https://www.uahirise.org/PDS/DTM/ESP/ORB_045900_045999/ESP_045994_1985_ESP_046060_1985/ESP_046060_1985_RED_C_01_ORTHO.LBL): 200 y contenido leído.

**Compatibilidad observada en etiquetas:** ambos productos tienen 6673 columnas × 14266 filas, proyección equirectangular planetocéntrica, longitud positiva al este, centro de proyección 77.44° E / 15° N, esfera auxiliar de radio 3394.8398133163 km y muestreo **1.0096633268711 m/píxel**. Límites declarados comunes: 77.3833804–77.50109494° E y 18.305293550569–18.548391096554° N. El `SOURCE_PRODUCT_ID` de la ortoimagen incluye el DTM exacto.

La etiqueta del DEM declara muestras de elevación Float32, factor 1, offset 0, referencia a superficie equipotencial marciana y valor de ausencia `16#FF7FFFFB#`. Los límites verticales que aparecen en la etiqueta son metadatos del productor, no estadísticas calculadas sobre nuestro AOI. Se usará la máscara interpretada por GDAL y se comprobará contra la etiqueta.

La orto RED_C es una imagen monocroma del filtro RED, con muestras de 8 bits; no es un mapa de minerales ni una fotografía RGB. La letra C del nombre no se interpretará como una banda de color.

Evidencia inicial: [etiqueta DEM](research/evidence/hirise-pds-dem-label.txt) y [etiqueta orto](research/evidence/hirise-pds-ortho-label.txt). **Validación posterior completada:** apertura con GDAL, lectura de píxeles, recorte y revisión visual. Se detectó una discrepancia importante al abrir el JP2 directamente; debe utilizarse su **LBL oficial** como entrada georreferenciada. Véase la sección 7.

Uso: [política oficial HiRISE](https://www.uahirise.org/media/usage.php), imágenes de dominio público y crédito solicitado a NASA/JPL/University of Arizona. Conservar también autores/producto en el manifiesto.

## 2. HiRISE USGS TRN: alternativa con cuadrícula común comprobada

Catálogo: [productos del lugar de aterrizaje Mars 2020](https://astrogeology.usgs.gov/search/map/mars-2020-jezero-crater-landing-site-products) y [ficha de la ortoimagen](https://astrogeology.usgs.gov/search/map/Mars/Mars2020/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first).

- [DEM correcto, MOLAtopography, TIFF](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/HiRISE/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif): **1,839,545,409 bytes**, HTTP 200/206; 21400 × 21488, 1 m/píxel, Float32.
- [Ortoimagen, BigTIFF](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/HiRISE/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first.tif): **7,358,523,457 bytes**, 200/206; 85600 × 85952, 0.25 m/píxel, 8 bits monocromo.

**Importante:** el nombre alternativo con `MOLA_topography` devolvió 404 en S3. No usarlo como descarga válida.

Se inspeccionaron directamente los tags TIFF, incluidos PixelScale, Tiepoint, GeoKeyDirectory, GeoDoubleParams, GeoAsciiParams y NoData. Ambos productos tienen los mismos GeoKeys y origen; extensión proyectada `[4577366, 1085130, 4598766, 1106618]` m. Equirectangular sobre esfera de radio 3396190 m, paralelo estándar y meridiano central 0°. Los píxeles de DEM y orto se relacionan 1:4, con límites coincidentes.

Límites geográficos rectangulares **calculados desde los tags**, no huella de píxeles válidos: aproximadamente 77.222933–77.583964° E, 18.306799–18.669315° N. El rectángulo propuesto está dentro. NoData: DEM `-3.40282265508890445e+38`, orto `0`.

Las cabeceras indican TIFF sin compresión; no se ha certificado que sean COG ni que leer una ventana con GDAL resulte barato. Medir bytes transferidos antes de adoptar esta opción. Confirmar referencia vertical en la documentación del producto antes de derivar métricas. No combinar sus alturas con PDS por compartir la palabra MOLA en una referencia.

Evidencia: [resumen de metadatos](research/evidence/metadata-summary.json) y cabeceras binarias acotadas en `research/evidence/`. Procedencia científica: productos oficiales derivados de observaciones estéreo; pendientes/rutas posteriores serán derivados del equipo.

## 3. CTX USGS: respaldo de menor volumen

- [Ficha del DEM Science Investigation](https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic).
- [DEM M20_JezeroCrater_CTXDEM_20m.tif](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/ScienceInvestigationMaps_JPL/M20_JezeroCrater_CTXDEM_20m.tif): **90,345,300 bytes**, HTTP 200/206; 4456 × 5067, 20 m/píxel, Float32.
- [Orto JEZ_ctx_B_soc_008, 6 m/píxel](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0.tif): **36,269,402 bytes**, 200/206; 5322 × 5040, 8 bits.

Ambos usan esfera de radio 3396190 m y equirectangular. El DEM usa paralelo estándar **18.4663°** y la orto **0°**; no están en la misma cuadrícula. Los límites calculados son, respectivamente, aproximadamente `[76.997437, 17.580520, 78.582563, 19.290187]` y `[77.160465, 18.211027, 77.699178, 18.721194]`. Ambos incluyen el AOI propuesto. Reproyectar y alinear explícitamente antes de combinarlos.

NoData del DEM: `-3.4028234663852886e+38`; orto: `0`. La máscara útil y los valores reales del recorte quedan pendientes. Este respaldo sirve para una demostración regional; no resuelve obstáculos a escala de pasos de astronauta. No llamar «1 m» a sus pendientes mediante interpolación.

## 4. Geología USGS SIM 3464: tercer dominio científico

Sun, V.Z., y Stack, K.M., 2020. *Geologic map of Jezero crater and the Nili Planum region, Mars*. USGS Scientific Investigations Map 3464, escala **1:75,000**. [DOI 10.3133/sim3464](https://doi.org/10.3133/sim3464).

- [Directorio de publicación](https://pubs.usgs.gov/sim/3464/), leído directamente pese a bloqueos del navegador de investigación.
- [Base GIS ZIP](https://pubs.usgs.gov/sim/3464/sim3464_database.zip): **349,336,873 bytes**, HEAD 200; índice y archivos pequeños extraídos mediante rangos 206.
- [README oficial](https://pubs.usgs.gov/sim/3464/sim3464_readme.txt), [metadatos](https://pubs.usgs.gov/sim/3464/sim3464_metadata.txt) y [mapa PDF](https://pubs.usgs.gov/sim/3464/sim3464.pdf). El PDF se localizó en el directorio; no se descargó ni se revisó visualmente en esta investigación.

**Formato realmente observado:** File Geodatabase `Nili.gdb`, proyecto MXD, simbología, rásteres auxiliares y archivos `.prj`. El README identifica la capa de polígonos `GeoUnits_v1`; los nombres efectivos se confirmarán con OGR al abrir la base. No asumir un shapefile por una referencia del metadato a una tabla `.shp`.

Cobertura declarada: **76.8–77.8° E y 17.7–18.7° N**. Proyección Transverse Mercator, meridiano central 77.5° E, factor 1, esfera Mars 2000 de radio 3396190 m. Evidencia extraída del ZIP: [proyección TM](research/evidence/MTM_clon77_5E.prj), [sistema geográfico](research/evidence/Mars2000_Sphere.prj) y metadatos internos (local-only evidence omitted from source release).

**Limitación decisiva:** [README conservado](research/evidence/sim3464-readme.txt) y metadatos documentan offsets aleatorios del orden de **100–200 m** frente al mosaico CTX de operaciones de 2020. Es una limitación del registro cartográfico, no un error que desaparezca cambiando de CRS. Mostrar geología como contexto e interpretación publicada; excluirla del coste de peligro del MVP. La escala de publicación tampoco acredita precisión métrica de sus contactos.

Las unidades sirven para explicar diversidad geológica y seleccionar sitios de estudio. No son mediciones de capacidad portante, pendientes, presencia de organismos o toxicidad. Preservar la cita de autores solicitada en el README y las condiciones de uso del producto en el manifiesto final.

## 5. Extensión localizada y aplazada

[USGS Mars Sample Return TRN HiRISE DTM and Orthoimage Mosaics](https://astrogeology.usgs.gov/search/map/mars-sample-return-terrain-relative-navigation-hirise-dtm-mosaic), DOI [10.5066/P13CPYYU](https://doi.org/10.5066/P13CPYYU), publicación de catálogo 2025. El [ZIP oficial](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/MSR_TRN_HiRISE_soc_003_USGS_release_aug2024/MSR_TRN_HiRISE_soc_003_USGS_release_aug2024_mosaics.zip) respondió HEAD 200, tamaño **5,468,062,403 bytes**. No se inspeccionaron sus rásteres ni se verificó su cobertura conjunta con el AOI. Se aplaza por volumen y por no ser necesario para esta región.

El catálogo describe productos de confianza adicionales. No convertirlos en una probabilidad de seguridad de EVA sin interpretar su definición. La existencia de este conjunto no es una afirmación sobre el estado actual del programa Mars Sample Return.

## 6. Método de verificación y límites

Herramientas de investigación guardadas:

```powershell
node docs/research/probe-sources.mjs
node docs/research/inspect-metadata.mjs
```

Requieren Node.js con acceso HTTPS. La primera consulta HEAD y GET acotados; la segunda interpreta tags TIFF y un índice ZIP, con solicitudes de metadatos limitadas a 1 MB. No necesitan credenciales. Las cabeceras conservadas excluyen cookies. Los resultados actuales proceden de ejecuciones reales; una ejecución posterior puede variar por disponibilidad de red.

En este entorno hubo que permitir acceso de red fuera del sandbox para realizar solicitudes públicas. El lector web, por separado, devolvió 403/502 en algunas páginas. Eso no se ha interpretado como inexistencia del archivo.

### Comprobado en la investigación inicial

- Existencia de los archivos indicados y respuesta HTTP de sus servidores, incluidas lecturas por rangos.
- Tamaños declarados por HEAD; firmas de archivos, tags TIFF y etiquetas PDS descargados parcialmente.
- Compatibilidad de metadatos de los pares HiRISE y cobertura rectangular común del AOI.
- Diferencia de proyección entre DEM e imagen CTX.
- Formato y proyecciones de SIM 3464; limitación posicional documentada.

### Estado de los pendientes originales

- **Completado para HiRISE PDS:** descarga y lectura real con GDAL, SHA-256 completos, máscara común y revisión visual. No se ha demostrado precisión geodésica externa o subpíxel.
- **Completado para HiRISE PDS:** referencia vertical según etiqueta, estadísticas del AOI y pruebas de pendientes. Las alternativas TRN/CTX conservan sus comprobaciones pendientes si se adoptan después.
- Lectura de las geometrías geológicas y selección documentada de POI.
- Pruebas de algoritmo, métricas, interfaz, rendimiento, build y despliegue.

Actualización posterior: algoritmo y contraste con Dijkstra comprobados en [VALIDACION_RUTAS.md](VALIDACION_RUTAS.md); mapa, métricas, exportación y build estático comprobados en [VALIDACION_INTERFAZ.md](VALIDACION_INTERFAZ.md). El despliegue sigue pendiente.

Las comprobaciones iniciales no acreditaban píxeles válidos dentro de todo el rectángulo. La validación posterior midió explícitamente su cobertura y conservó las exclusiones; ninguna de ellas certifica seguridad de una ruta EVA.

## 7. HiRISE realmente utilizado y validado

Se descargaron **IMG + JP2 RED_C + LBL**, 414,355,016 bytes en `data/raw/hirise-pds/`, excluido de Git. Se guardaron tamaños, SHA-256 completos y cotejo con las muestras oficiales iniciales; no se dispone de un checksum completo independiente del editor en las etiquetas consultadas. [Manifest de descarga](validation/downloads.json).

Con Windows/Python 3.14.7 y Rasterio 1.5.2/GDAL 3.12.2, el JP2 directo interpreta `lat_0=15, lat_ts=0`, mientras que el LBL usa `lat_0=0, lat_ts=15` y coincide con el DTM. Además, los orígenes difieren 1.5 píxeles. **Abrir la orto por `.LBL`**, según la [documentación del driver PDS](https://gdal.org/en/stable/drivers/raster/pds.html); no asignar el CRS del JP2 directo ni desplazarlo manualmente. Los valores de imagen coinciden en cinco ventanas leídas por ambas entradas.

El escaneo completo encontró **73.652030 % de píxeles conjuntamente válidos**. El AOI `[77.40,18.42,77.47,18.48]` se preparó a 2 m, con **1968 × 1780** píxeles y **99.496466 %** de celdas válidas para derivados. Se generaron DEM, ortoimagen, pendiente en grados, sombreado sintético, máscaras y previews. La malla posterior de 10 m tiene **394 × 356 celdas**, pendiente máxima por bloque y máscaras conservadoras; los arrays se exportaron sin implementar A*.

Las comprobaciones de píxeles y coordenadas, la inspección de contornos/relieve, los problemas de NoData corregidos y todas las limitaciones se detallan en [VALIDACION_GEOESPACIAL.md](VALIDACION_GEOESPACIAL.md). **16 pruebas aprobadas** y **19 salidas idénticas en SHA-256 al repetir**; [informe del recorte](validation/crop-report.json) y [reproducibilidad](validation/reproducibility.json). No se usaron TRN, CTX ni la geodatabase geológica para producir este paquete.
