# Validación de la interfaz — Mars Pathfinder / The Meowrtian

**Fase posterior de ciencia:** geología, objetivos y fotografías ya están integrados y sus nuevas pruebas pasan; véase [NASA_RESOURCES.md](NASA_RESOURCES.md). Este informe conserva las cifras y el alcance de la primera fase de interfaz; los informes máquina se actualizan al repetir las suites.

**Resultado:** la aplicación Next.js/OpenLayers calcula y dibuja ambas rutas sobre la cuadrícula real de Jezero mediante los workers existentes. Se probaron clics, capas, métricas, perfil, cancelación, exportación y build estático. No se ha desplegado. Geología y POI siguen pendientes.

Ejecución: **14 de noviembre de 2026**, Windows 11, Node **24.21.0**, npm **11.19.0**, Chrome **157.0.8103.51**, Playwright Core **1.65.1**. Informes máquina en UTC. Dependencias locales fijadas: Next.js **16.4.6**, React **19.3.1**, OpenLayers **10.11.0**, TypeScript **7.0.2**, Vitest **5.1.0**. No se modificaron instalaciones globales.

## Arquitectura y comportamiento comprobado

| Archivo | Responsabilidad |
| --- | --- |
| [next.config.mjs](../next.config.mjs) | App Router, exportación estática; alias `.js` → `.ts` para reutilizar el motor sin reescribirlo |
| [MissionConsole.tsx](../components/mission/MissionConsole.tsx) | Carga verificada, selección, parámetros, dos clientes, comparación y JSON |
| [MissionMap.tsx](../components/mission/MissionMap.tsx) | OpenLayers en cliente, proyección local, imágenes georreferenciadas, rutas y marcadores |
| [ElevationProfile.tsx](../components/mission/ElevationProfile.tsx) | Distancia horizontal acumulada y alturas reales de los centros de celda |
| [model.ts](../lib/map/model.ts) | Clic → celda, coordenadas marcianas, contrato visual, geometría y ficha de ruta |
| [worker-client.ts](../lib/routing/worker-client.ts) | Cliente existente, terminación real y recreación del worker |
| [prepare_visuals.py](../scripts/web/prepare_visuals.py) | Visualizaciones ligeras desde los recortes existentes; no regenera el paquete científico |
| [sync-assets.mjs](../scripts/web/sync-assets.mjs) | Verifica hashes y sincroniza manifiesto, binarios y worker para el build |
| [serve-static.mjs](../scripts/web/serve-static.mjs) | Sirve `out/` sobre HTTP local para demo y pruebas |
| [netlify.toml](../netlify.toml) | Comando de build, Node 24 y directorio `out`; configuración sin despliegue |

El motor A*, sus fórmulas y las restricciones no cambiaron. Ruta A usa λ=0; B usa λ configurable, inicialmente 4. Ambas comparten límite de pendientes, máscara, comprobación de segmentos y esquinas. El límite de 15° es un supuesto del equipo. La función de coste sigue siendo `d × (1 + λ × (θ/15°)²)` con θ efectivo definido por el motor.

Se utilizan **dos** `RoutingWorkerClient`, uno por recorrido. Al cambiar extremos/parámetros, reiniciar o cancelar se terminan ambos workers y se invalidan sus resultados. Además del identificador vigente del cliente, un contador de generación protege el par de consultas. Los resultados anteriores se limpian inmediatamente. El cálculo no se ejecuta en el hilo principal.

La interfaz comunica carga, error, extremos inválidos, cálculo, cancelación y ausencia de ruta. No sustituye extremos inválidos por otra celda. El ajuste al centro de la celda seleccionada es explícito y muestra su distancia. El ejemplo contiene solo los extremos del ensayo anterior; las métricas se obtienen nuevamente del motor.

## Datos y georreferenciación

Se conserva **jezero-hirise-v1**, SHA-256 del manifiesto original:

```text
31717c6421490dfea50ea17d8a4131d9b13408d8761e03d649e2588774009c85
```

```text
+proj=eqc +lat_ts=18.45 +lat_0=0 +lon_0=77.435 +R=3396190 +units=m +no_defs +type=crs
```

