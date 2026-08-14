# Nombres en español — estado del traductor

`scripts/exercise-names-es.ts` traduce nombres por reglas (equipo/movimiento/modificadores), sin API externa. Una fila solo se traduce si **todos** sus tokens resuelven — un nombre a medias es peor que dejarlo en inglés.

## Lo que se corrigió esta pasada (61,6% → 80,1% de cobertura, 1324 filas)

Dos bugs estructurales reales, verificados contra el dataset completo antes y después del arreglo:

1. **Paréntesis pegados a la palabra** (`"(male)"` nunca calzaba con la entrada `male`). 143 de 1324 nombres tienen paréntesis — era la causa individual más grande de tokens sin resolver.
2. **Preposición huérfana antes de una frase de equipo no capturada**: `"fly on exercise ball"` dejaba "on" traducido como un "en" suelto, sin nada después, porque solo se levantaba "exercise ball" y no la preposición que la precede. Ejemplo real, antes/después:
   - Antes: *"Inclinado a una mano apertura **en** con fitball con mancuernas"*
   - Después: *"Inclinado a una mano apertura con fitball con mancuernas"*
3. Efecto lateral menor: 4 nombres traían el símbolo de grado mal codificado (`"45в°"` en vez de `"45°"`) — normalizado también.

Sobre esa base ya arreglada, se agregaron ~75 entradas de vocabulario al diccionario existente (`WORDS`/`PHRASES`/`EQUIPMENT_PHRASES`) — cada una verificada contra los nombres reales que la usan, no adivinada. Cubren: preposiciones (`off`, `around`, `into`, `above`, `across`), calificadores comunes (`advanced`, `basic`, `modified`, `fixed`), términos anatómicos (`pronation`, `supination`, `abductor`, `adductor`, `deltoid`), un puñado de epónimos (`Zottman`, siguiendo la misma convención ya usada para `Scott`/`Arnold`/`Gironda`), y frases de equipo que faltaban (`ez bar`, `wheel rollerout`). Quedan documentadas inline en el archivo, junto al resto del diccionario.

8 tests de regresión nuevos en `scripts/exercise-names-es.test.ts` cubren los dos bugs, la normalización de paréntesis/codificación, y el contrato "todo o nada" del traductor.

## Limitación conocida que **no** se tocó: orden de palabras

El inglés antepone el modificador ("chest dip"); el español antepone el movimiento ("fondo de pecho"). El motor es composicional y preserva el orden original salvo para el equipo (que siempre va al final) y las frases explícitas en `PHRASES` (que ya tienen el orden correcto grabado, ej. `"bench press"` → `"press de banca"`). Para todo lo demás, el resultado es gramaticalmente entendible pero no siempre natural:

- `"chest dip"` → *"De pecho fondo"* (debería ser "Fondo de pecho")
- `"alternate lateral pulldown"` → *"Alterno lateral jalón"* (debería ser "Jalón lateral alterno")

Arreglarlo en general significaría reescribir el ensamblador para reordenar por categoría gramatical (movimiento primero, modificadores después) — un cambio de arquitectura, no una corrección puntual, con riesgo real de romper los cientos de nombres que hoy ya salen bien. Se deja fuera de esta pasada a propósito. La vía segura para casos puntuales que se noten mal es agregar la frase completa a `PHRASES` (como ya existe para `"triceps dip"` → `"fondo de tríceps"`), una por una, cuando se confirme que vale la pena.

## Lo que queda sin resolver: 264 de 1324 (20%)

`data/name-overrides.json` sigue en `{}` — **no se propone ninguna traducción forzada** para estas filas. Se probó cada patrón candidato contra los nombres reales antes de escribir nada; lo que queda ya no tiene arreglo mecánico seguro. Tres grupos:

**Epónimos y jerga de aparatos** (~40): `Pallof press`, `Bradford press`, `Pendlay row`, `Jefferson squat`, `JM bench press`, `Tate press`, `Svend press`, `Janda sit-up`, `Thibaudeau kayak row`. Nombres propios de quien inventó o popularizó el ejercicio — en el gimnasio en español muchas veces se usan tal cual, sin traducir (igual que "deadlift" convive con "peso muerto"). Decisión de estilo, no de vocabulario.

**Apodos coloquiales sin equivalente fijo** (~35): `Otis up`, `Spell caster`, `Sphinx`, `Cocoons`, `Elevator`, `Flag`, `Inchworm`, `London bridge`, `Skin the cat`, `Frankenstein squat`, `Monster walk`. Cada uno necesitaría una traducción creada a mano, no derivada de reglas — es exactamente el tipo de fila que este mecanismo está diseñado para dejar pasar en vez de forzar.

**Palabras ambiguas según contexto** (~15): `sit` significa cosas distintas en `"v sit on bosu ball"`, `"kick out sit"` y `"march sit (wall)"` — una sola entrada de diccionario habría traducido mal al menos dos de los tres. Mismo problema con `self` (`"self assisted..."`) y `chin` (que en estos nombres es forma corta de `chin-up`, no la palabra "barbilla").

El resto son términos médicos/latinos poco frecuentes (`rectus femoris`, `posterior tibialis`, `peroneals`) donde una traducción literal es fácil pero cada uno aparece 1–2 veces — no valen una entrada de diccionario permanente; son candidatas naturales para `data/name-overrides.json` si en algún momento se revisan una por una.

## Recomendación

Cerrar esta pasada acá. Los usuarios en español ven español correcto en el 80% del catálogo y el 20% restante cae en inglés de forma consistente (nunca a medias — el propio diseño del archivo lo garantiza). Revisar el resto fila por fila cuando haga falta, vía `data/name-overrides.json`, con el mismo criterio que `data/overrides.json` para enriquecimiento: valor real de traducirlo vs. tiempo, no una meta de cobertura.
