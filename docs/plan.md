# Plan de fases — WiViFit

**Nota de procedencia:** este documento no existía en el repo hasta ahora, pese a que seis comentarios de código ya lo citaban como si estuviera acá (`build-catalog.ts`, `enrichment.ts`, `catalog-schema.ts`, `use-gif-prefetch.ts`, `media-provider.ts`, `user-client.ts`). El plan original de 8 fases vivió solo en el transcript de una sesión de chat anterior. Reconstruyo acá **únicamente lo que tiene evidencia real** en el código o en `docs/fase-2-guia.md` — donde no hay evidencia, lo digo explícitamente en vez de inventar contenido con apariencia de autoridad.

---

## Fase 1 — Cimientos y catálogo de ejercicios

**Estado: completa.**

Un catálogo de 1.324 ejercicios, buscable y filtrable, que funciona sin conexión y sin cuenta.

### Criterios de aceptación (verbatim, del plan aprobado en esta sesión)

- `catalog.db` tiene exactamente 1.324 filas, sin `media_id` nulo, sin `movement_pattern`/`tracking_type` sin asignar.
- Reconstruir el pipeline desde cero reproduce el mismo `catalog.db`, overrides incluidos.
- Búsqueda FTS5 responde en <50 ms mientras se escribe; scroll de la lista completa a 60 fps; arranque en frío <2 s.
- Modo avión en instalación limpia: buscar, filtrar y abrir fichas con miniatura funciona sin haber tenido nunca conexión.

### Bloques nombrados en el código (evidencia real)

- **Bloque C+D** (`scripts/build-catalog.ts`): pipeline de construcción del catálogo — descarga, normalización, enriquecimiento por reglas.
- **Bloque D** (`scripts/enrichment.ts`): clasificación por reglas de `movement_pattern`/`compound`/`difficulty`/`tracking_type`/`avg_seconds_per_rep`.
- **Bloque E** (`src/media/use-gif-prefetch.ts`): estrategia de medios — GIFs de decenas de MB en total, prefetch solo de filas visibles.
- **"Diccionario anatómico"** (`src/i18n/muscle-synonyms.ts`): sinónimos coloquiales en español → slug de músculo, porque el dataset solo trae nombres en inglés.

### Lo que se agregó en esta sesión (más allá del estado original)

- Índice FTS partido en título (`exercises_fts_name`) y prosa (`exercises_fts_prose`), en vez de una sola tabla — arregla el ranking de búsqueda y baja el peso del archivo de 7,25 MB a 2,3 MB.
- Toggle "incluir músculos secundarios" + filtros por patrón de movimiento y dificultad en `exercises.tsx`.
- Traductor de nombres al español (`scripts/exercise-names-es.ts`) con dos bugs estructurales corregidos (paréntesis pegados, preposición huérfana antes de equipo) — cobertura 61,6% → 80,1%. Ver `docs/name-overrides-proposal.md` para lo que queda sin traducir y por qué.
- Guarda de versión (`src/db/catalog-version.ts`, `PRAGMA user_version`) y lock del dataset (`data/dataset.lock.json`) para que la reproducibilidad sea verificable, no solo asumida.

---

## Fase 2 — Entrenar y registrar

**Estado: implementación completa; activación externa pendiente** (rutinas, sesiones, timer, historial, auth REST, outbox transaccional y adaptador Supabase ya aterrizaron en el repo).

Documentado en detalle en **[docs/fase-2-guia.md](fase-2-guia.md)** — no se repite acá. Resumen:

> Al terminar: creás una rutina a mano, entrás en modo entrenamiento, registrás series con peso/reps (o tiempo/distancia, según el ejercicio), usás el cronómetro de descanso, y ves tu historial y tus récords. Un entrenamiento completo de 45 minutos en modo avión no pierde ni un dato.

Piezas nuevas: tablas `routines`/`routine_days`/`routine_exercises`/`workout_sessions`/`session_sets`/`personal_records` en `user.db` (nunca en `catalog.db`, que se reemplaza entero en cada build); IDs generados en el cliente (`expo-crypto`) para poder escribir offline; `src/sync/` con un outbox que encola cada mutación y drena cuando hay red, borrado por lápida (`deletedAt`) en vez de `DELETE` real.

