# Auditoría final — Mars Pathfinder / The Meowrtian

**Resultado: preparado técnicamente para desplegar una demo educativa estática, después de las correcciones y comprobaciones descritas aquí. No se ha desplegado.** La comprobación de la URL HTTPS real del proveedor queda pendiente de ese despliegue. El proyecto aún no declara licencia abierta para su código propio; debe decidirse antes de distribuirlo como código abierto. Ninguna conclusión de esta auditoría certifica seguridad para astronautas.

Auditoría realizada el **14 de noviembre de 2026**, Windows, Node 24.21.0, Chrome **157.0.8103.51** y Playwright Core 1.65.1. Los archivos de evidencia conservan timestamps UTC. Se mantuvieron HiRISE, SIM 3464, sus contratos y el motor A*. No se añadieron fuentes científicas ni 3D.

## 1. Puerta antivirus

Antes de abrir el navegador o ejecutar dependencias se consultaron de solo lectura `Get-MpComputerStatus`, `Get-MpThreat`, `Get-MpThreatDetection`, el proveedor registrado y los eventos Defender 1116/1117/1118/1119/1121 de los últimos 30 días. La comprobación se repitió tras la pausa y antes de las regresiones finales.

Resultado comunicado por Windows Defender: protección antivirus y en tiempo real activas, **0 amenazas, 0 detecciones y 0 eventos relacionados con el proyecto/dependencias** en el historial revisado. La última revisión inspeccionó 98 eventos; el número cambia al avanzar la ventana temporal. Estado registrado (local-only evidence omitted from source release). Esto es una consulta de estado/historial, no un análisis completo del equipo.

El primer nuevo build encontró un problema real: faltaba `node_modules/@typescript/typescript-win32-x64/lib/tsc.exe`. **La causa de esa ausencia no está establecida; no se atribuye al antivirus.** Se volvió a revisar Defender, incluidos `typescript`/`tsc.exe` y rutas temporales, sin encontrar alertas relacionadas. Se descargó la misma versión **7.0.2** del registro oficial, se cotejó su SHA-512 con el lock y los metadatos del registro, se extrajo el ejecutable sin lanzarlo y se solicitó su análisis personalizado con Defender. Los eventos **1000 y 1001**, con el mismo ID de examen, acreditan inicio y finalización; no se comunicaron detecciones. Solo entonces se repuso el archivo faltante, sin cambiar versiones ni desactivar protecciones.

Evidencias: integridad del paquete (local-only evidence omitted from source release), análisis del archivo (local-only evidence omitted from source release), eventos del análisis (local-only evidence omitted from source release). SHA-256 del ejecutable repuesto: `f9ecfbdc93753d2c972d66a8d0d75f5bd737fd4a5f88b422d9091ea282bcb2c7`. El campo `executed:false` del informe de análisis describe ese paso previo a su uso; después se ejecutaron typecheck y build.

No apareció una alerta pendiente que exigiera detener el trabajo. **Si aparece una posteriormente, deben detenerse las ejecuciones y revisarla, sin restaurar cuarentenas ni crear exclusiones automáticamente.** El guard reproducible está en check-antivirus.ps1 (local-only evidence omitted from source release).

## 2. Problemas encontrados y correcciones

| Problema observado realmente | Corrección | Comprobación posterior |
| --- | --- | --- |
| En escritorio, seleccionar un objetivo desde la parte baja del lateral abría la ficha fuera de la vista: se midieron posiciones verticales negativas de -526 y -706 px | La selección científica devuelve el mapa a la vista también en escritorio cuando quedó fuera de pantalla. Cerrar una ficha conserva la posición | Los tres objetivos se abrieron y sus fichas quedaron dentro del viewport en los cinco escenarios |
| En móvil se apilaban ficha, leyenda geológica y leyenda de imagen; los botones requerían desplazarse dentro de la ficha | Ficha opaca, cabecera/cierre y acciones fijas, cuerpo desplazable. Las leyendas detrás de la ficha se ocultan temporalmente en móvil; la leyenda geológica empieza plegada | Acciones y cierre visibles sin desplazamiento interior; referencias accesibles en el cuerpo. Capturas antes/después |
| Nombres de unidades a 8 px, citas a 9 px y ejes del perfil demasiado pequeños en móvil | Aumentados textos científicos, leyendas, citas, coordenadas y ejes. Ajustado espaciado del título móvil | Inspección de capturas a 1440×900, 1280×720, 390×844 y 360×740; sin desbordamiento horizontal |
| Al elegir primero M3 como destino y después hacer clic para el origen, se seguía solicitando otro destino pese a estar definido | El modo de selección termina cuando ambos extremos ya existen | El flujo comprueba que conserva exactamente la celda M3 y desaparece la instrucción de destino redundante |
| Las limitaciones EVA dependían de una nota muy pequeña | Nota legible de 11 px junto a los resultados, con peligros concretos no modelados y ausencia de certificación | Verificada en DOM y capturas, también en móvil |
| Faltaba el ejecutable local de TypeScript | Recuperación del paquete fijado, con integridad y análisis previo descritos arriba | Typecheck y build finales correctos |

