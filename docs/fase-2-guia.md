# Guía de implementación — Fase 2: Entrenar y registrar

> **Al terminar tienes:** creas una rutina a mano, entras en modo entrenamiento, registras series con peso/reps (o tiempo, si el ejercicio lo pide), usas el cronómetro de descanso, y ves tu historial y tus récords. **Un entrenamiento completo de 45 minutos en modo avión no pierde ni un dato.**

Este documento parte del código real ya en el repo (Fase 1 completa: catálogo, mapa corporal, `user.db` con `favorites`/`recentlyViewed` vía Drizzle). No repite lo que ya existe — dice exactamente qué se reutiliza y qué es nuevo.

---

## 0. Qué ya existe y se reutiliza tal cual

| Pieza | Archivo | Por qué importa para la Fase 2 |
|---|---|---|
| `useUserDb()` / `USER_DB_NAME` | [src/db/user-client.ts](../src/db/user-client.ts) | Abre `user.db`, corre el `CREATE TABLE IF NOT EXISTS`, devuelve un cliente Drizzle. Las tablas nuevas de esta fase se agregan a `SCHEMA_SQL` y a `user-schema.ts`, no se crea un cliente aparte. |
| `favorites` / `recentlyViewed` | [src/db/user-schema.ts](../src/db/user-schema.ts) | Patrón a copiar: tabla Drizzle + comentario explicando el porqué, no el qué. |
| `MovementPattern` / `TrackingType` / `Difficulty` | [src/db/enrichment-types.ts](../src/db/enrichment-types.ts) | El generador y el modo entrenamiento leen `exercises.trackingType` (`'reps' | 'time' | 'distance'`) para decidir qué UI de registro mostrar, y `movementPattern` para el motor de rutinas de la Fase 3. |
| `exercises`, `exerciseSecondaryMuscles` | [src/db/catalog-schema.ts](../src/db/catalog-schema.ts) | Fuente de verdad de sólo lectura; las tablas nuevas de `user.db` referencian `exercises.id` por `text`, no por FK real (son bases de datos distintas — ver §1). |
| `ExerciseAnatomy`, `PressableScale`, `ThemedText`/`ThemedView` | `src/components/` | Vocabulario visual ya establecido; las pantallas nuevas los reutilizan en vez de inventar variantes. |
| `useTranslation()` / `t()` | [src/i18n/use-translation.ts](../src/i18n/use-translation.ts) | Todo string nuevo va a `src/i18n/index.ts` bajo una clave `workout.*` / `routine.*`, igual que `exercise.*` ya existente. |

Lo que **no** existe todavía y es el trabajo real de esta fase: cuenta de usuario, tablas de rutina/sesión, `src/sync/`, y las pantallas de crear rutina + modo entrenamiento.

---

## 1. Por qué las tablas nuevas van en `user.db`, no en `catalog.db`

`catalog.db` se reemplaza entero en cada build (`scripts/build-catalog.ts` lo reconstruye desde cero). Si `routines`/`workout_sessions` vivieran ahí, cada actualización de la app **borraría el historial de entrenamientos**. Van a `user-schema.ts`, en el mismo archivo físico que `favorites`.

Cuando una consulta necesita cruzar ambas bases (ej. "mis PRs, con el nombre del ejercicio del catálogo"), no se hace JOIN de Drizzle entre dos clientes — se usa `ATTACH DATABASE` de SQLite, tal como ya lo documenta el comentario en `user-client.ts`. Patrón:

```sql
ATTACH DATABASE '<ruta catalog.db>' AS catalog;
SELECT pr.*, catalog.exercises.name_es
FROM personal_records pr
JOIN catalog.exercises ON catalog.exercises.id = pr.exercise_id;
```

Esto significa que `exerciseId` en las tablas nuevas es `text` suelto (el mismo `id` de `exercises`, ej. `"0props1"`), **sin** `.references()` de Drizzle — no hay FK real entre archivos distintos, y forzarlo con Drizzle daría una relación que no se puede validar.

---

## 2. Esquema — extender `user-schema.ts`

Todas las tablas siguen el estilo ya establecido: `sqliteTable`, comentario que explica la decisión no obvia, no el campo obvio.