| Capa/contrato | Dimensiones | Resolución | Extensión local x mín, y mín, x máx, y máx (m) |
| --- | --- | --- | --- |
| Recortes científicos existentes | 1968 × 1780 | 2 m | [-1968, 1091838, 1968, 1095398] |
| Cuatro imágenes web WebP | 984 × 890 | 4 m | [-1968, 1091838, 1968, 1095398] |
| Malla y máscara de rutas | 394 × 356 | 10 m | [-1968, 1091838, 1972, 1095398] |

La franja final de 4 m en x de la rejilla se conserva: su columna parcial está bloqueada, **no se estira** la imagen para ocuparla. Transformación de rutas `[-1968,10,0,1095398,0,-10]`; fila 0 al norte; Float32 little-endian y máscara Uint8 0/1; NoData -9999. El loader existente verifica el contrato, tamaños y SHA-256 de los tres binarios antes de crear los workers. Hay **138135/140264** celdas válidas, antes de aplicar el límite de pendientes.

Cada `ImageStatic` utiliza su `imageExtent` y el mismo objeto `Projection` local que la vista. Rutas y marcadores reciben directamente x/y en metros, sin transformaciones terrestres. Se desactiva la rotación. `getPointResolution` devuelve la resolución métrica local para la escala. Las coordenadas mostradas se calculan invirtiendo la proyección esférica marciana declarada, con radio 3396190 m.

Los activos están en [public/data/jezero-hirise-v1](../public/data/jezero-hirise-v1/visuals.json). El catálogo conserva extensión, dimensiones, método, procedencia, resolución, hashes de imagen y fuente. Se añaden worldfiles a las cuatro imágenes:

- Ortoimagen RED_C monocroma: promedio 2×2 del recorte; WebP lossless.
- Sombreado: promedio del derivado existente, iluminación sintética 315°/45°.
- Elevación: promedio 2×2 y rampa de color; alturas respecto de la equipotencial marciana, sin conversión vertical.
- Pendiente: máximo 2×2, rampa saturada a 30°. No se usa esa imagen para calcular rutas.
- Máscara violeta: exclusiones de la malla original de 10 m, sin interpolación. **No incluye** todas las exclusiones debidas al umbral de pendiente.

El alfa visible requiere que todos los píxeles originales del bloque 2×2 sean válidos. Los cinco WebP suman **2297222 bytes**. El navegador carga imágenes pequeñas y arrays de rutas; no descarga IMG, JP2 ni GeoTIFF completos. No hay solicitudes externas durante la demo: también se sirve Manrope localmente. Las fuentes científicas permanecen [documentadas](FUENTES.md).

## Comandos ejecutados y resultados

```powershell
# Solo derivar activos de presentación desde los GeoTIFF que ya existen:
& .\.venv\Scripts\python.exe scripts/web/prepare_visuals.py

npm run build
npm run typecheck
npm run test:report
npm run test:interface:report
& .\.venv\Scripts\python.exe -m pytest tests/test_geospatial.py tests/test_hirise_products.py -q --junitxml=docs/interface-validation/pytest.xml
node scripts/routing/check-evidence.mjs
node scripts/web/check-evidence.mjs
```

| Comprobación final | Resultado | Evidencia |
| --- | --- | --- |
| TypeScript | Código de salida 0 | typecheck.log (local-only evidence omitted from source release) |
| Motor/worker Vitest original | **37/37**, 4 archivos aprobados | log (local-only evidence omitted from source release), [JSON](routing-validation/vitest.json) |
| Interfaz Vitest | **17/17**: 9 contrato/helpers y 8 navegador | log (local-only evidence omitted from source release), [JSON](interface-validation/vitest.json), JUnit (local-only evidence omitted from source release) |
| Regresiones Python | **16/16**, 18.55 s | log (local-only evidence omitted from source release), JUnit (local-only evidence omitted from source release) |
| Next.js | Build correcto y exportación estática `out/` | build.log (local-only evidence omitted from source release) |
| Datos científicos | **3 originales + 19 salidas** iguales en tamaño y SHA-256 | [final-checks.json](routing-validation/final-checks.json) |
| Chrome / HTTP local | Sin excepciones JS, errores de consola, activos HTTP ausentes ni solicitudes externas en los 8 casos | [browser.json](interface-validation/browser.json) |
| Integridad del build y enlaces | Copias estáticas, hashes visuales, bundle de worker e informes cotejados | [final-checks.json](interface-validation/final-checks.json) |

