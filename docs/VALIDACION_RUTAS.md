# Validación del motor A* — Mars Pathfinder / The Meowrtian

**Actualización posterior:** la integración Next.js/OpenLayers ya se ejecutó y comprobó; véase [VALIDACION_INTERFAZ.md](VALIDACION_INTERFAZ.md). Este informe conserva las conclusiones y pendientes que existían al finalizar la fase del motor.

**Resultado: A* calcula ambos recorridos sobre la cuadrícula real de Jezero y sus restricciones han pasado las comprobaciones ejecutadas.** El motor es TypeScript puro, se ha probado en un Web Worker real y las rutas se han contrastado con Dijkstra independiente sobre el grafo real completo. No se ha construido la interfaz, integrado geología/POI ni cambiado los originales o el procesamiento geoespacial.

Fecha de ejecución: **14 de noviembre de 2026**, Europe/Madrid; informes máquina en UTC. Versión del motor: **1.0.0**. Datos: **jezero-hirise-v1**.

## 1. Arquitectura y contrato real

| Archivo | Responsabilidad |
| --- | --- |
| [types.ts](../lib/routing/types.ts) | Contratos de celdas, rejilla, parámetros, resultados y métricas |
| [load-grid.ts](../lib/routing/load-grid.ts) | Adaptación del manifiesto existente, carga binaria, tamaños y SHA-256 |
| [grid.ts](../lib/routing/grid.ts) | Validez, índices, coordenadas locales y centros de celda |
| [heap.ts](../lib/routing/heap.ts) | Binary min-heap indexado con decrease-key; una entrada abierta por celda |
| [engine.ts](../lib/routing/engine.ts) | A*, restricciones de aristas y métricas, sin React/Next ni acceso a disco |
| [worker-protocol.ts](../lib/routing/worker-protocol.ts), [routing.worker.ts](../workers/routing.worker.ts) | Inicialización y cálculo en hilo separado |
| [worker-client.ts](../lib/routing/worker-client.ts) | Identificadores de petición, terminación, recreación y descarte de respuestas obsoletas |
| [jezero-demo.ts](../scripts/routing/jezero-demo.ts) | Demostración reproducible, selección de extremos, exportación y benchmark |
| [independent-audit.ts](../scripts/routing/independent-audit.ts) | Revisión de aristas y métricas sin llamar al código del motor |
| [verify_routes.py](../scripts/routing/verify_routes.py) | Segundo auditor Python, Dijkstra de SciPy y figura comparativa |

El cargador lee el [manifest real, conservado sin modificaciones](../data/processed/jezero-hirise-v1/manifest.json):

- `routing_grid.width=394`, `height=356`, `total_cells=140264`, resolución **10 m**.
- Transformación GDAL **`[-1968,10,0,1095398,0,-10]`**; orden por filas desde el norte.
- Índice `row * width + col`; centro `x=-1968+10*(col+0.5)`, `y=1095398-10*(row+0.5)`.
- `routing_elevation.f32` y `routing_slope_max.f32`: **Float32 little-endian**, 561,056 bytes cada uno. La lectura usa DataView con endianness explícito.
- `routing_valid.u8`: **Uint8**, 140,264 bytes; solo **1** significa datos válidos. **0** queda bloqueado.
- NoData Float32 **−9999**. Incluso con máscara 1, valores no finitos, NoData o pendientes inválidas quedan bloqueados.
- CRS equirectangular local marciano en metros, **R=3396190 m**, paralelo estándar 18.45°, meridiano 77.435° E. Elevaciones según referencia equipotencial del producto PDS, sin cambiar datum vertical.

No se fijan las dimensiones dentro del algoritmo genérico. El adaptador las obtiene del manifiesto y la demo exige que esta versión sea 394 × 356. Se rechazan byte order, distribución de filas, unidades, resolución o máscara incompatibles. Antes de decodificar se verifican tamaños y los tres SHA-256 publicados en el manifiesto; también se guarda el SHA-256 del manifiesto en cada resultado.

