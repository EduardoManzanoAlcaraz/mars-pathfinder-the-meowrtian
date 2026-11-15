# Publicación de Mars Pathfinder — The Meowrtian

**Actualización de producción, 15 de noviembre de 2026:** se publicó y verificó la mejora para el jurado en el mismo proyecto, deploy `6af9c6aa89bcb0bfe5fb7e09`. Start Mission usa el escenario M3; pasaron 72 Vitest, 22 pytest, build/typecheck y los flujos privados HTTPS de escritorio/móvil, tanto en prueba como en producción. [Estado actual, capturas y recuperación](MEJORA_FINAL_JURADO.md), [verificación actual](deployment-validation/final-checks.json). Las secciones siguientes conservan el relato y las cifras del despliegue inicial; los archivos de evidencia activa se han renovado y el respaldo previo está preservado.

## Estado comprobado

**Publicada y comprobada el 15 de noviembre de 2026:** [Mars Pathfinder — The Meowrtian](https://mars-pathfinder-the-meowrtian.netlify.app). La demo es accesible sin autenticación; pasaron los flujos completos de escritorio y móvil en contextos privados nuevos de Chrome.

Proyecto nuevo: `mars-pathfinder-the-meowrtian`, ID `89d24aa6-4300-4b08-afcc-84f51da7f164`. Deploy de producción `6af97dee2c4df4cb0f9da6cc`, publicado a las **10:40:02 de Madrid** (`09:40:02Z`), estado `ready`, sin error. [Instantánea de ese deploy](https://6af97dee2c4df4cb0f9da6cc--mars-pathfinder-the-meowrtian.netlify.app), [registro de Netlify](https://app.netlify.com/projects/mars-pathfinder-the-meowrtian/deploys/6af97dee2c4df4cb0f9da6cc), [respuesta de publicación](deployment-validation/deploy.json), [estado API](deployment-validation/deploy-state.json).

Se conserva la aplicación existente, sin nuevas funciones ni cambios de datos científicos. Contexto científico y alcance: [NASA_RESOURCES.md](NASA_RESOURCES.md), [AUDITORIA_FINAL.md](AUDITORIA_FINAL.md) y [PLAN.md](../PLAN.md). Los informes anteriores describen sus fases y no son evidencia de un despliegue posterior.

## Versión y paquete

- Aplicación `0.1.0`, Node `24.21.0`, Next.js `16.4.6`, Netlify CLI `27.19.0` aislada en `.tools/netlify-cli/`.
- El espacio de trabajo **no tiene repositorio Git**: `git status`/`rev-parse` no permiten registrar un commit. Se registra `commit: null`, sin inventar una revisión.
- Exportación estática: `output: 'export'`, `trailingSlash: true`, imágenes sin optimizador de servidor. `npm run build` genera `out/`; no se utiliza el antiguo `next export`.
- Comando de build en `netlify.toml`: `npm run build`. Directorio de publicación: `out`. Node 24 y adaptador Next de servidor omitido mediante `NETLIFY_NEXT_PLUGIN_SKIP=true`.
- Paquete: **66 archivos, 6.115.416 bytes**. Huella SHA-256 del inventario ordenado: `2f151b3b1e6a29d8089ef17b14615b23b5891c8a639edb94c440495abbf34c74`.
- Se conservan los headers de caché de manifiestos y chunks. No se añaden funciones, bases de datos, identidad, servicios de pago ni dependencias runtime de NASA.

[Inventario y análisis del paquete real](deployment-validation/preflight.json). Todos los archivos de `public/` coinciden byte a byte con `out/`, incluidos DEM/pendientes/máscara, visualizaciones, geología, objetivos, fotos y créditos. Los tres originales NASA y los originales USGS siguen en `data/raw/`, fuera del paquete. La revisión de formatos, tamaños, rutas privadas y firmas de credenciales no produjo hallazgos; no equivale a una prueba universal de ausencia de secretos.

## Verificaciones realmente ejecutadas

| Comprobación | Resultado |
|---|---|
| Defender, estado e historial de 30 días | Protección activa, 0 detecciones/amenazas relacionadas, revisión no requerida |
| `npm run typecheck` | Exit 0, repetido después de adaptar el guion de auditoría |
| `npm run build` | Exit 0, exportación estática generada |
| `npm run test:report` | 37/37 aprobadas, incluido worker real en Chrome |
| `npm run test:interface:report` | 27/27 aprobadas, incluidas 12 pruebas de navegador |
| pytest geoespacial/HiRISE/ciencia | 22/22 aprobadas |
| Comprobadores de evidencias de rutas/interfaz/ciencia | Exit 0; originales y preparados conservan sus hashes |
| Análisis del contenido publicable y comparación `public/`/`out/` | Exit 0, sin hallazgos |
| Navegador público 1440 × 900 y 390 × 844 | Dos flujos completos aprobados, Chrome 157.0.8103.51 |
| Errores JavaScript, consola y activos HTTP fallidos | Cero en ambos flujos finales |
| Integridad de los 66 archivos servidos | 62 idénticos byte a byte; 4 HTML con un único comentario inerte de Netlify de 326 bytes; contenido restante idéntico |
| MIME de JavaScript, caché de manifiestos y chunks | Correctos, comprobador final exit 0 |
| Acceso y HTTPS | Sin SSO/contraseña, HTTP redirige 301 a HTTPS, TLS validado por Chrome sin omitir errores |
| URL deliberadamente inexistente | HTTP 404 correcto; ningún activo usado por la app devuelve 404 |

Durante el build, Next notificó un primer timeout de 60 s en la generación estática de cuatro páginas y reintentó automáticamente. Completó las cuatro en 73 s; compilación 3,6 s. No se ha cambiado la aplicación ni elevado el timeout para ocultarlo. El paquete final está completo; queda como advertencia de reproducibilidad del entorno local, no como fallo de una página publicada.

Evidencias: antivirus (local-only evidence retained outside the public source), pruebas rutas (local-only evidence retained outside the public source), pruebas interfaz (local-only evidence retained outside the public source), pytest JUnit (local-only evidence retained outside the public source), [routing JSON](routing-validation/vitest.json), [interfaz JSON](interface-validation/vitest.json), [hashes NASA](routing-validation/final-checks.json), [hashes científicos](science-validation/final-checks.json).

## Publicación realizada e incidencias resueltas

El conector Netlify solicitó autenticación repetidamente sin devolver equipos utilizables. No se ha creado ni modificado ningún proyecto por ese medio. Se preparó la CLI oficial aislada; no se instaló globalmente ni se modificó el lock de la aplicación. `.netlify/` queda excluida del control de versiones.

La autorización OAuth se completó mediante `netlify login --request`/`--check`; la CLI confirmó `authorized` a las 10:35:56 de Madrid. No se pidieron contraseñas ni tokens por chat. Se consultó el único equipo disponible, `edumanzalc`, que la API identificó como **Free**. Se creó y vinculó el proyecto nuevo; no se reutilizó ni modificó otro proyecto. Se subió únicamente `out/`, sin build remoto ni servicios de pago. `requiredFunctions` está vacío en el deploy y no se configuraron funciones de servidor.

Incidencias y resolución:

1. El ticket de acceso antiguo siguió en `pending`; la CLI confirmó que no existía sesión. Un enlace nuevo completó el acceso. Estado final sin credenciales (local-only evidence retained outside the public source).
2. El proyecto nuevo nació privado con `sso_login: true`. Se cambió **solo ese proyecto** a `sso_login: false`, sin contraseña. Una primera petición combinada que también incluía contraseña vacía y `force_ssl` fue rechazada con HTTP 422; la petición mínima de SSO pasó. No se atribuye una causa concreta al 422. El HTTPS efectivo se comprobó después mediante navegación y redirección HTTP. Acceso (local-only evidence retained outside the public source), [configuración final](deployment-validation/site.json).
3. Netlify inyectaba su insignia opcional y un comentario HTML. La insignia tapaba métricas en móvil/perfil en escritorio y provocó el fallo del primer cotejo byte a byte. Se desactivó `built_with_badge_enabled` únicamente en este proyecto, sin cambiar el plan, y se repitieron ambos flujos completos. Cambio confirmado (local-only evidence retained outside the public source), captura previa con solapamiento (local-only evidence retained outside the public source), registro previo (local-only evidence retained outside the public source).
4. Permanece un comentario HTML invisible de 326 bytes insertado por el hosting. El verificador permite **solo su cadena exacta, una vez y con el ID de este proyecto**, y exige que el resto del HTML sea idéntico. No elimina etiquetas, scripts ni comentarios arbitrarios. Cada archivo conserva hashes del contenido recibido y canónico. Los datos científicos, workers, JavaScript, CSS, fuentes e imágenes siguen sujetos a igualdad íntegra de bytes. No se afirma que los 66 cuerpos HTTP sean idénticos sin esa salvedad.
5. El host de control visual del navegador no estaba disponible. La validación real se ejecutó con Chrome/Playwright instalado y capturas del navegador; no se sustituyó por comprobaciones HTTP únicamente.

Referencias oficiales consultadas: [CLI deploy](https://cli.netlify.com/commands/deploy/), [CLI login](https://cli.netlify.com/commands/login/), [insignia opcional y configuración por proyecto](https://docs.netlify.com/manage/projects/powered-by-netlify-badge/), [visibilidad](https://docs.netlify.com/manage/security/secure-access-to-sites/project-visibility/). Se contrastó la exportación con la documentación de la versión Next instalada: `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`.

## Validación de producción y rendimiento

El guion `scripts/audit/browser-audit.ts` abrió contextos privados nuevos, sin credenciales ni caché de navegador, en 1440 × 900 y 390 × 844. Se bloquearon solicitudes fuera del origen público: ninguna funcionalidad del flujo necesitó servicios externos. No se vació la caché CDN de Netlify ni se presenta como ensayo de un móvil físico.

En ambas sesiones se comprobaron: mapa HiRISE; las cuatro bases Ortoimagen/Relieve/Elevación/Pendiente; geología activada/desactivada, seis geometrías y leyenda; selección de M1, M2 y M3; uso de M3 como destino y origen mediante clic real; cálculo A/B en workers; comparación de métricas y perfil; dos imágenes auténticas con créditos y documentación RMC; procedencia, incertidumbre geológica y limitación EVA; descarga JSON A y B. Las celdas y métricas exportadas coinciden exactamente con una ejecución local del motor sobre los mismos binarios, y la auditoría independiente de cada arista pasa. Se verificó también ausencia de desbordamiento horizontal y fichas dentro del viewport.

| Medición real | Escritorio 1440 × 900 | Móvil 390 × 844 |
|---|---:|---:|
| Navegación → mapa y ciencia disponibles | 1162,1 ms | 1790,5 ms |
| Solicitud de ambas rutas → UI completa | 168,2 ms | 323,8 ms |
| Cálculo worker A | 24,6 ms | 26,0 ms |
| Cálculo worker B | 58,3 ms | 54,1 ms |
| Cuerpo inicial decodificado | 2.896.642 bytes | 2.896.642 bytes |

Los tiempos dependen del equipo, red y CDN; no son garantías globales. El volumen inicial indicado corresponde a cuerpos decodificados, no a transferencia comprimida. Los encabezados muestran Brotli donde aplica; tamaños y duraciones de transferencia observados por Chrome están en `resourceTiming` del informe. El paquete local completo ocupa 6.115.416 bytes.

La prueba interactiva usa origen **celda (59,302)** y destino **M3 (334,233)**, en la malla 394 × 356 de 10 m, límite 15°, lambda A=0/B=4. Es distinta del destino del botón «Usar ejemplo validado»; por eso no se confunden estos valores con el ejemplo de la validación anterior.

| Resultado exportado | Ruta A | Ruta B |
|---|---:|---:|
| Longitud horizontal | 3035,807 m | 3118,650 m |
| Longitud aproximada sobre terreno | 3038,974 m | 3120,959 m |
| Ascenso / descenso | 36,391 / 64,307 m | 31,878 / 59,794 m |
| Desnivel neto | −27,916 m | −27,916 m |
| Pendiente máxima | 14,536° | 9,019° |
| Coste del algoritmo | 3035,807 | 4487,521 |
| Celdas exploradas | 17.569 | 50.939 |

Exposición por intervalos, parámetros, CRS marciano, versión de datos y hashes completos constan en cada exportación. [JSON A escritorio](deployment-validation/1440-production-route-a.json), [JSON B escritorio](deployment-validation/1440-production-route-b.json), [JSON A móvil](deployment-validation/390-production-route-a.json), [JSON B móvil](deployment-validation/390-production-route-b.json).

[Informe completo del navegador](deployment-validation/browser-audit.json), registro final (local-only evidence retained outside the public source), [inspección HTTP](deployment-validation/http-inspection.json), [comprobador final aprobado](deployment-validation/final-checks.json). Los 66 activos previstos dieron HTTP 200; una URL inventada deliberadamente dio el 404 correcto. El worker y chunks se sirven como JavaScript, los manifiestos requieren revalidación y los chunks tienen caché inmutable.

Capturas reales de la URL HTTPS final, sin la insignia superpuesta:

| Evidencia | Captura |
|---|---|
| Mapa orbital, rutas A/B y métricas | [Escritorio](deployment-validation/1440-production-routes.png) |
| Interfaz y recorridos móviles | [Móvil](deployment-validation/390-production-routes.png) |
| Objetivo M3 y acción de destino | [Ficha](deployment-validation/390-production-objective.png) |
| Geología publicada y desfase 100–200 m | [Geología](deployment-validation/390-production-geology.png) |
| Foto auténtica de sol 107 y posición del rover | [Perseverance](deployment-validation/390-production-perseverance.png) |
| Fuentes y atribuciones | [Créditos](deployment-validation/390-production-credits.png) |

El guion adaptado se ejecutó adicionalmente sobre `out/` por HTTP local en un contexto privado Chrome 157, 390 × 844, caché vacía: flujo completo aprobado, 66 archivos servidos con contenido idéntico, cero errores JavaScript/HTTP. Mapa y ciencia disponibles en **520,6 ms**, ambas rutas/UI en **124,1 ms**, resultados JSON comparados con el motor y todas sus aristas auditadas. **Estos tiempos son locales, no de producción.** [Informe](deployment-validation/local/browser-audit.json), [captura móvil real](deployment-validation/local/390-loopback-routes.png), [JSON A](deployment-validation/local/390-loopback-route-a.json), [JSON B](deployment-validation/local/390-loopback-route-b.json).

## Respaldo local

Se conserva la instantánea previa `.cache/releases/mars-pathfinder-20261115T064337Z.zip` y se genera otra con el código, documentos, datos preparados, `out/` y evidencias finales. Ubicación, inventario, SHA-256 y CRC del respaldo más reciente (local-only evidence retained outside the public source). El script reproducible es `scripts/audit/backup-release.py`. Se excluyen originales NASA/USGS, cachés, entornos, `node_modules` y sesión Netlify. Los originales permanecen intactos en `data/raw/`. Los ZIP son locales, **no se publican** en el hosting.

## Limitaciones y entrega

La licencia de distribución del código propio sigue siendo decisión del equipo; las licencias de terceros y los créditos NASA/USGS están conservados. No se han probado Safari/Firefox ni móviles físicos. Persisten el desfase geológico de 100–200 m, la resolución orbital y la incertidumbre absoluta no publicada de los waypoints. Ninguna ruta certifica seguridad EVA.

No quedan errores funcionales conocidos en los casos comprobados. El primer timeout del build y los límites del entorno Windows están documentados; conservar el paquete probado evita depender de recompilar en directo. El alojamiento Free tiene cuotas: revisar su consumo antes de presentar, sin activar una ampliación de pago automáticamente. No existe integración Git/CD; una edición del código local no actualiza por sí sola la web.

Para la presentación y entrega:

1. Incluir **https://mars-pathfinder-the-meowrtian.netlify.app** como demo en la ficha oficial, y un enlace al código si el equipo decide publicarlo con su licencia.
2. Guion de 2–3 minutos: «Usar ejemplo validado» → «Calcular rutas» → comparar distancia/pendiente; después M3/geología/fotos y descargar JSON. Explicar que la geología tiene 100–200 m de incertidumbre y no bloquea rutas.
3. Conservar `out/`, Node y los datos preparados para `npm start` por HTTP local, más capturas/JSON o un vídeo de respaldo. No abrir con `file://`.
4. Probar una vez en el portátil de presentación y su red. Mantener estable esta versión durante la entrega; no añadir funciones pendientes al final.
5. Completar el envío oficial antes de la fecha límite comunicada por el equipo: **15/11/2026 a las 23:59 de Madrid**. La publicación técnica no equivale al envío de la candidatura; este último debe completarlo el equipo.

## Repetición de las comprobaciones y actualización

Desde la raíz, con la CLI aislada y una sesión Netlify ya autorizada:

```powershell
powershell -NoProfile -File scripts/audit/check-antivirus.ps1
Copy-Item docs/final-audit/antivirus.json docs/deployment-validation/antivirus.json
# Si reviewRequired es true, detener antes de ejecutar herramientas del proyecto.
node scripts/audit/deployment-preflight.mjs
$env:MARS_AUDIT_URL = 'https://mars-pathfinder-the-meowrtian.netlify.app'
$env:MARS_AUDIT_OUTPUT = 'docs/deployment-validation'
node node_modules/tsx/dist/cli.mjs scripts/audit/browser-audit.ts
node scripts/audit/inspect-hosted-files.mjs
node scripts/audit/netlify-metadata.mjs site 89d24aa6-4300-4b08-afcc-84f51da7f164
node scripts/audit/check-deployment.mjs
```

La publicación ejecutada fue:

```powershell
node .tools/netlify-cli/node_modules/netlify-cli/bin/run.js sites:create --name mars-pathfinder-the-meowrtian --account-slug edumanzalc --json
node .tools/netlify-cli/node_modules/netlify-cli/bin/run.js deploy --prod --no-build --dir out --site 89d24aa6-4300-4b08-afcc-84f51da7f164 --message 'Mars Pathfinder 0.1.0 - static release verified 2026-11-15' --json
```

No volver a ejecutar `sites:create` para actualizar esta aplicación. Para una actualización futura, repetir pruebas/build/preflight, publicar al mismo ID con `--no-build --dir out --prod`, guardar el nuevo deploy y volver a validar; los scripts de metadatos verifican el ID de creación antes de cambiar acceso o insignia. Las instrucciones se aportan para reproducibilidad; no se ha programado ninguna publicación automática.