```ts
// --- Rutinas: la plantilla ---
export const routines = sqliteTable('routines', {
  id: text('id').primaryKey(),           // UUID generado en el cliente — ver §4
  name: text('name').notNull(),
  splitType: text('split_type'),         // 'full_body' | 'upper_lower' | 'push_pull_legs' | null (manual)
  daysPerWeek: integer('days_per_week').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  source: text('source').notNull(),      // 'manual' | 'generated' (Fase 3)
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),         // lápida — ver §5, nunca DELETE real
});

export const routineDays = sqliteTable('routine_days', {
  id: text('id').primaryKey(),
  routineId: text('routine_id').notNull(),
  dayIndex: integer('day_index').notNull(),   // 0-6
  name: text('name').notNull(),               // "Empuje", "Piernas"...
  budgetMinutes: integer('budget_minutes'),    // presupuesto de tiempo del día — alimenta la Fase 3
});

export const routineExercises = sqliteTable('routine_exercises', {
  id: text('id').primaryKey(),
  routineDayId: text('routine_day_id').notNull(),
  exerciseId: text('exercise_id').notNull(),   // FK lógica a catalog.exercises.id, no real (ver §1)
  orderIndex: integer('order_index').notNull(),
  targetSets: integer('target_sets').notNull(),
  repRangeMin: integer('rep_range_min'),
  repRangeMax: integer('rep_range_max'),
  targetDurationSeconds: integer('target_duration_seconds'), // para trackingType 'time'
  restSeconds: integer('rest_seconds').notNull(),
});

// --- Sesiones: lo que de verdad pasó ---
// Separada de `routines` a propósito: si se mezclan, editar la rutina
// reescribe el historial y se pierde la medición de progreso.
export const workoutSessions = sqliteTable('workout_sessions', {
  id: text('id').primaryKey(),
  routineDayId: text('routine_day_id'),   // null si el entrenamiento fue libre
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  totalVolumeKg: real('total_volume_kg'),
});

export const sessionSets = sqliteTable('session_sets', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  exerciseId: text('exercise_id').notNull(),
  setIndex: integer('set_index').notNull(),
  weightKg: real('weight_kg'),
  reps: integer('reps'),
  durationSeconds: integer('duration_seconds'),  // set por tiempo (plancha, isométricos)
  distanceMeters: real('distance_meters'),        // cardio
  isWarmup: integer('is_warmup', { mode: 'boolean' }).notNull().default(false),
  completedAt: text('completed_at').notNull(),
});

export const personalRecords = sqliteTable('personal_records', {
  id: text('id').primaryKey(),
  exerciseId: text('exercise_id').notNull(),
  type: text('type').notNull(),   // 'estimated_1rm' | 'volume' | 'reps'
  value: real('value').notNull(),
  achievedAt: text('achieved_at').notNull(),
  sessionSetId: text('session_set_id').notNull(),
});
```

`weightKg`/`reps`/`durationSeconds`/`distanceMeters` son todos nullable a propósito: qué campos se llenan depende de `exercises.trackingType` (ver §3). No se crea una tabla por tipo de tracking — sería normalización sin beneficio real para 3 variantes.

Agregar el `CREATE TABLE IF NOT EXISTS` correspondiente a `SCHEMA_SQL` en `user-client.ts`, mismo patrón que `favorites`/`recentlyViewed`. Índices mínimos: `session_sets(session_id)`, `personal_records(exercise_id, type)`.

---

## 3. UI de registro según `trackingType`

`exercises.trackingType` (de la Fase 1) decide qué componente de entrada se muestra en modo entrenamiento — no hay una sola UI de "peso × reps" para todo:

| `trackingType` | Ejemplo | Entrada |
|---|---|---|
| `'reps'` | press banca | teclado numérico: peso + repeticiones |
| `'time'` | plancha | cronómetro en cuenta atrás/adelante, sin peso |
| `'distance'` | carrera en cinta | cronómetro + distancia |

`routineExercises.repRangeMin/Max` vs. `targetDurationSeconds` reflejan la misma bifurcación en la plantilla. El creador de rutinas (§6) debe leer `trackingType` del ejercicio elegido para saber cuál de los dos mostrar — es un error mostrar rango de reps a una plancha.

---

## 4. IDs generados en el cliente