El campo histórico `routing_grid.route_computed=false` describe el paquete cuando se preparó. Se ha conservado: las rutas nuevas se guardan aparte en `data/routes/jezero-hirise-v1/` con su versión del motor y referencias de integridad.

## 2. Grafo, restricciones y función de coste

Ocho vecinos, con distancias horizontales entre centros calculadas en la proyección local. Las diagonales miden `10*sqrt(2)` m en esta rejilla, no 10 m.

Se bloquea cualquier celda sin datos válidos o con pendiente conservadora mayor que `maxSlopeDeg`. Para una diagonal, **ambas celdas ortogonales laterales deben ser válidas y cumplir el límite de pendiente**. Se comprueba además la pendiente del segmento diagonal directo. No se extrapola, rellena, suaviza ni corta la ruta entre puntos no vecinos.

Para la arista `i → j`, con ángulos en grados:

```text
d_ij      = hypot((col_j-col_i)*10, (row_j-row_i)*(-10))
dz_ij     = z_j-z_i
thetaEdge = atan2(abs(dz_ij), d_ij) * 180/pi
theta_ij  = max(thetaEdge, pendienteMaximaCelda_i, pendienteMaximaCelda_j)

rechazar arista si theta_ij > maxSlopeDeg
c_ij      = d_ij * (1 + lambda*(theta_ij/thetaRefDeg)^2)
h(i)      = distancia euclídea horizontal entre el centro de i y el destino
```

La pendiente de celda es el **máximo** ya preparado de sus píxeles finos, no un nuevo promedio. La regla diagonal comprueba las celdas laterales; no introduce un recorrido ficticio por sus centros. La pendiente de segmento se verifica entre los dos centros realmente recorridos.

**Ruta A:** `mode='distance'`, lambda **0**. **Ruta B:** `mode='slope-penalty'`, lambda **4** por defecto y configurable. Ambas usan las mismas restricciones. En la demo, `maxSlopeDeg=15` y `thetaRefDeg=15`; son supuestos explícitos del equipo, no parámetros NASA validados para astronautas.

Para lambda ≥0, cada coste es al menos la distancia horizontal. Por desigualdad triangular, la heurística es admisible y consistente en este grafo. El cierre de nodos es definitivo; el heap mantiene un único registro abierto y actualiza prioridades. Empates: menor `f`, después menor `h` y después menor índice, para resultados deterministas. Se rechazan parámetros negativos/no finitos, ángulos fuera de rango y costes que desbordarían el rango numérico.

Estados del motor: `success`, `no-route`, `invalid-start`, `invalid-goal`, `invalid-parameters`, `invalid-grid`. Un punto fuera del mapa, no entero o inválido se rechaza: no se ajusta a una celda distinta silenciosamente. Origen igual a destino solo devuelve longitud cero si la celda es válida.

## 3. Métricas y temporización

- Longitud horizontal: `sum(d_ij)`.
- Longitud aproximada sobre el terreno: `sum(hypot(d_ij,dz_ij))`.
- Ascenso: `sum(max(dz_ij,0))`; descenso: `sum(max(-dz_ij,0))`; desnivel neto: `z_destino-z_origen`.
- Pendiente máxima: máximo de `theta_ij`, incluyendo la pendiente de la celda de origen. En una ruta sin movimiento es la pendiente de esa celda.
- Exposición: longitud horizontal y fracción de longitud en **[0,5), [5,10), [10,15), [15,90)** grados, usando `theta_ij`. Las sumas reproducen la longitud total. En un recorrido de longitud cero las fracciones valen cero.
- Coste total: suma de `c_ij`, en metros ponderados; no representa distancia física, tiempo de marcha o energía. Los costes de A y B pertenecen a funciones distintas.
- `computeTimeMs`: `performance.now()` alrededor de la validación, asignaciones, búsqueda, reconstrucción y métricas. Excluye descarga y transporte del worker; el test de navegador registra también `roundTripMs` por separado.
- `expandedCells`: celdas distintas extraídas y cerradas, incluido el destino; `discoveredCells`: celdas con coste finito; `peakOpenCells`: máximo simultáneo en el heap.