La exportación generada tenía **59 archivos / 5046669 bytes**. Se sirvió por HTTP con el mismo servidor usado por `npm start`, no con el servidor de desarrollo de Next. El build no requiere Python ni los originales NASA: utiliza los binarios pequeños y WebP ya preparados.

Los casos de navegador verifican: carga de las cuatro capas y sus renderizados distintos; procedencia; clics sobre coordenadas reales; ambas rutas y métricas frente al motor; JSON descargados y auditados; perfil; visibilidad; zoom/pan; extremos y λ nuevos; rechazo de NoData, pendientes y exterior; cancelación y recreación; móvil 390×844 sin desbordamiento; destino real desconectado y rechazo de una respuesta HTTP truncada.

El último caso usa **una respuesta HTTP deliberadamente corrupta como fixture de prueba**. No escribe datos científicos ni se presenta como observación marciana. No se ha omitido ningún test por falta de navegador.

## Evidencias de alineación y fluidez

No se concluye alineación únicamente por metadatos. En Chrome se hicieron clics en las coordenadas proyectadas de los extremos y se comprobó que retornaban exactamente las celdas esperadas; se descargaron sus rutas y se auditó cada celda y arista. La geometría tiene todos los centros originales, sin suavizado.

Se midió el centro DOM del marcador frente al píxel obtenido de la transformación métrica de la vista. El error máximo observado en inicio, zoom, arrastre y cuatro cambios de capa fue **0.0000351 píxeles CSS** (tolerancia de prueba 1.1 px). Esto mide consistencia numérica del renderizado, **no exactitud científica/geodésica**. Las imágenes se cargaron realmente y produjeron cuatro contenidos de canvas distintos. La comparación visual de rasgos, bordes de NoData y relieve se conserva en las capturas. La validación del registro científico original está en [VALIDACION_GEOESPACIAL.md](VALIDACION_GEOESPACIAL.md).

Durante el cálculo real se observaron **14 frames de animación** con estado `working`, máximo intervalo entre esos frames **7.2 ms** en esta ejecución headless. Es evidencia de actividad del hilo principal mientras los workers calculaban, no una garantía de FPS en otros equipos.

Se observaron dos eventos de creación y dos de cierre de workers al cancelar, estado `cancelled`, métricas vacías y nuevos workers calculando con λ=0 después. La prueba pulsa el control por evento DOM inmediato porque el autowait de estabilidad de Playwright puede tardar más que la ruta. Esta prueba de interfaz puede cancelar durante inicialización o búsqueda; la suite original añade la comprobación de terminación con búsqueda ya iniciada y sin resultado previo. Ambas evidencias se conservan, sin atribuir a esta prueba un punto de interrupción que no mide.

## Resultados reales obtenidos desde la web

Extremos escogidos por el equipo para la demo, **no POI científicos**:

- Origen: columna **59**, fila **302**, x **-1373 m**, y **1092373 m**.
- Destino: columna **334**, fila **53**, x **1377 m**, y **1094863 m**.
- Límite **15°**, θ de referencia **15°**, A λ=0 y B λ=4, motor **1.0.0**.

| Métrica medida | Ruta A | Ruta B |
| --- | ---: | ---: |
| Distancia horizontal | 3781.391770 m | 4003.990617 m |
| Distancia sobre el terreno | 3785.908439 m | 4005.098075 m |
| Ascenso | 56.729980 m | 28.269775 m |
| Descenso | 67.427734 m | 38.967529 m |
| Desnivel neto | -10.697754 m | -10.697754 m |
| Pendiente efectiva máxima | 14.388532° | 8.874289° |
| Coste | 3781.391770 | 4932.615240 |
| Tiempo de búsqueda en worker | 22.9 ms | 52.3 ms |
| Celdas de ruta / aristas auditadas | 276 / 275 | 314 / 313 |

Tiempos de esta consulta, excluyen carga y arranque del worker; varían al repetir y no representan una distribución de rendimiento. Ambos están por debajo del objetivo de 2 s para esta consulta en este equipo. Los valores exactos, exposición por pendientes, celdas exploradas, parámetros, datum, coordenadas y hashes están en los JSON **descargados por Chrome**, [A](interface-validation/download-route-a.json) y [B](interface-validation/download-route-b.json). La auditoría independiente de sus aristas detectó **0 infracciones** y **0 diferencias** en las métricas recalculadas.