Todas las tablas nuevas usan `id: text().primaryKey()` con un **UUID generado en el dispositivo** (`expo-crypto`'s `randomUUID()` o equivalente), nunca autoincrement. Es lo que permite crear una rutina o registrar una serie sin conexión: si el ID lo asignara el servidor, no se podría escribir nada offline. Esto también es lo que hace posible el outbox del §5 — dos dispositivos pueden crear filas con IDs que nunca van a colisionar.

---

## 5. `src/sync/` — el outbox

Nuevo módulo. Principio: **SQLite es la fuente de verdad; Supabase es el respaldo.** La UI nunca espera a la red.

- `outbox` table (en `user.db`, junto a las demás): `id`, `table_name`, `row_id`, `operation` (`insert`|`update`|`delete`), `payload_json`, `created_at`, `synced_at`.
- Cada mutación a `routines`/`workout_sessions`/`session_sets`/etc. escribe local **y** encola una fila de outbox en la misma transacción.
- Un worker (interval + `NetInfo` listener) drena el outbox cuando hay red: envía en orden, reintentos con backoff exponencial, marca `synced_at` al confirmar.
- **Borrado = lápida**, nunca `DELETE` real: `deletedAt` en vez de borrar la fila. Un borrado offline no tiene forma de anunciarse al servidor si la fila ya no existe para encolarlo.
- Resolución de conflictos: last-write-wins por fila usando `updatedAt`. Si en el futuro hace falta algo más fino (entrenadores editando en paralelo), la ruta de escape documentada en el plan es [PowerSync sobre Supabase](https://docs.powersync.com/integrations/supabase/guide) — no se construye antes de necesitarlo.

**Prueba obligatoria de esta fase**, tal como la marca el plan: modo avión → entrenamiento completo → cerrar la app por completo (no minimizar) → reabrir → reconectar. Cero series perdidas, cero duplicados. Repetir 3 veces.

---

## 6. Autenticación

Todavía no hay Supabase en el proyecto (`package.json` no lo tiene). Es trabajo nuevo de esta fase:

1. `npx expo install @supabase/supabase-js` + proyecto en Supabase.
2. Auth por email/magic-link o Apple/Google Sign-In (a decidir con el usuario si no está ya decidido en el plan general).
3. **RLS activo desde el primer día**, no como parche final: cada tabla en Supabase con `auth.uid() = user_id`.
4. El outbox no envía nada hasta que hay sesión — antes de eso, todo vive solo local (igual que hoy `favorites`).

---

## 7. Pantallas nuevas

```
src/app/
├── routine/
│   ├── new.tsx           # creador de rutina manual
│   └── [id]/edit.tsx
└── workout/
    └── [sessionId].tsx   # modo entrenamiento, pantalla completa
```

**Creador de rutina** (`routine/new.tsx`): días, ejercicios (reutiliza el buscador/mapa corporal de `exercises.tsx` para elegir), series objetivo, rango de reps o duración según `trackingType`, descanso por ejercicio con default sensato (2-3 min compuestos, 60-90 s accesorios).

**Modo entrenamiento** (`workout/[sessionId].tsx`) — la pantalla más importante del producto, se usa con una mano, sudado, con prisa:
- Serie actual en grande; peso/reps de la última vez precargados como sugerencia (query a `sessionSets` del mismo `exerciseId`, sesión anterior).
- Un toque para "igual que la vez pasada"; edición inline si cambia.
- Resumen al terminar: volumen total, PRs nuevos, logros (placeholder hasta Fase 5).

**Detalle del cronómetro de descanso** — la parte que suele salir mal: un `setInterval` de JS se congela cuando la pantalla se bloquea o cambias de app. **No se cuenta hacia atrás con un contador.** Se guarda `restEndsAt` (timestamp absoluto) y se calcula `restEndsAt - Date.now()` cada vez que la UI necesita mostrar el tiempo restante — así sobrevive a que el JS se pause. Respaldo: una notificación local (`expo-notifications`) programada para `restEndsAt` en el momento en que arranca el descanso, por si el usuario no vuelve a mirar la pantalla.

---

## 8. Detección de PRs

Al cerrar cada serie (`trackingType: 'reps'`), calcular 1RM estimado (Epley: `peso × (1 + reps/30)`) y comparar contra el mejor `personalRecords` existente para ese `exerciseId` + `type: 'estimated_1rm'`. Igual para volumen (`peso × reps` sumado en la sesión) y reps a un peso dado. Insertar solo si supera el récord anterior — no se recalculan históricos retroactivamente en esta fase.

---

## Criterios de aceptación

- El ciclo offline del §5 pasa limpio 3 veces seguidas.
- El cronómetro de descanso no se desfasa tras 5 minutos con la app en segundo plano.
- Los PRs detectados coinciden con el cálculo manual sobre el historial.
- Una serie de plancha (`trackingType: 'time'`) y una de press banca (`trackingType: 'reps'`) se registran cada una con su UI correcta y quedan bien guardadas.
- Dos dispositivos con la misma cuenta, edición cruzada sin red, reconexión de ambos → convergen sin duplicados.
- Todas las tablas de usuario en Supabase tienen RLS verificado (un usuario no puede leer filas de otro, probado explícitamente).