### Criterios de aceptación (verbatim, de `docs/fase-2-guia.md`)

- El ciclo offline (modo avión → entrenamiento completo → cerrar la app del todo → reabrir → reconectar) pasa limpio 3 veces seguidas, cero series perdidas, cero duplicados.
- El cronómetro de descanso no se desfasa tras 5 minutos con la app en segundo plano.
- Los PRs detectados coinciden con el cálculo manual sobre el historial.
- Una serie de plancha (`time`) y una de press banca (`reps`) se registran cada una con su UI correcta.
- Dos dispositivos con la misma cuenta, edición cruzada sin red, reconexión de ambos → convergen sin duplicados.
- Todas las tablas de usuario en Supabase tienen RLS verificado.

### Lo que falta para cerrarla operativamente

- Crear el proyecto Supabase, ejecutar `supabase/schema.sql` y copiar sus credenciales a `.env` a partir de `.env.example`.
- Ejecutar las pruebas de aceptación con dos dispositivos reales; los tests locales cubren la lógica, no el ciclo de vida del sistema operativo ni RLS remoto.

---

## Fase 3 — Generador de rutinas automático

**Estado: no empezada. Reconstruido solo por inferencia** — no hay una spec como la de Fase 2, esto es lo que se puede inferir de columnas y comentarios ya presentes en el esquema:

- `routines.source: 'manual' | 'generated'` y `routines.splitType: 'full_body' | 'upper_lower' | 'push_pull_legs' | null` — el generador produce rutinas con un split reconocido.
- `routineDays.budgetMinutes` — "presupuesto de tiempo del día", el generador ajusta el volumen de la rutina a un tiempo disponible.
- Usa `exercises.movementPattern` como "motor de rutinas" (cita de `docs/fase-2-guia.md`), probablemente para balancear patrones de empuje/tirón/dominante de rodilla/cadera dentro de cada día.
- `scripts/build-catalog.ts` menciona que un dato mal derivado "no se notaría hasta que una rutina saliera mal en Fase 3" — confirma que el generador consume `movementPattern`/`difficulty` directamente.

No hay criterios de aceptación documentados en ningún lado del repo para esta fase.

---

## Fase 5 — Logros

**Estado: no empezada. Evidencia mínima.**

`docs/fase-2-guia.md` menciona "logros (placeholder hasta Fase 5)" en el resumen de fin de entrenamiento, y un comentario en `use-workout-session.ts` dice que `personal_records` es "una historia (Fase 5's achievements..." — sugiere que Fase 5 construye algún sistema de logros/insignias sobre el historial de PRs ya guardado, pero no hay spec.

---

## Fase 8 — Medios con licencia

**Estado: no empezada, deliberadamente diferida.**

De `src/media/media-provider.ts` (verbatim):

> Los 1.324 ejercicios usan medios © Gym visual, redistribuidos en el repo `hasaneyldrm/exercises-dataset` bajo términos que exigen licencia propia antes de salir a producción. Hasta que esa licencia — o un set de medios licenciados/originales — esté lista, `devMediaProvider` es la única implementación: las miniaturas se empaquetan del snapshot del dataset y los GIFs se sirven en caliente desde `raw.githubusercontent.com`.

Cambiar a medios con licencia en Fase 8 significa escribir una nueva implementación de `MediaProvider` y cambiar el único export en `src/media/index.ts` — ningún cambio de pantalla. Esto es también donde se resolvería subir los GIFs a un storage propio (Supabase u otro), que la Fase 1 diseñó explícitamente para diferir hasta acá o hasta que el volumen de Fase 2 lo justifique.

---

## Fases 4, 6, 7

**Sin evidencia.** Ningún comentario de código, ningún archivo en `docs/`, ninguna estructura de datos hace referencia a estas tres fases. No se documentan acá para no fabricar contenido con apariencia de plan real — cuando se retome el plan original (o se defina de nuevo), completar esta sección con lo que corresponda.