Los resultados conservan parámetros completos, versión del motor y de datos, identidad SHA-256 de las entradas y coordenadas por centro de celda. La forma exportada es JSON marciano propio, no GeoJSON RFC 7946/WGS84.

## 4. Worker: cancelación y resultados obsoletos

El worker recibe `init` con la rejilla y después `route` con `requestId`. Emite `ready`, `started` y `result`, o un error explícito. La búsqueda es síncrona dentro de ese hilo: **no se pretende interrumpirla enviándole un mensaje `cancel` que no podría atender mientras calcula**.

`RoutingWorkerClient.cancel()` llama al [`terminate()` nativo](https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate). Si llega una petición nueva mientras hay otra activa, termina el worker anterior, resuelve su petición como `cancelled/superseded`, crea otro e inicializa sus datos. Tras una cancelación explícita, la recreación se hace al pedir la siguiente ruta. En peticiones consecutivas ya finalizadas se reutiliza el mismo worker.

La rejilla se clona mediante structured clone; no se transfieren ni se dejan detached los arrays de origen. Cada respuesta se contrasta con la instancia del worker y el identificador actual. `isCurrent(requestId)` permite al consumidor descartar también una promesa antigua que ya se hubiera resuelto antes de cambiar la selección. `dispose()` termina el hilo y evita nuevas peticiones.

Esto se ha probado en **Chrome 157.0.8103.51**, no solo con dobles de prueba:

1. El worker de producción calculó A y B sobre los binarios reales, con las mismas métricas que Node y auditoría de aristas aprobada.
2. Se lanzó A* en una rejilla artificial de 2000 × 2000 con una barrera que hace inaccesible el destino. Tras `started`, la consulta seguía sin resultado cuando se pidió cancelación.
3. Playwright observó el evento **`close` del worker terminado**. La consulta antigua nunca completó; el worker nuevo devolvió otra ruta correctamente y los arrays principales siguieron disponibles.
4. Se repitió con sustitución de petición: solo el resultado nuevo quedó vigente.

[Evidencia del navegador y ciclos de vida](routing-validation/browser-worker.json). La primera ejecución tuvo dos fallos al observar `close`; se conserva en vitest-initial.log (local-only evidence omitted from source release). Se ajustó la instrumentación y se dejó una ventana de 50 ms **solo en el fixture** para observar el hilo antes de cancelarlo, comprobando que el cálculo seguía pendiente. La implementación productiva no añade esa espera. La prueba de callbacks obsoletos encolados también pasa.

## 5. Pruebas realmente ejecutadas

**37 pruebas Vitest aprobadas, 0 fallos y 0 omitidas, en 4 archivos; ejecución completa de 7.20 s.**

| Grupo | Comprobaciones |
| --- | --- |
| Motor y heap: 28 | Llano, diagonal métrica, obstáculos, esquinas de uno/dos lados, pendientes de celda y segmento, NoData/NaN/Infinity, mismo origen/destino, fuera de mapa, parámetros inválidos, centros/ejes y métricas conocidas |
| Comparación incluida en motor | Dijkstra O(V²) independiente, sin usar heap/heurística/aristas del motor, sobre 30 mapas de semilla fija para cada lambda **0, 0.25, 1, 4 y 20**: 150 comparaciones |
| Datos: 4 | Contrato real, SHA-256, binario corrupto/truncado, rechazo de otro layout y rutas auditadas en Jezero |
| Cliente: 2 | Terminar/recrear, callback obsoleto, cancelación explícita, error del transporte y dispose |
| Navegador: 3 | Worker real con Jezero, terminación de cálculo activo y sustitución por petición nueva |

Salida final (local-only evidence omitted from source release), [reporte JSON](routing-validation/vitest.json), JUnit (local-only evidence omitted from source release), [fuentes de pruebas](../tests/routing/).

