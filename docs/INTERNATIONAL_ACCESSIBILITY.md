# English interface preview — 15 November 2026

**Current update:** the English interface has been promoted to production after a new preview and production validation. The original preview record below is historical. See [final review](REVISION_PRESENTACION_FINAL.md).

**Resultado: borrador HTTPS validado; se recomienda publicarlo. Producción no se ha sustituido.** Esta revisión cambia presentación lingüística y ajuste de texto; no añade funcionalidades, datos, dependencias ni algoritmos.

## Versión y acceso

- [Borrador en inglés](https://english-20261115-review--mars-pathfinder-the-meowrtian.netlify.app).
- [URL inmutable verificada](https://6af9d5feb12795269823ab52--mars-pathfinder-the-meowrtian.netlify.app), deploy `6af9d5feb12795269823ab52`, estado `ready`.
- Proyecto existente: `89d24aa6-4300-4b08-afcc-84f51da7f164`; sin funciones de servidor, otro proyecto ni configuración de pago.
- Rama local `english-preview-20261115`; commit construido `10ba4dcf0eb3442e19ada0f75ad6975fcd90d26d`. Las revisiones documentales/auditores posteriores conservan sus entradas de ejecución.
- [Producción conservada](https://mars-pathfinder-the-meowrtian.netlify.app): deploy `6af9c6aa89bcb0bfe5fb7e09`, build `29a4d63`. Su HTML y `release.json` se cotejaron contra el paquete preservado después de validar el borrador. [Comprobación final](english-preview-20261115/final-checks.json).
- No se integró esta rama en `main`, no se hizo push ni se ejecutó un deploy de producción en esta fase.

## Cambios de idioma

`html lang="en"`, metadescripción y toda la interfaz del escenario actual en inglés: navegación, controles, instrucciones de selección, capas, leyendas, marcadores, perfil, métricas, carga, cancelación, errores, fuentes, fichas y advertencias. Números `en-US`; fechas de fotografías en inglés y UTC. Se revisaron también nombres accesibles, títulos y textos alternativos.

`lib/map/display-copy.ts` presenta en inglés los títulos y la procedencia visual, objetivos, referencias y advertencias que los registros preparados conservan en español. Los JSON originales, identificadores, nombres publicados de unidades, referencias/URLs, coordenadas, fechas, incertidumbres y créditos no cambian. El identificador del registro del equipo aparece en la ficha para su trazabilidad. Los campos fuente españoles presentes en el JSON exportado permanecen como registros originales, no se altera el contrato de exportación.

Se mantienen la incertidumbre geológica de **100–200 m**, la distinción entre celda de 10 m y exactitud, el desfase del centro óptico, la ausencia de exactitud absoluta por waypoint, la posición del rover frente al terreno fotografiado y la ausencia de certificación de seguridad EVA. Las capas geológicas siguen fuera de costes y barreras de A*.

No se añadió selector EN/ES: no había infraestructura bilingüe y la prioridad fue una interfaz uniforme en inglés con el mínimo cambio. No se añadió ninguna dependencia.

## Pruebas ejecutadas

Sobre el commit construido, en el checkout Git aislado:

| Comando | Resultado real |
|---|---|
| `npm run build` | Exit 0; exportación estática, 28,649 s |
| `npm run typecheck` | Exit 0 |
| `npm run test:report` | 37/37 rutas y workers |
| `npm run test:interface:report` | 35/35 interfaz/ciencia, incluidos 15 casos de navegador |
| `.venv/Scripts/python.exe -X utf8 -m pytest -q` | 22/22; entorno aislado completo con originales locales |

Se adaptaron los selectores/aserciones a los nuevos textos. Los casos existentes verifican además el idioma del documento, ausencia de los textos españoles anteriores en estados visibles/nombres accesibles y ajuste de las celdas métricas. La prueba científica comprueba que las traducciones cubren los campos utilizados sin mutar los datos. Se ejercitaron los errores de NoData, pendiente, fuera del mapa, ausencia de ruta e integridad, además de cancelación. No se sumaron casos artificiales al contador: siguen siendo **72 Vitest + 22 pytest**.

[Resultados y duraciones](english-preview-20261115/checks.json), [build](english-preview-20261115/build.txt), [typecheck](english-preview-20261115/typecheck.txt), [rutas](english-preview-20261115/routing.txt), [interfaz](english-preview-20261115/interface.txt), [Python](english-preview-20261115/python.txt).

La consulta de estado/historial de Defender no encontró amenazas/detecciones relacionadas ni revisión pendiente; no se presenta como análisis completo nuevo. Next advirtió que ignoraba el lockfile del directorio padre, ajeno al checkout Git; utilizó el proyecto local y terminó correctamente. No se cambiaron instalaciones globales ni la configuración de Next para ocultar la advertencia.

## Navegador HTTPS real

Chrome 157.0.8103.51, dos contextos privados nuevos sin credenciales, caché de navegador desactivada: **1440×900 y 390×844**. Solicitudes externas bloqueadas. Pasaron Start Mission→M3, restauración de cámara/capas/parámetros, selección manual por clic, comparación/resumen, visibilidad de capas, minimapa, M1–M3 con fuentes desplegadas, geología, ambas fotografías/créditos/fecha/verificación documental, perfil y descargas A/B. **Ocho JSON** fueron descargados entre ambos flujos y tamaños y cotejados con el motor y el auditor independiente de aristas.

Cero errores JavaScript/consola ni fallos de activos durante los flujos finales. Se cotejaron los hashes de **68 archivos / 6.197.156 bytes**. Se permite exclusivamente el comentario inerte Netlify conocido en los HTML; los demás bytes deben coincidir. [Inventario previo](english-preview-20261115/preflight.json), [informe completo HTTPS](english-preview-20261115/preview/browser-audit.json).

Readiness observada: **2176,9 ms escritorio / 1692,4 ms móvil emulado**. Observaciones únicas de este equipo/red, CDN no purgada; no representan garantías globales ni un teléfono físico.

Capturas reales revisadas:

- [Escritorio y rutas M3](english-preview-20261115/preview/1440-production-routes.png).
- [Comparación y perfil móvil](english-preview-20261115/preview/390-production-comparison.png).
- [Fuentes del objetivo móvil](english-preview-20261115/preview/390-production-objective.png).
- [Fotografía documentada](english-preview-20261115/preview/390-production-perseverance.png).
- [Fuentes y procedencia en inglés](english-preview-20261115/preview/390-production-credits.png).

Los nombres `*-production-*` de estos PNG proceden del guion HTTPS compartido: **en esta carpeta corresponden al borrador**, cuya URL consta en el informe, no a la producción anterior.

## Ciencia y presentación

**55/55 hashes protegidos idénticos**; diff Git vacío en `lib/routing`, workers, activos públicos, datos y dependencias frente a `fa79089`. Los cambios en los validadores de mapa/ciencia afectan únicamente a mensajes, no condiciones ni cálculos.

M3 sigue en celda `(334,233)`, origen `(59,302)`, cap 15°, λ=0/4, datos `jezero-hirise-v1`. El botón manual **Load validated example** conserva el destino anterior `(334,53)`; no se mezclan ambos experimentos.

| Métrica M3 | Route A — Shortest | Route B — Slope-aware |
|---|---:|---:|
| Distancia horizontal | 3,035.81 m | 3,118.65 m |
| Ascenso | 36.39 m | 31.88 m |
| Pendiente máxima modelada | 14.54° | 9.02° |

Se contaron nuevamente **siete slides y siete páginas PDF** y se cotejó la tabla con los JSON HTTPS recién descargados. Start Mission, M3, 72 Vitest, fuentes y declaración Codex/ChatGPT siguen siendo coherentes. Los dos materiales conservan los hashes de la revisión visual previa, sin regeneración innecesaria. Sus imágenes del canvas son capturas reales de la producción validada anterior, cuyos datos/recorridos/símbolos no cambian; no se presentan como capturas nuevas del borrador. [Comprobación de coherencia](english-preview-20261115/materials-coherence.json).

## Incidencias resueltas y límites

La primera revisión visual detectó que “weighted m” no cabía en móvil. Se permitió envolver el texto, conservando fuente, unidad y valores, y se repitieron build/typecheck/las 94 pruebas antes del segundo borrador. El primer guion HTTPS aún buscaba la frase española “no de los blancos”; se corrigió a “not the targets” y se repitieron ambos flujos completos sin cambiar el paquete. Los intentos anteriores se conservan en `.cache/english-preview-20261115/` y no cuentan como validados.

**Se recomienda publicar el paquete final validado**, tras la decisión del equipo. No hay bloqueos conocidos en el alcance comprobado. Quedan fuera de esta revisión un dispositivo móvil físico, otros motores de navegador, una auditoría WCAG completa y un selector bilingüe. Permanecen todas las limitaciones científicas del prototipo.
