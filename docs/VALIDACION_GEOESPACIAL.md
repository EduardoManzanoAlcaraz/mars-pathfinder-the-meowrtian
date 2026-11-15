# Validación geoespacial real de HiRISE

**Nota de fase posterior:** el motor A* ya se implementó y validó sin cambiar este paquete; véase [VALIDACION_RUTAS.md](VALIDACION_RUTAS.md). Este informe conserva los resultados y el alcance de la fase de preparación.

**Resultado: sí, el paquete topográfico está preparado para desarrollar y probar A*.** Se han abierto los originales, leído sus píxeles completos por bloques, comprobado su solapamiento efectivo, preparado recortes y derivados, inspeccionado las figuras y ejecutado pruebas. No se ha desarrollado la interfaz ni el algoritmo de rutas.

Fecha: **14 de noviembre de 2026**, Europe/Madrid. Los informes máquina conservan timestamps UTC. Este trabajo cubre el subconjunto HiRISE de la fase 1; la integración de geología y los POI del MVP siguen pendientes.

## Entorno realmente utilizado

| Componente | Resultado medido |
| --- | --- |
| Sistema | Windows 11, AMD64, build 26300 |
| Python | 3.14.7, MSVC 1944, 64 bits |
| Entorno | `.venv/`, creado desde el Python existente; sin instalar paquetes globales |
| Rasterio / GDAL enlazado | 1.5.2 / **3.12.2** |
| PROJ de Rasterio / pyproj | 9.7.1 / 9.8.1, respectivamente; pyproj 3.8.0 |
| NumPy / SciPy | 2.5.4 / 1.18.1 |
| Pillow / Matplotlib / pytest | 13.0.0 / 3.11.2 / 9.2.0 |
| Drivers efectivos | **PDS, PDS4, JP2OpenJPEG, GTiff y PNG** disponibles |
| Dependencias | `pip check`: `No broken requirements found.` |
| Espacio disponible antes de instalar | 113,805,787,136 bytes, aproximadamente 106 GiB |
| Espacio inmediatamente antes de descargar | 113,474,019,328 bytes |

Evidencias: environment.json (local-only evidence omitted from source release), informe de instalación (local-only evidence omitted from source release), [instalación de Matplotlib](validation/matplotlib-install.json) y [versiones completas fijadas](../requirements-geospatial.lock.txt). Las versiones PROJ pertenecen a ruedas distintas; se comprobó su interoperabilidad con datos y coordenadas reales, no se presupuso por tener números parecidos.

No había `python` en PATH, y ejecutar el intérprete desde el sandbox devolvió acceso denegado. El intérprete existente y `.venv` funcionaron al ejecutar fuera de ese sandbox. No se reemplazó Python del usuario. **No están instalados `gdalinfo` independiente ni los bindings `osgeo`**: GDAL se ejecutó mediante la API Python de Rasterio, que abre PDS/JP2 y realiza la reproyección. No se afirma haber ejecutado comandos GDAL inexistentes.

## Originales descargados e integridad

Antes de descargar se comprobó que no existía `data/raw/`. Los originales están ahora en `data/raw/hirise-pds/`, excluido en [.gitignore](../.gitignore). No se descargó la ortoimagen RED_A de máxima resolución ni la alternativa CTX.

| Archivo | Bytes realmente guardados | SHA-256 completo |
| --- | ---: | --- |
| `DTEEC_045994_1985_046060_1985_U01.IMG` | 380,814,764 | `b40739b4d32516ef9b3cd849f519a6a20df9720b5369a9c141047ced27c57654` |
| `ESP_046060_1985_RED_C_01_ORTHO.JP2` | 33,534,820 | `7dc1d5ccfc7ad368b2651e9aa476733e83a1814ed88d11b2bad62c677eca6ed2` |
| `ESP_046060_1985_RED_C_01_ORTHO.LBL` | 5,432 | `25be59938b86f73e3d7479bc16388d033059f3961f42f18381e2a5e4735d96c2` |