También se ejecutaron **las 16 pruebas pytest geoespaciales existentes como regresión**, sin regenerar datos: salida (local-only evidence omitted from source release), JUnit (local-only evidence omitted from source release). La comprobación TypeScript `tsc --noEmit` pasó. El bundle browser del worker se generó correctamente con esbuild.

## 6. Demostración con la cuadrícula real

Se seleccionaron los extremos de forma determinista: celdas más próximas a las posiciones relativas `(0.15,0.85)` y `(0.85,0.15)` dentro de la mayor componente conexa de cuatro vecinos. La componente cumple máscara, pendiente y pendientes entre centros; tiene **128,649 celdas**. No son estaciones NASA ni POI científicos.

| Extremo | Columna, fila | Coordenadas locales x,y (m) | Longitud E / latitud planetocéntrica | Elevación (m) |
| --- | --- | --- | --- | ---: |
| Origen | **59,302** | **−1373,1092373** | **77.4105815563°,18.4289932407°** | −2550.068115 |
| Destino | **334,53** | **1377,1094863** | **77.4594895827°,18.4710010468°** | −2560.765869 |

| Métrica real | A · distancia, lambda 0 | B · pendiente, lambda 4 |
| --- | ---: | ---: |
| Longitud horizontal | **3781.391770 m** | **4003.990617 m** |
| Longitud sobre el terreno, aproximada | 3785.908439 m | 4005.098075 m |
| Ascenso acumulado | **56.729980 m** | **28.269775 m** |
| Descenso acumulado | 67.427734 m | 38.967529 m |
| Desnivel neto | −10.697754 m | −10.697754 m |
| Pendiente máxima del modelo | **14.388532°** | **8.874289°** |
| Coste bajo su propia función | 3781.391770 | 4932.615240 |
| Celdas en el recorrido / aristas | 276 / 275 | 314 / 313 |
| Celdas exploradas | **8553** | **51534** |
| Celdas descubiertas | 9777 | 52722 |
| Máximo de celdas abiertas | 1686 | 1287 |
| Primera medición del motor Node | **17.8919 ms** | **39.1359 ms** |

Exposición por longitud horizontal:

| Intervalo de pendiente efectiva | A | B |
| --- | ---: | ---: |
| [0,5)° | 1280.365799 m · 33.859644 % | 3462.152955 m · 86.467559 % |
| [5,10)° | 2009.188309 m · 53.133566 % | 541.837662 m · 13.532441 % |
| [10,15)° | 491.837662 m · 13.006789 % | 0 m · 0 % |
| [15,90)° | 0 m · 0 % | 0 m · 0 % |

En este caso B es más larga y reduce ascenso y pendiente máxima. Esto es un resultado medido de este par, no una garantía para toda consulta o todo aumento de lambda.

### Auditoría independiente sobre el grafo completo

Además de revisar cada arista en TypeScript con otro código, Python reconstruyó el grafo completo desde los mismos binarios, sin importar el motor. Verificó máscara, vecindad, esquinas, pendiente de segmento, coste, métricas, coordenadas exportadas y extremos geográficos. El grafo permitido contiene **999,894 aristas dirigidas**.

Dijkstra de SciPy obtuvo **3781.391770309028** para A y **4932.615239510466** para B: diferencia de coste con A* **0.0** en los valores registrados. Se revisaron **588 aristas exportadas, con 0 infracciones**. Las discrepancias de sumas de métricas entre JS y NumPy fueron inferiores a `1e-6` (máxima observada aproximadamente `2.1e-11`). [Informe independiente](routing-validation/independent-dijkstra.json).

### Rendimiento medido

Equipo de esta ejecución: **Intel Core i7-13620H, 16 procesadores lógicos, 16,870,076,416 bytes RAM, Windows 11 x64, Node 24.21.0**. Es el equipo actual; no se extrapola a móviles, otros portátiles o hosting.

