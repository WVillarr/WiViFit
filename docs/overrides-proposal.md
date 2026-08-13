# Propuesta de overrides — 138 filas de catalog-review.csv

Generado a partir de las instrucciones reales de cada ejercicio (no solo el nombre). **52 de las 138 filas** reciben una corrección; las otras **86** se revisaron y la clasificación de la regla ya es razonable — quedan con confianza baja pero sin override, así que van a seguir apareciendo en `catalog-review.csv` en cada rebuild (es lo esperado: el archivo señala incertidumbre, no error).

Los overrides solo tocan `movementPattern` y/o `trackingType`. `compound`, `difficulty` y `avgSecondsPerRep` se re-derivan automáticamente a partir del patrón/tracking efectivo — ver la tarea "Fix derived-field bug in enrichment overrides".

## Estiramientos estáticos marcados como reps (28)

La instrucción dice explícitamente "hold for 15-30 seconds" o describe una postura sostenida (yoga, foam roller, elongación). No hay repetición real: cada aparición es un mantenimiento de posición.

| id | nombre | la regla dijo | propuesto |
|---|---|---|---|
| 1512 | all fours squad stretch | knee_dominant/reps | isolation/time |
| 1713 | assisted prone lying quads stretch | knee_dominant/reps | isolation/time |
| 1548 | chair leg extended stretch | knee_dominant/reps | isolation/time |
| 1564 | intermediate hip flexor and quad stretch | knee_dominant/reps | isolation/time |
| 0613 | lying (side) quads stretch | knee_dominant/reps | isolation/time |
| 1709 | assisted lying glutes stretch | hip_dominant/reps | isolation/time |
| 1710 | assisted lying gluteus and piriformis stretch | hip_dominant/reps | isolation/time |
| 1559 | exercise ball hip flexor stretch | hip_dominant/reps | isolation/time |
| 1560 | exercise ball seated hamstring stretch | hip_dominant/reps | isolation/time |
| 1511 | hamstring stretch | hip_dominant/reps | isolation/time |
| 1419 | iron cross stretch | hip_dominant/reps | isolation/time |
| 1576 | leg up hamstring stretch | hip_dominant/reps | isolation/time |
| 1582 | reclining big toe pose with rope | hip_dominant/reps | isolation/time |
| 2208 | roller back stretch | hip_dominant/reps | isolation/time |
| 2205 | roller hip lat stretch | hip_dominant/reps | isolation/time |
| 2202 | roller hip stretch | hip_dominant/reps | isolation/time |
| 1585 | runners stretch | hip_dominant/reps | isolation/time |
| 1424 | seated glute stretch | hip_dominant/reps | isolation/time |
| 2567 | seated piriformis stretch | hip_dominant/reps | isolation/time |
| 1587 | seated wide angle pose sequence | hip_dominant/reps | isolation/time |
| 1362 | sphinx | hip_dominant/reps | isolation/time |
| 1363 | spine stretch | hip_dominant/reps | isolation/time |
| 1599 | standing hamstring and calf stretch with strap | hip_dominant/reps | isolation/time |
| 1364 | standing pelvic tilt | hip_dominant/reps | isolation/time |
| 1366 | upward facing dog | hip_dominant/reps | isolation/time |
| 1403 | neck side stretch | isolation/reps | isolation/time |
| 0716 | side push neck stretch | isolation/reps | isolation/time |
| 1338 | exercise ball hug | hip_dominant/reps | isolation/time |

## Toques de punta de pie ("toe touch") (5)

Movimiento dinámico de flexibilidad/movilidad, sin carga ni patrón de bisagra de cadera cargada. No encaja en hip_dominant (que se reserva para movimientos de fuerza con resistencia).

| id | nombre | la regla dijo | propuesto |
|---|---|---|---|
| 3214 | arms apart circular toe touch (male) | hip_dominant/reps | isolation/reps |
| 3212 | basic toe touch (male) | hip_dominant/reps | isolation/reps |
| 3218 | hands clasped circular toe touch (male) | hip_dominant/reps | isolation/reps |
| 3215 | hands reversed clasped circular toe touch (male) | hip_dominant/reps | isolation/reps |
| 3231 | two toe touch (male) | hip_dominant/reps | isolation/reps |

## Rotaciones y accesorios de cadera/core (10)

Movimientos de movilidad rotacional o accesorios de aislamiento (abductor de cadera, rotación de tronco), no bisagras de cadera cargadas.

| id | nombre | la regla dijo | propuesto |
|---|---|---|---|
| 0984 | band lying hip internal rotation | hip_dominant/reps | isolation/reps |
| 0996 | band seated hip internal rotation | hip_dominant/reps | isolation/reps |
| 1416 | exercise ball one leg prone lower body rotation | hip_dominant/reps | isolation/reps |
| 0459 | flutter kicks | hip_dominant/reps | isolation/reps |
| 3639 | bent knee lying twist (male) | hip_dominant/reps | isolation/reps |
| 0628 | monster walk | hip_dominant/reps | isolation/reps |
| 0778 | spider crawl push up | hip_dominant/reps | isolation/reps |
| 3433 | swimmer kicks v. 2 (male) | hip_dominant/reps | isolation/reps |
| 2571 | rocking frog stretch | hip_dominant/reps | isolation/reps |
| 1423 | reverse hyper on flat bench | hip_dominant/reps | isolation/reps |

## Correcciones de patrón dominante (5)

La regla clasificó el hinge/squat en la dirección equivocada según la biomecánica real del movimiento descrito.

| id | nombre | la regla dijo | propuesto |
|---|---|---|---|
| 0028 | barbell clean and press | knee_dominant/reps | hip_dominant/reps |
| 0776 | snatch pull | knee_dominant/reps | hip_dominant/reps |
| 1418 | hug keens to chest | hip_dominant/reps | knee_dominant/reps |
| 0624 | march sit (wall) | hip_dominant/reps | knee_dominant/reps |
| 0740 | sled 45в° leg wide press | hip_dominant/reps | knee_dominant/reps |

## Correcciones de tipo de seguimiento (4)

El ejercicio se mide por tiempo o distancia, no por repeticiones — la instrucción lo dice explícitamente.

| id | nombre | la regla dijo | propuesto |
|---|---|---|---|
| 2133 | farmers walk | knee_dominant/reps | isolation/distance |
| 0020 | balance board | knee_dominant/reps | isolation/time |
| 0535 | kettlebell hang clean | hip_dominant/time | hip_dominant/reps |
| 3552 | quick feet v. 2 | knee_dominant/reps | knee_dominant/time |

## Filas revisadas sin cambio (86)

La regla ya clasifica correctamente estos ejercicios pese a la confianza baja — en su mayoría bisagras de cadera con carga (clean, snatch, kettlebell swing, hip thrust, pull-through), sentadillas y saltos pliométricos, y cardio (burpees, carreras, elípticas) donde `isolation` es el catch-all correcto que ya usa el resto del catálogo. No se tocan.