Al cambiar el destino a celda **219,158**, A pasó a **2196.467530 m**. Con λ=8, B produjo coste **3615.434806**. Se verificó que la UI eliminaba las cifras anteriores antes de recalcular y que las nuevas coincidían con el motor.

El caso sin ruta usa destino válido **148,82**, elevación **-2526.85009765625 m**, pendiente **14.968354225158691°**, máscara 1. Está aislado bajo el umbral 15°. Se obtuvo `no-route` con el motor y con ambos workers de la UI. El mapa limpió los trazados anteriores y mostró el mensaje explícito.

## Capturas e inspección visual

Capturas reales de Chrome: [escritorio con ambas rutas](interface-validation/desktop.png), [móvil](interface-validation/mobile.png), [ortoimagen](interface-validation/layer-ortho.png), [relieve](interface-validation/layer-hillshade.png), [elevación](interface-validation/layer-elevation.png), [pendiente](interface-validation/layer-slope.png), [fuentes](interface-validation/sources.png) y [sin ruta](interface-validation/no-route.png).

Se inspeccionaron escritorio, móvil y pendiente: imagen orbital real centrada, extremos en los trazados, rutas distinguibles, métricas y perfil visibles; sin desbordamiento horizontal móvil. La revisión se realizó sobre capturas de navegador. Se intentó además abrir una vista previa integrada en el chat, pero su host de navegador estaba indisponible; no se afirma haber abierto esa vista. Chrome mediante Playwright sí ejecutó toda la demo local.

## Problemas encontrados y pendientes

- Rasterio no admite `Resampling.max` en la lectura reducida utilizada inicialmente. Se corrigió únicamente el exportador visual para calcular el máximo explícito de bloques 2×2. No se modificó la pendiente científica original.
- La primera ejecución de la suite original aprobó los 37 casos pero falló el hook de cierre por conexiones HTTP de Chrome. Se corrigió el cierre del servidor **de pruebas** con `closeAllConnections`; la suite final completa pasa. No se cambió el motor.
- La primera prueba de cancelación de UI llegaba tarde por el autowait de Playwright; se sincronizó con la creación de ambos workers y se disparó el control de cancelación inmediatamente. Se corrigió también el selector de mensajes para excluir el anunciador vacío de Next.
- Se sustituyó la fuente tipográfica externa por un paquete local y se aumentó el tamaño de métricas/leyendas tras la inspección visual.
- No quedan fallos conocidos en los casos ejecutados. No se han verificado Safari/Firefox, dispositivos físicos móviles, lectores de pantalla ni hosting Netlify real. La aplicación necesita HTTP local o HTTPS para workers y `crypto.subtle`.
- La web no añade obstáculos subcelda, arena, radiación, meteorología o capacidad EVA. El relieve sombreado y las rampas de color son derivados de presentación. Ni optimalidad ni alineación de pantalla certifican seguridad física.

Para incorporar geología: preparar su recorte y CRS con las fuentes oficiales documentadas, validar geometrías y desfases/incertidumbre, añadir contrato versionado y una capa vectorial OpenLayers con ficha de procedencia. Para POI: referencias verificables, coordenadas y justificación científica antes de crear las fichas o enlazarlos al selector de extremos. No deben introducirse automáticamente en el coste de A* ni tratarse como validadores de seguridad.

## Arranque y demo reproducible

```powershell
npm ci
npm run build
npm start
# Abrir http://127.0.0.1:3000
```

Para desarrollo: `npm run dev`. Puerto alternativo para la exportación: `npm start -- --port 3001`.

Guion de dos minutos: abrir **Procedencia y resolución**; mostrar ortoimagen y pendiente; **Usar ejemplo validado → Calcular rutas**; comparar distancia y ascenso; seleccionar perfil A/B; cambiar λ y recalcular; elegir otro destino en el mapa; exportar JSON. Las capas y rutas actuales están listas para esta demo topográfica. El MVP científico completo del plan conserva pendientes de geología, POI y posterior despliegue autorizado.