Se midió la primera consulta A* registrada y diez repeticiones por modo, **22 cálculos** en total. La selección de componentes se ejecutó antes y pudo calentar funciones compartidas: no se presenta como arranque en frío de todo el proceso. Todas las repeticiones conservaron exactamente la secuencia de celdas.

| Medición del motor Node | A | B |
| --- | ---: | ---: |
| Mediana de 10 repeticiones | 6.69725 ms | 34.36100 ms |
| P95 por rango más próximo de las repeticiones | 9.94220 ms | 41.31330 ms |
| Máximo incluyendo primera medición | **17.89190 ms** | **41.31330 ms** |
| Objetivo <2000 ms | Cumplido | Cumplido |

En la ejecución final de Chrome, el motor dentro del worker midió **14.7 / 40.2 ms** y el viaje completo de petición/respuesta **28.0 / 40.5 ms** para A/B, respectivamente. La descarga de datos se midió fuera de ese intervalo. [Resultados Node y todas las muestras](routing-validation/jezero-results.json), [mediciones del navegador](routing-validation/browser-worker.json).

### Archivos de demostración

- [Ruta A JSON](../data/routes/jezero-hirise-v1/route-a.json).
- [Ruta B JSON](../data/routes/jezero-hirise-v1/route-b.json).
- [Figura con recorridos y perfiles](routing-validation/routes-jezero.png), generada con Matplotlib e inspeccionada visualmente.
- [Resumen de métricas, extremos, selección, rendimiento e integridad](routing-validation/jezero-results.json).

Cada JSON contiene la ruta ordenada por índices, geometría x/y/z en metros, parámetros, versión/hash de datos, versión de motor, métricas, tiempos, conteos y auditoría. La [comprobación final de integridad](routing-validation/final-checks.json) volvió a leer los **3 originales NASA y las 19 salidas preparadas** y confirmó todos sus tamaños y SHA-256, además de la identidad del manifiesto en las rutas. No se ejecutó el pipeline de preparación.

## 7. Reproducción

Con Node ≥24, Python y el entorno geoespacial ya preparado:

```powershell
npm ci
npm run typecheck
npm run test:report
npm run build:worker
npm run demo:routes
& .\.venv\Scripts\python.exe scripts/routing/verify_routes.py
& .\.venv\Scripts\python.exe -m pytest -q --junitxml=docs/routing-validation/pytest-regression.xml
node scripts/routing/check-evidence.mjs
```

Las dependencias están fijadas en [package-lock.json](../package-lock.json): TypeScript 7.0.2, Vitest 5.1.0, esbuild 0.28.2, tsx 4.23.15 y playwright-core 1.65.1. No se instalaron Next.js, React ni OpenLayers en esta fase.

Los tests browser requieren Chrome o Edge instalado; se detectan las ubicaciones Windows utilizadas. Para otra ubicación, definir `MARS_TEST_BROWSER` con la ruta al ejecutable Chromium. No se omiten silenciosamente si falta el navegador. Las pruebas levantan un servidor temporal en loopback y lo cierran al terminar; no publican una web.

En el sandbox de esta sesión, tsx no pudo consultar `os.userInfo` y esbuild no pudo leer un directorio antecesor. La demo, la compilación y las pruebas browser se ejecutaron fuera de ese sandbox y pasaron. No se cambió ninguna instalación global. Los comandos anteriores describen la reproducción normal en el equipo; las herramientas pueden volver a requerir acceso fuera del sandbox dentro de Codex.

## 8. Integración pendiente con OpenLayers

Falta implementar el mapa, publicar/copiar los activos, seleccionar extremos, mostrar estados y dibujar las rutas. No hace falta cambiar el algoritmo ni reprocesar los datos.