El guion de auditoría inicial usaba una espera fija después de un desplazamiento suave; en móvil produjo un fallo de clic. Se sustituyó por una espera de estabilidad de la posición real del mapa. Fue un problema de sincronización de la prueba, no una corrección de coordenadas científicas. Se conserva el [diagnóstico inicial](final-audit/diagnostic-initial-script-error.txt).

Hubo además una pausa del servicio de revisión automática de permisos por límite de uso. Las tres suites pendientes **no se ejecutaron durante ese rechazo**. Después de reanudarse el servicio y repetir la comprobación antivirus, se ejecutaron realmente y pasaron. No se contabilizaron intentos rechazados como pruebas realizadas.

## 3. Navegador real y flujo completo

Se sirvió el **build de `out/`** con el servidor HTTP estático del proyecto, no con un mock ni con el servidor de desarrollo. Cada escenario abrió un contexto nuevo de Chrome, sin cookies/almacenamiento previos y con caché desactivada. Se bloquearon las solicitudes fuera del servidor local: la demo siguió funcionando.

En cada uno de los cinco escenarios se ejecutó mediante controles reales:

1. Abrir Jezero y esperar mapa, binarios verificados y ciencia.
2. Alternar Relieve, Elevación, Pendiente y Ortoimagen.
3. Consultar M1, M2 y M3, leer procedencia e incertidumbre y asignar M3 como destino.
4. Seleccionar el origen mediante clic en el mapa; comprobar la conversión exacta a su celda.
5. Calcular A y B en los workers, comparar métricas y consultar ambos perfiles.
6. Descargar ambos JSON, cotejar celdas/métricas con el motor y auditar las aristas independientemente.
7. Activar/desactivar geología, consultar Nle y abrir las dos fotografías documentadas.
8. Abrir créditos y fuentes, verificar sus referencias y el texto completo de licencias local.

**5/5 flujos completos aprobados**, con 10 JSON descargados/auditados. No se observaron excepciones JavaScript, errores de consola, respuestas HTTP fallidas de activos ni solicitudes externas necesarias. Los textos de cita conservan enlaces externos opcionales; no se visitaron sitios NASA/USGS para hacer funcionar la demo.

Guion reproducible: [browser-audit.ts](../scripts/audit/browser-audit.ts). Evidencia íntegra: [browser-audit.json](final-audit/browser-audit.json) y log (local-only evidence omitted from source release). Las pruebas verifican fichas y acciones **dentro del viewport visible**, además de su mera existencia en el DOM.

El [resumen final comprobado](final-audit/final-checks.json) coteja estas evidencias con los hashes de los 66 archivos exportados y los resultados de las suites.

## 4. Tiempos y tamaño medidos

| Pantalla / condición | Mapa y ciencia operativos | Ambas rutas en la UI |
| --- | ---: | ---: |
| 1440×900, HTTP local | 737.2 ms | 91.6 ms |
| 1280×720, HTTP local | 350.6 ms | 94.4 ms |
| 390×844, HTTP local | 331.6 ms | 121.1 ms |
| 360×740, HTTP local | 322.0 ms | 92.2 ms |
| 1440×900, red **emulada** de 10 Mbps y 50 ms | 3009.2 ms | 169.5 ms |

Son observaciones de una ejecución por condición sobre este equipo, no percentiles ni garantías para otros dispositivos. El navegador estaba limpio; el servidor y la caché del sistema operativo podían estar calientes. La condición de red es una emulación explícita, no una medición del futuro hosting. El tiempo de ambas rutas incluye la interacción observada y el arranque/comunicación de workers; los JSON conservan también el tiempo interno de cada búsqueda.

- Exportación estática: **66 archivos, 6115416 bytes** (6.12 MB decimales).
- Cuerpos de recursos de la carga inicial: **2896316 bytes**, aproximadamente 2.90 MB.
- Recursos del navegador durante el recorrido completo, con cuatro bases y dos fotos: **4805377 bytes**, aproximadamente 4.81 MB. La consulta separada del texto completo de licencias añade unos 0.77 MB y no forma parte de esa suma del documento principal.
- Se solicitaron por HTTP los **66 archivos de `out/`**: todos devolvieron 200 y los bytes coincidieron con los archivos del disco.
- No se cargaron los originales IMG/JP2/GeoTIFF ni la base FileGDB durante la demo. No se necesita Python, una API de rutas ni un servicio cartográfico externo en ejecución.