Proceden del [directorio oficial HiRISE](https://www.uahirise.org/PDS/DTM/ESP/ORB_045900_045999/ESP_045994_1985_ESP_046060_1985/). Total: **414,355,016 bytes**. El descargador usa streaming, comprueba el tamaño esperado contra Content-Length y los bytes recibidos, calcula SHA-256 del archivo guardado y compara sus primeros 65,536 bytes —o la etiqueta completa— con las muestras oficiales conservadas en la investigación inicial. La preparación vuelve a comprobar el SHA-256 completo antes de procesar.

No se encontró un checksum completo del editor en las etiquetas utilizadas. Por tanto, los SHA-256 fijan la identidad de nuestra copia y detectan cambios posteriores; no se presentan como cotejo contra un digest independiente publicado por el editor. La lectura completa posterior con los decodificadores PDS y JP2 también terminó sin errores. [Manifest de descarga y cabeceras](validation/downloads.json).

## Georreferenciación: discrepancia detectada y resolución

Abrir directamente el `.JP2` **no produjo una georreferenciación equivalente a la del DTM** en este entorno:

| Entrada | Interpretación de GDAL 3.12.2 |
| --- | --- |
| DEM `.IMG` | Equirectangular, `lat_ts=15`, `lat_0=0`, `lon_0=77.44`, `R=3394839.8133163 m` |
| Orto `.JP2` directa | Equirectangular, `lat_ts=0`, `lat_0=15`, mismo meridiano y radio; además otro origen afín |
| Orto abierta mediante `.LBL` | **Mismo CRS, transformación, dimensiones y resolución que el DEM** |

La diferencia de origen del JP2 directo es **+1.5 píxeles en x y −1.5 píxeles en y**, comparando los coeficientes proyectados; cada píxel proyectado mide 1.0096633268711 m. El problema de CRS es adicional: no se arreglaría solo trasladando 1.5 píxeles.

Se adoptó la etiqueta PDS oficial como autoridad geoespacial: `rasterio.open('...ORTHO.LBL')`. El driver PDS decodifica el JP2 asociado. Esto sigue la [recomendación de GDAL de usar el `.lbl` cuando existe](https://gdal.org/en/stable/drivers/raster/pds.html). No se editaron los originales ni se aplicó una traslación empírica. **Cinco ventanas de 32 × 32 píxeles leídas por JP2 y por LBL contenían valores idénticos**: la diferencia está en la interpretación geoespacial, no en haber elegido otra imagen. No se atribuye aquí la causa al encoder o al lector sin un análisis adicional.

Par utilizado mediante PDS:

- **6673 × 14266**, una banda; DEM Float32, imagen RED monocroma de 8 bits.
- Resolución nativa proyectada: **1.0096633268711 m/píxel** en ambos ejes.
- Transformación GDAL común: `[-3242.028942583203, 1.0096633268711, 0, 1099014.4926458849, 0, -1.0096633268711]`.
- Extensión proyectada común: `[-3242.028942583203, 1084610.6356247417, 3495.4544376276467, 1099014.4926458849]` m.
- Coordenadas geográficas marcianas planetocéntricas, longitud positiva al este. No WGS84 terrestre.
- DEM: metros sobre la superficie equipotencial marciana indicada por la etiqueta, factor 1 y offset 0. La reproyección horizontal conserva estas alturas; no hay transformación de datum vertical.
- Imagen: se trabaja con DN para visualización. No se interpreta como albedo cuantitativo ni como composición mineralógica.

[Metadatos y comparación JP2/LBL ejecutados](validation/sources.json).

## Solapamiento efectivo y región seleccionada

Se recorrieron **95,197,018 píxeles de cada original**, en ventanas de 256 filas, sin cargar los rásteres completos en arrays. Un píxel DEM válido requiere máscara válida, finitud y ausencia de constantes especiales PDS. Para la orto se excluyen DN 0, 1 y 255, conforme a null/saturación de su etiqueta.

| Medida en originales completos | Resultado |
| --- | ---: |
| DEM válido | 70,220,645 píxeles; 73.763492 % |
| Orto válida | 70,114,536 píxeles; 73.652030 % |
| Intersección válida efectiva | **70,114,536 píxeles; 73.652030 %** |
| DEM no finito | 0 píxeles |
| Máscara GDAL válida pero constante PDS extrema | 0 píxeles |
| Elevación global leída, no solo declarada | −2679.201904 a −2388.305176 m |

La envolvente de la intersección tiene límites `[-3236.9806259488473, 1084611.6452880686, 3490.406120993291, 1099010.4539925773]` m. **Es una envolvente, no un polígono totalmente lleno:** persisten huecos e irregularidades de cobertura. Las máscaras se conservaron; no se rellenaron con terreno llano.

Se mantuvo el rectángulo propuesto en el plan: **77.40–77.47° E, 18.42–18.48° N**, con escarpes, depresiones circulares y suelo de menor pendiente visibles. Es suficientemente pequeño para una demostración de excursión, no una estimación de autonomía EVA. Se extrajo una ventana fuente de **3985 × 3538 píxeles**, con margen de ocho píxeles: columna 935, fila 4006.

Para pendientes y distancias locales se transformó a:

```text
+proj=eqc +lat_ts=18.45 +lat_0=0 +lon_0=77.435
+R=3396190 +units=m +no_defs +type=crs
```

La cuadrícula local se ajusta hacia fuera a múltiplos de 2 m. Su WKT completo y los parámetros están en [manifest.json](../data/processed/jezero-hirise-v1/manifest.json).

| Resultado del recorte local | Medido |
| --- | ---: |
| Dimensiones / resolución | **1968 × 1780; 2 m/píxel** |
| Extensión local `[xmin,ymin,xmax,ymax]` | **[−1968, 1091838, 1968, 1095398] m** |
| Tamaño del rectángulo ajustado | **3936 × 3560 m** |
| DEM válido | 100.000000 % |
| Orto válida | 99.895120 % |
| Cobertura conjunta conservadora | 99.794493 % |
| Celdas válidas para pendiente/sombreado | **99.496466 %** |
| Elevación sobre celdas válidas | **−2614.888672 a −2442.878662 m** |
| Pendiente mediana / P95 / P99 | **2.923275° / 13.372228° / 23.443184°** |
| Pendiente máxima conservada | **71.455887°** |

Los porcentajes difieren porque se excluyen saturaciones, vecindades próximas a huecos y el borde sin stencil completo. El porcentaje útil no se dedujo de los límites del mapa: se midió leyendo máscaras y píxeles.

## Evidencias de alineación más allá de los metadatos

**Comprobación numérica con datos:** cinco centros de píxel distribuidos en el recorte se transformaron de la cuadrícula local a la fuente mediante pyproj. Sus valores reales se compararon con una reproyección nearest-neighbour independiente realizada por GDAL. Resultado en los cinco: **diferencia 0 m en elevación y 0 DN en imagen**. Esto verifica el mapeo de los datos y la convención de centros; no es exactitud geodésica externa.

Error máximo de ida/vuelta de coordenadas: **1.91 × 10⁻¹⁰ m**, numérico. La diferencia máxima observada entre distancias de la cuadrícula local y geodésicas sobre la esfera marciana fue **0.012238 %**, en tres segmentos de control. [Puntos y valores completos](validation/crop-report.json).

**Inspección visual ejecutada:** se revisaron la vista general, la superposición de curvas y cinco pares de ventanas de 512 × 512 m. Se observaron coincidencias entre las depresiones circulares central y oriental, el escarpe noroeste y el relieve aislado al sudoeste. Las cinco ventanas muestran correspondencia de estructuras amplias; la textura fina y las sombras de la imagen no se reproducen necesariamente en el DTM.

- [Vista general PNG](../data/processed/jezero-hirise-v1/preview.png).
- [Ortoimagen y curvas de elevación cada 5 m](../data/processed/jezero-hirise-v1/alignment_overlay.png).
- [Cinco ventanas de ortoimagen y relieve](../data/processed/jezero-hirise-v1/alignment_windows.png).
- [Registro de la revisión visual y su alcance](validation/visual-inspection.json).

La evidencia sustenta **compatibilidad espacial útil para este prototipo**, sin un desplazamiento grueso aparente. No se ha estimado un RMSE con puntos de control independientes, ni demostrado alineación subpíxel o exactitud absoluta de 1–2 m. La resolución de la cuadrícula no es una certificación de exactitud del sensor.

## Pendientes, NoData y posibles artefactos

Se remuestrearon DEM e imagen con bilinear a la malla local de 2 m. Las pendientes se calcularon con diferencias centrales en x/y métricos y `degrees(atan(hypot(dz_dx,dz_dy)))`; solo se aceptan stencils 3 × 3 completamente válidos. Se procesan bloques de 512 × 512 con halo, sin costuras entre bloques. Gradientes en Float64, salida Float32; esto evita error aritmético adicional y no mejora la precisión original del DEM.

El sombreado usa una luz **sintética** de azimut 315° y altura 45°, únicamente para inspección. No representa iluminación solar prevista para una EVA. En las figuras general y de contornos, rosa significa ausencia de datos conjuntos válidos; en las ventanas de relieve, el valor negro 0 también puede ser NoData.

Diagnósticos ejecutados:

- 344 celdas válidas con pendiente superior a 45°; máximo cerca de fila 1192 / columna 256, en el sector de relieve abrupto del sudoeste.
- Residuo máximo frente a la mediana local 3 × 3: **1.875732 m**. No hubo celdas válidas con residuo superior al umbral diagnóstico de 5 m.
- No aparecieron NaN en la lectura global del DTM ni constantes especiales inadvertidas por la máscara.
- La prueba de pendientes en una ventana que cruza el borde de bloque 512 pasó.

No se recibió un ráster de confianza estéreo ni se dispone de verdad terreno. Las pendientes grandes pueden ser escarpes reales, errores estéreo o una combinación. El diagnóstico de mediana no demuestra ausencia de artefactos más suaves o correlacionados. No se aplanaron ni corrigieron esas zonas arbitrariamente. El futuro planificador deberá aplicar su límite de pendiente y mantener las exclusiones por datos desconocidos.

### Fallos encontrados por las pruebas y corregidos

La primera suite produjo **3 fallos y 11 aciertos**, conservados en pytest-initial.log (local-only evidence omitted from source release). Dos correspondían al error de redondeo del gradiente en el fixture analítico; se corrigió la aritmética intermedia. El tercero reveló que el min-remuestreo utilizado para una máscara 0/1 ignoraba ceros y podía marcar huecos como válidos.

Se reprodujo el comportamiento en un fixture pequeño y en los datos reales: [diagnóstico anterior a la corrección](validation/mask-diagnostic.json). La solución usa **1=inválido, 2=válido, 0=exterior/NoData** antes del min-remuestreo; después solo el código 2 se convierte en válido. Se añadió además una comprobación directa de validez de la imagen al calcular derivados. Una prueba de regresión exige que un solo píxel inválido bloquee su celda reducida. No se ha extrapolado este comportamiento a todas las versiones o configuraciones de GDAL.

## Paquete preparado para A*

Carpeta: **`data/processed/jezero-hirise-v1/`**. Los originales y los GeoTIFF reproducibles están excluidos de Git; scripts, configuración, manifest, informes y previews quedan disponibles en el proyecto.

| Archivos | Uso |
| --- | --- |
| `dem_source_crop.tif`, `ortho_source_crop.tif` | Ventanas nativas georreferenciadas, con NoData normalizado |
| `source_coverage_mask.tif` | Máscara fuente codificada 0/1/2 para remuestreo conservador |
| `dem.tif`, `ortho.tif` | Recortes locales alineados de 2 m |
| `coverage_codes.tif`, `coverage_mask.tif` | Códigos intermedios y cobertura conjunta conservadora 0/1 |
| `slope_deg.tif`, `hillshade.tif`, `valid_mask.tif` | Pendiente en grados, sombreado de inspección y máscara final 0/1 |
| `routing_dem_10m.tif` | Elevación media de cada bloque 5 × 5 de la malla fina |
| `routing_slope_max_10m.tif` | **Máxima** pendiente fina por bloque; no promedio |
| `routing_valid_10m.tif` | Celda válida solo si todos los píxeles finos lo son; bordes parciales bloqueados |
| `routing_elevation.f32`, `routing_slope_max.f32`, `routing_valid.u8` | Los mismos datos en arrays planos, listos para cargar después en TypeScript |
| `preview.png`, `alignment_overlay.png`, `alignment_windows.png` | Evidencia visual |
| `manifest.json` | CRS, transformaciones, formas, unidades, procedencia, estadísticas y hashes |

**Contrato de la malla de 10 m:** 394 columnas × 356 filas = **140,264 celdas**; orden por filas desde el norte, little-endian, Float32 para elevación/pendiente y Uint8 para máscara. NoData Float32 = −9999. Centros en `col+0.5,row+0.5`; transformación `[-1968,10,0,1095398,0,-10]`. La última columna parcial se bloquea. Máscara 1 significa datos válidos, **no permiso automático para transitar**.

Validez de la malla: **138,135 celdas; 98.482148 %**. Bajo el supuesto de demo de pendiente máxima ≤15°, quedan 129,058 celdas; su mayor componente conexo de cuatro vecinos tiene **128,649 celdas**. Esto acredita espacio conectado para experimentar; no se ha calculado una ruta. El umbral 15° es un supuesto del equipo, no un límite NASA validado para astronautas.

El trío binario suma **1,262,376 bytes**, aproximadamente 1.20 MiB. Se conserva la arquitectura prevista: preparación Python, consumo futuro en Next.js/TypeScript y cálculo A* en worker.

## Comandos, pruebas y reproducción

Comandos principales efectivamente ejecutados desde la raíz, usando el intérprete local:

```powershell
# El entorno se creó con el Python existente; instalación solo en .venv.
& '<local-runtime>' -m venv .venv
& .\.venv\Scripts\python.exe -m pip install --only-binary=:all: -r requirements-geospatial.txt
& .\.venv\Scripts\python.exe -m pip check
node scripts/data/download_hirise.mjs
& .\.venv\Scripts\python.exe -m scripts.data.inspect_hirise
& .\.venv\Scripts\python.exe -m scripts.data.prepare_hirise
& .\.venv\Scripts\python.exe -m pytest -q --junitxml=docs/validation/pytest.xml
& .\.venv\Scripts\python.exe -m scripts.data.verify_reproducibility
```

Matplotlib se añadió después mediante `pip install --only-binary=:all: matplotlib==3.11.2`; ya está incorporado a ambos archivos de requisitos. Las primeras comprobaciones de compatibilidad usaron `pip install --dry-run --only-binary=:all:`. La instalación fijada completa se conserva en [requirements-geospatial.lock.txt](../requirements-geospatial.lock.txt).

Para repetir la secuencia se proporciona [scripts/run-geospatial.ps1](../scripts/run-geospatial.ps1): `powershell -NoProfile -File scripts/run-geospatial.ps1`, o `-SkipInstall` si el entorno ya está preparado. Reutiliza y comprueba los originales existentes; solo descarga si faltan. El script envolvente agrupa los comandos anteriores; la ejecución científica registrada procede de los módulos listados. GDAL usa caché de 128 MiB y warp de 64 MiB; los originales se leen por ventanas. El JP2 puede decodificar internamente bloques de 1024 × 1024 aunque se solicite una ventana menor. Estadísticas y figuras cargan únicamente el recorte o versiones reducidas, no los originales completos.

**Resultado final ejecutado: 16 pruebas aprobadas, 0 fallos, 0 omitidas, en 1.86 s.** Incluyen plano analítico a tres resoluciones, superficie plana, NoData, centros y ejes, propagación de huecos, dimensiones/CRS reales, valores válidos, cinco mapeos de píxel, discrepancia JP2/LBL, costuras de bloques, componente conectado, agregación conservadora a 10 m, tamaños binarios y hashes de salida. Salida pytest (local-only evidence omitted from source release), JUnit XML (local-only evidence omitted from source release), [tests](../tests/).

**Repetición ejecutada:** 19 archivos regenerados con los mismos SHA-256, misma configuración y mismas entradas. [reproducibility.json](validation/reproducibility.json). La comprobación se refiere a este entorno fijado en Windows; no promete identidad binaria entre diferentes versiones de GDAL o plataformas.

## Decisión para la fase siguiente

Se puede desarrollar A* sobre los tres arrays de 10 m y su manifest. Hay datos reales, máscaras, pendientes métricas, una región conectada y pruebas que comprueban las transformaciones y la preparación. El algoritmo aún deberá verificar extremos, aristas, pendientes de segmento y diagonales; su propia suite sigue pendiente.

La geología SIM 3464, sus desfases de 100–200 m y los POI científicos no se han integrado en esta fase. No se declara completa toda la fase científica del MVP ni se certifican rutas de EVA, precisión subpíxel o ausencia de artefactos estéreo. La fuente principal ha funcionado; **no fue necesario recurrir a CTX**.
