# Supabase — WiViFit

## 1. Crear el proyecto

En Supabase crea un proyecto nuevo y conserva:

- Project URL
- Publishable/anon key

No uses la service-role key en la app.

## 2. Aplicar el esquema

En el SQL Editor ejecuta el contenido de:

`supabase/migrations/0001_wivifit.sql`

La migración crea las seis tablas de Fase 2, índices, triggers de `updated_at` y RLS por `auth.uid()`.

## 3. Configurar la app

Copia `.env.example` a `.env.local` y reemplaza los valores:

```text
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable-or-anon-key>
```

Reinicia Expo después de cambiar el archivo de entorno. La app funciona en modo local/offline si esas variables no existen.

## 4. Probar RLS

Con dos usuarios distintos verifica en el Table Editor o SQL Editor que cada usuario solo puede leer y modificar sus propias filas. La app nunca recibe la service-role key.
