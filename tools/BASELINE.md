# Línea base de rendimiento

Medido en `simbiotikrockband.com` el 5 de septiembre de 2026, **antes** de las
fases 0–3, con `tools/medir-rendimiento.js`.

| Métrica | Antes |
|---|---|
| FPS sostenido | **20.4** |
| Frame p50 / p95 | 50.0 ms / 51.0 ms |
| JS por frame | 1.2 ms (2% del frame) |
| Draw calls por frame | 5 |
| Vértices por frame | ~154 000 |
| TTFB | 248 ms |
| FCP | 1232 ms |
| Load | 1969 ms |
| Transferencia total | 633 KB |
| Petición de `smbtk1.glb` | arranca a los **1960 ms** |
| `Neonblitz.otf` | 118 904 B, **sin comprimir y sin `cache-control`** |
| Ventana de la prueba | 456x716 @ dpr 2 |

## Diagnóstico

El JS ocupaba el 2% del frame: el sitio no estaba limitado por cálculo ni por
peso de descarga, sino por **fill rate y composición**.

Atribución medida ocultando capas en vivo:

| Escenario | FPS |
|---|---|
| Tal cual | 20.6 |
| Sin scanlines, glow y galaxia | 23.1 |
| Además sin componer el canvas de olas | 25.2 |
| Sin componer ninguno de los dos canvas | 34.3 |

Es decir: el coste estaba repartido entre el rasterizado WebGL, la composición
de dos canvas transparentes a pantalla completa y las capas CSS encima.

## Cómo comparar

Correr `tools/medir-rendimiento.js` en la misma ventana y con el mismo tamaño,
en la sección de inicio y sin scrollear durante la medición.


---

# Verificación del build optimizado

Compilado y ejecutado en Chromium headless (render por software, así que los FPS
de aquí no son comparables con una GPU real; lo que se valida es corrección).

| Comprobación | Resultado |
|---|---|
| Errores de JavaScript recorriendo las 9 secciones | **0** |
| Peticiones con error 4xx/5xx | **0** de 9 |
| Secciones que renderizan | 9 de 9 |
| Pistas del reproductor | 11 (3 + 4 + 4) ✓ |
| Paneles de cristal | 23 |
| Archivos en `assets/` | **2** (antes 42) |
| Tres builds seguidos | mismos nombres de archivo — el re-hasheo en cascada está muerto |
| Canvas de olas en la sección inicio | fuera de composición ✓ |
| Fondo de galaxias en reposo | `galaxy-idle` activo ✓ |
| Arranque de `smbtk1.glb` | **328 ms** (antes 1960 ms) |
| Arranque de `Slender_Woman_Lores.glb` | diferido a idle ✓ |

## Hallazgo pendiente, ajeno a la optimización

El terreno wireframe de las secciones Agujero Negro y Memoria Natural **nunca
llega a verse**: su `uOpacity` se queda pegado cerca de 0 (0.000 → 0.009 tras
varios segundos) en lugar de subir a 1 con el fundido de 1.5s. El `gsap.to` de
`showWaterWaves()` no avanza.

Se verificó compilando el código original de `main` y corriendo el mismo
diagnóstico: **da exactamente los mismos valores**. Es un bug previo, no
introducido por las fases 0–3. El efecto está en el código pero el visitante no
lo ve nunca.

Arreglarlo es un cambio de comportamiento visual, no de rendimiento, así que se
deja fuera de este trabajo.