El informe guarda tamaños por archivo, hashes y tiempos por recurso. Para duración completa de recursos se utiliza `resourceTiming[].durationMs`. El campo `resources[].durationMs` fue muestreado en el evento de respuesta y puede representar el inicio de respuesta cuando aún no constaba su final; no se usa como tiempo completo de transferencia en esta tabla. La suma gzip calculada en el inventario es **hipotética**: el servidor local no estaba sirviendo esa compresión y no se presenta como tráfico medido.

## 5. Revisión científica

- **Archivos y CRS:** las capas usan los paquetes preparados `jezero-hirise-v1` y `jezero-science-v1`, coordenadas locales en metros de Marte y el manifiesto original. No se asignó WGS84 terrestre ni se desplazaron capas por estética. Pruebas científicas cotejan la geología con el polígono fuente y con GDAL; las de navegador consultan geometrías en posiciones locales comprobadas. Las diferencias de registro de la geología siguen siendo una limitación real.
- **A/B:** A minimiza distancia horizontal con λ=0; B minimiza coste con penalización por pendiente, λ=4 en esta demo. Se mantienen ocho vecinos, NoData bloqueado, límites de pendiente, comprobación de segmentos y esquinas. B no se etiqueta como ruta físicamente segura.
- **Geología:** nombres, símbolos y FID originales de USGS SIM 3464. Escala 1:75.000 y desfase documentado aproximado de **100–200 m respecto al CTX de operaciones** visibles en fichas, mapa y exportación. No se presenta como un residual medido contra HiRISE ni como un límite estadístico garantizado; no modifica A*.
- **Objetivos:** M1–M3 se presentan como propuestas de The Meowrtian en celdas válidas y unidades trazables. No son estaciones oficiales. Las fichas ahora exponen directamente ambas referencias del objetivo.
- **Perseverance:** las dos imágenes conservan ID, crédito, fecha y coincidencia exacta de RMC/sol con un waypoint oficial. La marca representa el rover, no las coordenadas de los blancos de la foto. La exactitud absoluta no proporcionada por el servicio no se inventa.
- **Seguridad EVA:** nota visible: no se modelan estabilidad del suelo, arena, rocas pequeñas, radiación ni autonomía EVA. No se deducen probabilidades de accidente ni tiempos operativos de marcha.
- **Procedencia:** imagen orbital, DEM estéreo e interpretación publicada se distinguen de colores, pendientes, sombreado, objetivos y rutas derivados por el equipo. Mars Trek permanece identificado como consultado, sin incorporar sus rásteres.

Se verificaron de nuevo los hashes de **3 originales HiRISE y 19 salidas topográficas**, así como los **4 inputs USGS, 136 archivos extraídos y 5 activos científicos** del paquete web. Permanecen intactos. Véanse [integridad original](routing-validation/final-checks.json), [ciencia](science-validation/final-checks.json) y [fuentes/limitaciones completas](NASA_RESOURCES.md).

El flujo auditado seleccionó origen **columna 59, fila 302** y destino M3 **334,233**, con límite 15°:

| Métrica real | A · distancia | B · pendiente |
| --- | ---: | ---: |
| Distancia horizontal | 3035.807358 m | 3118.650071 m |
| Distancia sobre terreno | 3038.973576 m | 3120.958565 m |
| Ascenso | 36.391357 m | 31.878418 m |
| Descenso | 64.307373 m | 59.794434 m |
| Pendiente efectiva máxima | 14.535635° | 9.018862° |
| Coste del algoritmo | 3035.807358 | 4487.520853 |

Los valores coincidieron exactamente con los del motor puro y no hubo infracciones en las auditorías independientes de aristas. Ejemplos descargados: [A](final-audit/1440-loopback-route-a.json), [B](final-audit/1440-loopback-route-b.json). Esto no es una nueva comprobación Dijkstra de ese par; la suite original conserva sus contrastes A*/Dijkstra y las validaciones previas del grafo.

## 6. Pruebas realmente ejecutadas

| Comprobación final | Resultado | Evidencia |
| --- | --- | --- |
| TypeScript, incluidos scripts de auditoría | Correcto, salida 0 | typecheck (local-only evidence omitted from source release) |
| Motor, métricas y workers | **37/37 Vitest** | log (local-only evidence omitted from source release), [JSON](routing-validation/vitest.json) |
| Interfaz y ciencia, incluidas 12 pruebas Chrome | **27/27 Vitest** | log (local-only evidence omitted from source release), [JSON](interface-validation/vitest.json) |
| Datos, geometrías, objetivos y fotografías | **22/22 pytest** | log (local-only evidence omitted from source release), JUnit (local-only evidence omitted from source release) |
| Next.js exportación estática | Correcto | build (local-only evidence omitted from source release) |
| Guion completo en navegador limpio | **5/5 escenarios**, 10 rutas exportadas | [informe de navegador](final-audit/browser-audit.json) |
| Todos los activos exportados | **66/66 HTTP 200 y hashes correctos** | Inventario incluido en el informe de navegador |