1. Servir una copia intacta del manifiesto y sus tres binarios desde la misma carpeta, por ejemplo `/data/jezero-hirise-v1/`. El cargador verifica los archivos por nombre y SHA-256.
2. Compilar el worker con `npm run build:worker` y servir `dist/workers/routing.worker.js` como `/workers/routing.worker.js`; en Next estático se copiará a `public/workers/`. El bundle es ESM de navegador sin dependencias Node.
3. Configurar la vista OpenLayers con **la proyección local marciana en metros** y la extensión real del recorte. Usar `ortho.tif` georreferenciado como base, o una representación cartográfica preparada con su misma extensión. Las figuras de QA son informes.
4. Convertir los clics x/y con `projectedToCell`. Rechazar `null` y respetar `invalid-start`/`invalid-goal`. Los recorridos unen centros de celda: mostrar el ajuste desde el clic al centro con `cellCenter` y su distancia. No desplazar automáticamente un clic inválido a otro lugar.
5. Usar el cliente del worker y conservar el guard de petición vigente. Ejemplo de integración desde un módulo del mapa, todavía sin interfaz:

```typescript
import {
  loadPreparedGrid, RoutingWorkerClient, adaptBrowserWorker,
  projectedToCell, cellCenter, cellOf,
} from '../lib/routing/index';

const grid = await loadPreparedGrid('/data/jezero-hirise-v1/manifest.json');
const client = new RoutingWorkerClient(grid, () =>
  adaptBrowserWorker(new Worker('/workers/routing.worker.js', { type: 'module' })));

const start = projectedToCell(grid, { x: startXY[0], y: startXY[1] });
const goal = projectedToCell(grid, { x: goalXY[0], y: goalXY[1] });
if (start && goal) {
  const outcome = await client.request(start, goal, {
    mode: 'slope-penalty', lambda: 4, maxSlopeDeg: 15, thetaRefDeg: 15,
  });
  if (outcome.status === 'completed' && client.isCurrent(outcome.requestId)) {
    const result = outcome.result;
    if (result.status === 'success') {
      const coordinates = result.cells.map(id => {
        const p = cellCenter(grid, cellOf(grid, id));
        return [p.x, p.y];
      });
      // coordinates -> LineString/Feature en una capa vectorial de la misma proyección.
      // result.metrics / parameters / dataset -> panel y ficha exportable.
    }
    // Otros estados -> mensaje explícito y limpieza de la ruta anterior.
  }
}
// Nueva selección durante cálculo: request() termina la petición activa.
// Botón cancelar: client.cancel(); al desmontar el mapa: client.dispose().
```

Para comparar A y B simultáneamente, usar **dos clientes/workers** (uno por modo), porque cada cliente tiene semántica de última petición vigente. La comparación de navegador ejecutada los solicita secuencialmente en un mismo cliente. Al cambiar extremos, cancelar ambos y asociar también el par de resultados a la selección actual. Esto evita que la petición B cancele A accidentalmente en un único cliente.

Las coordenadas ya son locales marcianas; la futura capa vectorial debe compartir la proyección de la vista y la imagen. Quedan por probar el mapa OpenLayers real, su empaquetado Next.js, los clics/controles y el despliegue. El ejemplo es una guía de integración, no una prueba de una interfaz inexistente.

## 9. Limitaciones y pendientes

La optimización es sobre un grafo de centros de celdas de 10 m, con elevación media y pendiente conservadora derivadas de datos orbitales. Su optimalidad no implica una ruta continua óptima ni seguridad física. La longitud 3D y el ascenso/descenso dependen de ese muestreo; se omiten cambios de relieve subcelda y no se infiere estabilidad del terreno, arena, obstáculos pequeños, meteorología, radiación, autonomía EVA o capacidad fisiológica.

No hay control geodésico externo ni nueva validación subpíxel. Se mantienen las limitaciones del DTM y la decisión de georreferenciar la imagen mediante su LBL. Datos desconocidos permanecen bloqueados. Las constantes 15°/lambda 4 y las clases de exposición son supuestos versionados del prototipo, no recomendaciones operativas NASA.

No quedan fallos conocidos en los casos ejecutados. Permanecen pendientes la integración con el mapa y su suite completa, otros navegadores/dispositivos y el despliegue. Geología y puntos científicos siguen fuera de esta fase. No se ha modificado ninguna fuente científica ni declarado una ruta físicamente segura.
