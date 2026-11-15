# Mejora final para el jurado — Mars Pathfinder / The Meowrtian

**Estado actual, 15 de noviembre de 2026: publicada y verificada en HTTPS en el mismo sitio Netlify, tras superar un despliegue de prueba.** No se han añadido funcionalidades durante esta fase de publicación.

## Publicación, código y materiales actuales

| Referencia | Resultado comprobado |
|---|---|
| Prueba | [jury-20261115-review](https://jury-20261115-review--mars-pathfinder-the-meowrtian.netlify.app), deploy `6af9c51343e35768f69c472f` |
| Producción | [Mars Pathfinder](https://mars-pathfinder-the-meowrtian.netlify.app), deploy `6af9c6aa89bcb0bfe5fb7e09`, ready |
| Proyecto existente reutilizado | `89d24aa6-4300-4b08-afcc-84f51da7f164`; sin otro proyecto, Git CD ni servicios de pago |
| Commit construido | [29a4d63a9259c9f6ee8c8dde393cfcf23e29bb49](https://github.com/EduardoManzanoAlcaraz/mars-pathfinder-the-meowrtian/commit/29a4d63a9259c9f6ee8c8dde393cfcf23e29bb49), descendiente de las mejoras `cb2a0b0` |
| Correspondencia | [release.json público](https://mars-pathfinder-the-meowrtian.netlify.app/release.json): 63 entradas de ejecución con hashes; huella conjunta `e68dac905d559d977d05eec2bce34af55d7a7d0d35b8ab0830f444dd4b59964a` |
| Paquete publicado | **68 archivos / 6.194.991 bytes**, incluida la identificación de versión; inventario SHA-256 `80e2a1a845020372c604c76cbe4f67e70eb5bcba8f96984ce29d1c5393973a86` |
| Nueva ejecución de pruebas | **37 rutas/workers + 35 interfaz/ciencia = 72 Vitest**, **22 pytest**, build y typecheck correctos |
| Datos y algoritmos anteriores | **50/50 hashes idénticos**, sin diferencias Git en motor, workers o paquetes HiRISE/ciencia previos |

La rama de mejoras se integra en `main` mediante avance rápido y push normal. Las revisiones posteriores del repositorio completan documentación, auditores y materiales; no cambian las entradas de ejecución del commit construido. Esa equivalencia se comprueba contra `release.json`. La API Netlify informa `commit_ref:null` para esta subida manual: se registra la identificación propia verificable, sin atribuir al proveedor un SHA que no proporciona.

La prueba mantuvo producción en `6af97dee2c4df4cb0f9da6cc`. Después de aprobarla se publicó **el mismo paquete, sin recompilarlo**. En cada URL pasaron dos contextos privados nuevos de Chrome 157, 1440×900 y 390×844, caché de navegador desactivada y solicitudes externas bloqueadas: Start Mission→M3, restauración del encuadre, ambas rutas, resumen y métricas, minimapa, M1–M3, geología, ambas fotos/créditos, perfiles y exportación JSON. Se ejecutó también el flujo manual por clic. Se descargaron y auditaron **8 JSON por entorno** entre ambos flujos y resoluciones.

Los flujos finales no tuvieron errores JavaScript/consola, fallos de activos ni dependencias externas necesarias. Los 68 cuerpos HTTP fueron contrastados: **64 íntegramente idénticos**; cuatro HTML incluyen exclusivamente el comentario inerte Netlify ya observado, de 326 bytes, y el resto coincide íntegramente. HTTP redirige 301 a HTTPS. Una URL deliberadamente inexistente devuelve 404.

Evidencias vigentes: [pruebas](jury-release-20261115/checks.json), [integridad científica](jury-release-20261115/scientific-integrity.json), [prueba HTTPS](jury-release-20261115/preview/browser-audit.json), [producción HTTPS](jury-release-20261115/production/browser-audit.json), [resumen final](deployment-validation/final-checks.json).

Capturas reales de producción: [escritorio](jury-release-20261115/production/1440-production-routes.png), [comparación móvil](jury-release-20261115/production/390-production-comparison.png), [contexto USGS](jury-release-20261115/production/390-production-context.png), [M3](jury-release-20261115/production/390-production-objective.png), [foto documentada](jury-release-20261115/production/390-production-perseverance.png).

### Materiales finales de entrega

El deck original fue editado conservando exactamente **siete diapositivas**, diseño y tabla nativa editable en slide 5. Se embebieron los cinco PNG nuevos del mapa de producción sin cambiar sus bytes y se conservó la foto NASA original. La comparación sigue siendo M3 y sus cifras no cambiaron. Slide 6 muestra **72 Vitest** y **Apache-2.0 aprobada por el equipo**; slide 7 explica Start Mission y retira el intervalo de carga de la versión anterior. Fuentes, créditos y declaración de Codex/ChatGPT se mantienen.

PowerPoint abrió/exportó el PPTX y el PDF conserva **siete páginas**, texto nativo y enlace activo a la demo. Se inspeccionaron individualmente las siete diapositivas renderizadas y las siete páginas PDF. `SUBMISSION_TEXT_EN.md` se actualizó al mismo escenario y conteos. Copias finales: `deliverables/spaceapps-2026/`. [Comprobaciones de materiales](jury-release-20261115/materials-validation.json).

### Incidencias resueltas y límites

La CLI rechazó combinar `--context` con `--no-build` antes de subir; se corrigió a borrador con alias. El conector repitió la autenticación y se utilizó la CLI ya autorizada. El guion detectó reutilización del origen guiado en la prueba manual y selecciones encadenadas antes de terminar el desplazamiento suave; se separaron ambos flujos, se añadieron las descargas guiadas y se exigió estabilidad del rectángulo visible. No se desplazaron artificialmente las fichas para aprobarlas. Los intentos fallidos se conservan localmente y no cuentan como aprobados. La aplicación y el paquete no cambiaron durante esas correcciones del guion.

Readiness observada en la nueva producción: **2792,7 ms escritorio / 2282,8 ms móvil**. Son observaciones únicas en este equipo/red, caché de navegador vacía, CDN no purgada y viewport móvil emulado; no garantías globales ni ensayo de teléfono físico. Las cifras locales siguientes pertenecen a la fase anterior. Persisten las limitaciones científicas y de navegadores documentadas.

### Recuperación de la versión anterior

Se conservan el tag **`before-jury-release-20261115`**, commit `33ae224304735917200f2cbdf4f28c628affca89`, y el deploy anterior `6af97dee2c4df4cb0f9da6cc`. El respaldo `.cache/releases/mars-pathfinder-20261115T095223Z.zip` fue verificado y sus **66 archivos / 6.115.416 bytes** se extrajeron a `.cache/jury-release-20261115/previous-out/`, todos con SHA-256 original. [Registro](jury-release-20261115/recovery.json).

Si aparece un problema, se publica ese paquete verificado como **un despliegue nuevo** en el mismo proyecto:

```powershell
node .tools/netlify-cli/node_modules/netlify-cli/bin/run.js deploy --prod --no-build --dir .cache/jury-release-20261115/previous-out --site 89d24aa6-4300-4b08-afcc-84f51da7f164 --message "Recover verified previous static package" --json
```

Después se verifica HTTPS y se registra el nuevo ID; la corrección del código debe llegar a `main` mediante un nuevo commit/revert revisado y push normal, usando el tag preservado como referencia. El paquete anterior utiliza el flujo manual. **No se ha ejecutado recuperación**: sus archivos están preparados y verificados, y la nueva producción supera las comprobaciones.

## Registro de implementación y verificación local previa

## Cambios e impacto en la demostración

1. **Contexto de Jezero.** Minimap vectorial con suelo y abanicos cartografiados por USGS, rectángulo naranja del recorte HiRISE y contorno blanco de la vista actual. Dos puntos conservan las posiciones documentadas de los registros del rover. Permite volver al área de estudio; empieza plegado en móvil. Explica dónde estamos sin habilitar rutas fuera del terreno válido.
2. **Start Mission.** Botón visible antes del mapa también en móvil. Centra la vista, activa ortoimagen/máscara/objetivos, muestra A y B, establece 15° y λ=4, carga el origen existente y el objetivo M3 verificado y calcula ambas rutas en los workers. Al terminar muestra la comparación; «View routes on terrain» devuelve al mapa y «Inspect M1–M3» abre una ficha científica. Requiere contexto científico verificado para identificar M3; si este falla, informa de ello y el planificador manual sigue disponible.
3. **Comparación legible.** Route A / Shortest y Route B / Slope-aware, colores y trazos conservados, distancia horizontal, distancia sobre terreno aproximada, ascenso, descenso, pendiente máxima y tiempo interno del worker. El texto automático describe diferencias medidas, incluidas igualdad o aumentos; no promete que B siempre mejore cada métrica ni certifica seguridad.
4. **Objetivos científicos.** Títulos y propósitos en inglés, unidad y cita originales, etiqueta original del registro y fuentes accesibles, advertencia de 100–200 m y distinción entre celda de 10 m y exactitud de ubicación. Son **team-selected science objectives**, nunca estaciones oficiales. Las traducciones presentan los propósitos ya documentados, sin atribuir nuevas observaciones o minerales a los puntos.
5. **Perfil de elevación.** Más altura, ejes y leyendas más legibles, mejor espaciado y protagonismo junto a las métricas. Se explicita que la escala vertical se ajusta a cada ruta: su apariencia exagera las pendientes y no sustituye los valores numéricos.

El botón manual «Usar ejemplo validado» conserva su destino anterior `(334,53)`. La nueva misión guiada usa **M3 `(334,233)`**, el mismo experimento de producción y de las siete diapositivas. No se mezclan sus resultados.

## Contexto regional: datos, transformaciones y límites

Se reutilizó `data/raw/usgs-sim3464/extracted/**/Nili.gdb`, capa `GeoUnits_v1`, de **Sun & Stack (2020), USGS SIM 3464**, [DOI oficial](https://doi.org/10.3133/sim3464). No se descargó ningún producto.

`scripts/data/prepare_overview.py` selecciona Njf/NHjf1/NHjf2, transforma sus vértices desde el CRS original MTM marciano al mismo CRS local equirectangular de HiRISE —esfera de radio 3396190 m; metros, norte arriba— y deriva el contexto. Simplifica con tolerancia máxima 25 m y reduce esa tolerancia si la comparación geométrica supera el límite. Redondea coordenadas a 0,1 m únicamente para reducir bytes del esquema. **Ese redondeo no es precisión científica.**

Resultados realmente ejecutados:

| Propiedad | Resultado |
|---|---|
| Polígonos / fuente | 37; IDs originales conservados |
| Nuevo recurso | `public/data/jezero-overview-v1/context.json`, **48.982 bytes** |
| Extensión regional local, m | `[-12202.930931, 1074279.629504, 22375.639655, 1106709.299050]` |
| Recorte HiRISE mostrado, m | `[-1968, 1091838, 1968, 1095398]` |
| Máxima distancia de Hausdorff medida, geometría derivada/original reproyectada | **24,977046 m** |
| Máximo error numérico de transformación ida/vuelta | **2,13 × 10⁻⁹ m** |
| Validez y contención del recorte | Todas las geometrías válidas; área de estudio contenida |
| Repetición del script | Mismo SHA-256 `f20ada191ed59a7f053d74fb022e98f317df8de5a530dc49d32d76593c40f8bb` |

[Informe de preparación](jury-improvement/overview-preparation.json). El loader comprueba ese hash, CRS, identidad topográfica, extensión y `routingUse:false`. Una respuesta corrupta desactiva solo el contexto regional, sin inventar un reemplazo.

**No es una ortoimagen regional ni un trazado del borde del cráter.** Muestra solo las unidades seleccionadas y omite las demás; los límites heredan el desfase geológico de 100–200 m. El error numérico anterior no mide exactitud geológica. Los puntos blancos son posiciones documentales del rover, no blancos de fotografías. La caja de vista proviene de OpenLayers; el esquema conserva escala métrica uniforme y se prueba su orientación. No participa en A*, máscaras ni costes.

## Resultados reales del escenario guiado

Origen `(59,302)`, destino M3 `(334,233)`, `jezero-hirise-v1`, motor 1.0.0, cap 15°, referencia 15°, λ A=0/B=4. Las celdas, métricas y aristas descargadas coinciden con el motor y pasan la auditoría independiente.

| Métrica | A — Shortest | B — Slope-aware |
|---|---:|---:|
| Distancia horizontal | 3035,807 m | 3118,650 m |
| Distancia aproximada sobre terreno | 3038,974 m | 3120,959 m |
| Ascenso | 36,391 m | 31,878 m |
| Descenso | 64,307 m | 59,794 m |
| Pendiente máxima modelada | 14,536° | 9,019° |
| Celdas exploradas | 17.569 | 50.939 |
| Cálculo worker, escritorio | 25,0 ms | 55,7 ms |
| Cálculo worker, móvil emulado | 26,8 ms | 54,5 ms |

Lectura correcta del experimento: B añade **82,84 m**, con **4,51 m menos ascenso** y **5,52° menos pendiente máxima modelada**. No es una conclusión general para otras selecciones ni una declaración de seguridad EVA.

Exportaciones reales: [A escritorio](jury-improvement/1440-route-a.json), [B escritorio](jury-improvement/1440-route-b.json), [A móvil](jury-improvement/390-route-a.json), [B móvil](jury-improvement/390-route-b.json).

## Verificación ejecutada

Primero se leyeron README, AUDITORIA_FINAL, DESPLIEGUE_FINAL y NASA_RESOURCES y se capturó la aplicación HTTPS actual en dos sesiones nuevas de Chrome. [Registro del estado publicado](jury-improvement/published-baseline.json). Defender se consultó antes y al cerrar ejecuciones: protección activa, cero amenazas/detecciones/eventos relacionados que requirieran revisión. Fue consulta de estado/historial, no un análisis completo nuevo.

| Comprobación | Resultado real | Evidencia |
|---|---|---|
| `npm run typecheck` | Exit 0 | [Salida](jury-improvement/typecheck-final.txt) |
| `npm run build` | Exit 0; exportación estática | [Salida](jury-improvement/build-final.txt) |
| `npm test` | **37/37**, motor y workers reales | [Salida](jury-improvement/routing-tests.txt) |
| `npm run test:interface` | **35/35**, incluidos 15 casos de navegador | [Salida](jury-improvement/interface-tests-final.txt) |
| `.venv/Scripts/python.exe -m pytest -q` | **22/22**, con originales locales presentes | [Salida](jury-improvement/pytest-final.txt) |
| Flujos guiados reales, Chrome 157 | **2/2**, 1440×900 y 390×844 | [Informe completo](interface-validation/browser.json) |
| Descargas de rutas del modo guiado | **4/4** cotejadas y auditadas | JSON anteriores e informe final |
| Todos los activos estáticos por HTTP local | **67/67**, HTTP 200 y SHA-256 idénticos | [Inventario y resultados](jury-improvement/final-checks.json) |
| Conservación de motor, workers y datos previos | **50/50 hashes idénticos** | Mismo informe |
| Dependencias y lock | Sin cambios; sin instalaciones globales | Comprobación binaria contra la publicación anterior |

Las pruebas nuevas cubren hash/CRS/extensión del contexto, orientación y escala uniforme, correspondencia exacta de los puntos del rover, rechazo de metadatos incompatibles, resumen sin mejoras inventadas, una misión después de cambiar zoom/límite/lambda/capa, reposición de parámetros, exportaciones auditadas y fallo aislado del minimapa. Conservan las comprobaciones anteriores de NoData, pendientes, esquinas, cancelación real, fotos y procedencia.

No se observaron errores JavaScript/consola, activos HTTP fallidos ni solicitudes externas necesarias en los flujos aprobados. La respuesta dañada del contexto es un fixture HTTP sintético de prueba, nunca un dato científico guardado.

### Tamaño y tiempos locales

- Paquete completo: **67 archivos / 6.185.044 bytes**, frente a 66 / 6.115.416 en la publicación anterior: **+69.628 bytes, aproximadamente +1,14 %**.
- Nuevo contexto: 48.982 bytes; no originales IMG/JP2/GeoTIFF ni base FileGDB en el build.
- Mapa, ciencia y contexto listos: **536,0 ms escritorio / 408,7 ms móvil**.
- Click Start Mission → estado de comparación completo: **187,7 ms / 166,8 ms**.

Son mediciones de una ejecución por tamaño, HTTP local, equipo de desarrollo y Chrome con viewport móvil emulado. No representan un teléfono físico, una red fría, percentiles ni rendimiento de la futura publicación. Los tiempos no incluyen que una persona lea o inspeccione los resultados.

## Problemas encontrados y corregidos

- La prueba inicial del minimapa seleccionaba también los SVG de los iconos: se limitó al SVG con `role=img`. Fallaron dos casos de prueba por este selector; no se contaron como aprobados hasta repetirlos.
- Las capturas revelaron que una regla CSS afectaba al icono de recentrado y lo ampliaba hasta tapar el contexto. Se limitó al SVG cartográfico y se añadieron aserciones de tamaño del icono y altura del panel.
- En móvil, el panel de contexto invadía la columna de zoom. Se desplazó a la izquierda, se plegó por defecto y se prueba que ambos límites no se intersectan. Al expandirlo se retiran temporalmente las leyendas que quedarían debajo; al abrir una ficha se oculta el contexto.
- La simplificación inicial no cumplió el error geométrico propuesto para todos los polígonos. El generador ahora reduce la tolerancia hasta comprobar el límite medido; no se declara precisión a partir del parámetro nominal.

Persisten avisos no fatales de GDAL por polígonos con muchas partes y de deprecación de `shapely.ops.transform` en el script de contexto. Ambos recorridos del generador terminaron correctamente y produjeron el mismo hash con las versiones aisladas fijadas. No se cambió el pipeline topográfico.

## Capturas reales inspeccionadas

| Vista | Evidencia |
|---|---|
| Aplicación pública anterior | [Escritorio](jury-improvement/before-1440.png), [móvil](jury-improvement/before-390.png) |
| Nueva versión local completa | [Escritorio](jury-improvement/after-1440.png), [móvil](jury-improvement/after-390.png) |
| Terreno y recorridos a M3 | [Escritorio](jury-improvement/map-1440.png), [móvil](jury-improvement/map-390.png) |
| Contexto regional | [Escritorio](jury-improvement/context-1440.png), [móvil](jury-improvement/context-390.png) |
| Comparación y perfil | [Escritorio](jury-improvement/comparison-1440.png), [móvil](jury-improvement/comparison-390.png) |
| Ficha científica con acciones fijas | [Escritorio](jury-improvement/objective-1440.png), [móvil](jury-improvement/objective-390.png) |

Son capturas de Chrome de la aplicación, sin imágenes generadas por IA ni modificaciones de los píxeles para fabricar datos o recorridos.

## Entrega y recomendación

La publicación y verificación HTTPS recomendadas en la fase local ya se completaron; el estado vigente figura al principio de este documento.

El verificador de despliegue ahora obtiene los totales de los nuevos informes ejecutados y exige éxito, cero fallos y cero pendientes. Los 27/64 históricos se han sustituido por 35/72 en las evidencias actuales.

El checkout fuente está en `.cache/github-publication/repository`. La rama de mejoras se integra en `main` conservando la historia; el commit construido y el manifiesto público permiten comprobar la correspondencia del código desplegado.

Prueba local: `npm start` y abrir `http://127.0.0.1:3000`. El build actual ya está en `out/`. No se necesita Python ni descargar originales para la demo web. La reproducción del nuevo vector sí requiere la base USGS local y el entorno geoespacial fijado.

Los tres cambios con mayor valor demostrativo son **entrada en un clic con el mismo caso de las diapositivas**, **trade-off numérico visible junto al perfil**, y **objetivos trazables dentro de un contexto regional real**. La presentación debe explicar sus límites con la misma claridad que sus resultados. Siguen fuera del modelo la estabilidad del suelo, arena, obstáculos pequeños, radiación y autonomía EVA; no se han certificado otros navegadores ni dispositivos móviles físicos.

OpenAI Codex asistió esta implementación y comprobación; ChatGPT asistió la planificación previa. NASA/USGS siguen siendo las fuentes de observaciones e interpretación, no la IA. Apache-2.0 para código original y avisos de terceros se conservan.