Se inspeccionaron visualmente las capturas finales de escritorio, móvil, objetivo y fotografía. Los cuerpos de ficha son desplazables; los controles de cierre/uso como extremo permanecen fijos. Las comprobaciones de viewport y ausencia de desbordamiento pasaron. La emulación móvil no sustituye un dispositivo físico ni constituye una auditoría completa de accesibilidad.

## 7. Capturas reales

| Vista | Captura |
| --- | --- |
| Escritorio 1440×900, terreno, ambas rutas y resultados | [Escritorio](final-audit/1440-loopback-routes.png) |
| Portátil 1280×720 | [Portátil](final-audit/1280-loopback-routes.png) |
| Móvil 390×844, mapa y comparación | [Móvil](final-audit/390-loopback-routes.png) |
| Móvil 360×740 | [Móvil estrecho](final-audit/360-loopback-routes.png) |
| Ficha de objetivo con acciones fijas | [Objetivo](final-audit/390-loopback-objective.png) |
| Geología publicada y advertencia | [Geología](final-audit/1440-loopback-geology.png) |
| Foto auténtica y distinción rover/blancos | [Perseverance](final-audit/360-loopback-perseverance.png) |
| Créditos y fuentes en móvil | [Créditos](final-audit/390-loopback-credits.png) |
| Antes de las correcciones de móvil | [Referencia inicial](final-audit/baseline-card-390.png) |

Las capturas se generaron con Chrome sobre la aplicación real; no son composiciones ni maquetas.

## 8. Pendientes y riesgos de presentación

No quedan fallos funcionales conocidos en los casos ejecutados. Permanecen pendientes concretos:

1. **Proveedor real:** después de desplegar, comprobar HTTPS, rutas de activos y workers, MIME, caché y descarga JSON desde la URL pública en una sesión limpia. El build estático local pasa; no se afirma haber probado un hosting que aún no existe.
2. **Licencia del código propio:** créditos y licencias de terceros están conservados; el equipo debe elegir la licencia de distribución de su código. No se ha asignado una automáticamente.
3. **Cobertura de dispositivos:** no se ensayaron Safari/Firefox ni móviles físicos. Lo validado es Chrome con cuatro tamaños y una condición de red emulada.
4. **Entorno del portátil:** la causa original del ejecutable TypeScript ausente no está demostrada. Conservar el lock y un build local comprobado; si vuelve a faltar o aparece una alerta, revisar antes de repetir instalaciones.
5. **Alcance científico:** persisten incertidumbre de registro geológico, escala orbital, límites de la malla y exactitud absoluta no publicada de los waypoints. No constituyen fallos ocultos ni permiten presentar la app como herramienta operativa EVA.

Para la presentación: disponer de `out/` y Node en el equipo, arrancar por HTTP local, usar la selección documentada y conservar las capturas/JSON como evidencia. No abrir `out/index.html` mediante `file://`: los workers, fetch y comprobaciones criptográficas requieren HTTP local o HTTPS. Los enlaces externos de referencia pueden no estar disponibles sin Internet; la demo local funciona sin ellos.

## 9. Repetición y decisión de despliegue

```powershell
powershell -NoProfile -File scripts/audit/check-antivirus.ps1
# Si informa revisión pendiente, detener aquí y revisar el antivirus.
npm run typecheck
npm run build
npm run test:report
npm run test:interface:report
& .\.venv\Scripts\python.exe -m pytest tests/test_geospatial.py tests/test_hirise_products.py tests/test_science.py -q
node node_modules/tsx/dist/cli.mjs scripts/audit/browser-audit.ts
node scripts/routing/check-evidence.mjs
node scripts/web/check-evidence.mjs
node scripts/web/check-science-evidence.mjs
node scripts/audit/check-final.mjs
```

El guion de navegador requiere una comprobación antivirus reciente y Chrome instalado; `MARS_TEST_BROWSER` permite indicar otro ejecutable Chromium. Arranque de la demo ya compilada: `npm start`, abrir **http://127.0.0.1:3000**.

**Decisión:** sí para preparar/publicar la **demo educativa estática** con sus límites visibles. No se declara una validación operativa para astronautas ni un despliegue público ya comprobado. Se mantiene la instrucción de no desplegar durante esta fase.
