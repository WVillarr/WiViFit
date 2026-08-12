/**
 * English exercise name → Spanish, by rules.
 *
 * The dataset translates instructions into 10 languages but leaves `name` in
 * English, so a Spanish-speaking user gets an app that is entirely in Spanish
 * except for its actual content. Names are compositional — equipment, movement,
 * position, side — which is what makes them tractable without a translation API.
 *
 * Spanish orders them differently from English: English front-loads the
 * equipment ("dumbbell incline bench press"), Spanish puts the movement first
 * and hangs the equipment off the end ("press de banca inclinado con
 * mancuernas"). So this doesn't translate word by word — it pulls the name
 * apart into equipment / movement / modifiers and re-assembles it.
 *
 * A name is only translated when *every* token resolves. A half-translated name
 * is worse than an English one, so partial matches are dropped and reported in
 * catalog-names-review.csv for data/name-overrides.json to correct — the same
 * re-runnable pattern the enrichment overrides use.
 */

/**
 * Equipment tokens, lifted out of the name and appended as a trailing phrase.
 * Longest key first at match time, so "medicine ball" wins over "ball".
 */
const EQUIPMENT_PHRASES: Record<string, string> = {
  'medicine ball': 'con balón medicinal',
  'stability ball': 'con fitball',
  'exercise ball': 'con fitball',
  'bosu ball': 'en bosu',
  'wheel roller': 'con rueda abdominal',
  'ez barbell': 'con barra Z',
  'ez-barbell': 'con barra Z',
  'olympic barbell': 'con barra olímpica',
  'trap bar': 'con barra hexagonal',
  'smith machine': 'en máquina Smith',
  'sled machine': 'en máquina de trineo',
  'leverage machine': 'en máquina',
  'resistance band': 'con banda elástica',
  'upper body ergometer': 'en ergómetro de brazos',
  'stationary bike': 'en bicicleta estática',
  'elliptical machine': 'en elíptica',
  'stepmill machine': 'en escaladora',
  'skierg machine': 'en máquina SkiErg',
  dumbbell: 'con mancuernas',
  barbell: 'con barra',
  kettlebell: 'con pesa rusa',
  cable: 'en polea',
  band: 'con banda',
  lever: 'en máquina',
  leverage: 'en máquina',
  smith: 'en máquina Smith',
  hammer: 'en máquina Hammer',
  sled: 'en trineo',
  rope: 'con cuerda',
  roller: 'con rueda',
  bosu: 'en bosu',
  towel: 'con toalla',
  suspension: 'en suspensión',
  weighted: 'con peso',
  bodyweight: 'con peso corporal',
  assisted: 'asistido',
};

/**
 * Movements and set phrases. Matched before single tokens and longest-first,
 * because these are the cases word-by-word gets wrong: "bench press" is not
 * "banca presionar", and "good morning" is not a greeting.
 */
const PHRASES: Record<string, string> = {
  'clean and jerk': 'cargada y envión',
  'clean and press': 'cargada y press',
  'good morning': 'buenos días',
  'bench press': 'press de banca',
  'chest press': 'press de pecho',
  'shoulder press': 'press de hombros',
  'military press': 'press militar',
  'french press': 'press francés',
  'leg press': 'prensa de piernas',
  'lateral raise': 'elevación lateral',
  'front raise': 'elevación frontal',
  'rear delt raise': 'elevación posterior de hombro',
  'calf raise': 'elevación de talones',
  'leg raise': 'elevación de piernas',
  'knee raise': 'elevación de rodillas',
  'hip raise': 'elevación de cadera',
  'hip thrust': 'empuje de cadera',
  'hip extension': 'extensión de cadera',
  'hip abduction': 'abducción de cadera',
  'hip adduction': 'aducción de cadera',
  'leg extension': 'extensión de piernas',
  'leg curl': 'curl femoral',
  'triceps extension': 'extensión de tríceps',
  'tricep extension': 'extensión de tríceps',
  'triceps pushdown': 'extensión de tríceps en polea',
  'triceps kickback': 'patada de tríceps',
  'tricep kickback': 'patada de tríceps',
  'triceps dip': 'fondo de tríceps',
  'biceps curl': 'curl de bíceps',
  'bicep curl': 'curl de bíceps',
  'hammer curl': 'curl martillo',
  'preacher curl': 'curl predicador',
  'concentration curl': 'curl concentrado',
  'wrist curl': 'curl de muñeca',
  'zottman curl': 'curl Zottman',
  'reverse curl': 'curl inverso',
  'pull-up': 'dominada',
  'pull up': 'dominada',
  'chin-up': 'dominada supina',
  'chin up': 'dominada supina',
  'push-up': 'flexión',
  'push up': 'flexión',
  'sit-up': 'abdominal',
  'sit up': 'abdominal',
  'step-up': 'subida al cajón',
  'step up': 'subida al cajón',
  'pull-down': 'jalón',
  pulldown: 'jalón',
  'lat pulldown': 'jalón al pecho',
  pullover: 'pullover',
  'upright row': 'remo al mentón',
  'bent-over row': 'remo inclinado',
  'bent over row': 'remo inclinado',
  'inverted row': 'remo invertido',
  'face pull': 'face pull',
  'front squat': 'sentadilla frontal',
  'hack squat': 'sentadilla hack',
  'split squat': 'sentadilla búlgara',
  'sumo deadlift': 'peso muerto sumo',
  'stiff leg deadlift': 'peso muerto rumano',
  'romanian deadlift': 'peso muerto rumano',
  'russian twist': 'giro ruso',
  'mountain climber': 'escalador',
  'jumping jack': 'salto de tijera',
  'wall sit': 'sentadilla isométrica en pared',
  'reverse grip': 'agarre inverso',
  'reverse-grip': 'agarre inverso',
  'close grip': 'agarre cerrado',
  'close-grip': 'agarre cerrado',
  'wide grip': 'agarre abierto',
  'wide-grip': 'agarre abierto',
  'neutral grip': 'agarre neutro',
  'v-bar': 'barra en V',
  'v bar': 'barra en V',
  'behind the neck': 'tras nuca',
  'behind neck': 'tras nuca',
  'bent over': 'inclinado',
  'bent-over': 'inclinado',
  'cross-over': 'cruce',
  'cross over': 'cruce',
  'one arm': 'a una mano',
  'single arm': 'a una mano',
  'one leg': 'a una pierna',
  'single leg': 'a una pierna',
  'two arm': 'a dos manos',
  'both arms': 'a dos manos',
};

/** Single tokens: movements, positions, body parts and qualifiers. */
const WORDS: Record<string, string> = {
  // Movements
  press: 'press',
  curl: 'curl',
  curls: 'curl',
  row: 'remo',
  raise: 'elevación',
  extension: 'extensión',
  flexion: 'flexión',
  squat: 'sentadilla',
  deadlift: 'peso muerto',
  lunge: 'zancada',
  lunges: 'zancadas',
  dip: 'fondo',
  dips: 'fondos',
  fly: 'apertura',
  flye: 'apertura',
  crunch: 'encogimiento',
  shrug: 'encogimiento de hombros',
  twist: 'giro',
  rotation: 'rotación',
  bridge: 'puente',
  plank: 'plancha',
  pushdown: 'extensión en polea',
  kickback: 'patada',
  thrust: 'empuje',
  swing: 'balanceo',
  snatch: 'arrancada',
  clean: 'cargada',
  jerk: 'envión',
  throw: 'lanzamiento',
  jump: 'salto',
  jumps: 'saltos',
  hop: 'salto',
  run: 'carrera',
  walk: 'caminata',
  walking: 'caminando',
  kick: 'patada',
  tap: 'toque',
  touch: 'toque',
  stretch: 'estiramiento',
  hyperextension: 'hiperextensión',
  abduction: 'abducción',
  adduction: 'aducción',
  pull: 'tirón',
  push: 'empuje',
  lift: 'elevación',
  rollerout: 'rodamiento',
  circles: 'círculos',
  scissors: 'tijeras',
  hold: 'isométrico',
  march: 'marcha',
  climb: 'escalada',

  // Position and stance
  seated: 'sentado',
  standing: 'de pie',
  lying: 'tumbado',
  kneeling: 'de rodillas',
  prone: 'boca abajo',
  supine: 'boca arriba',
  incline: 'inclinado',
  inclined: 'inclinado',
  decline: 'declinado',
  declined: 'declinado',
  bent: 'inclinado',
  hanging: 'colgado',
  hang: 'suspensión',
  inverted: 'invertido',
  inverse: 'inverso',
  reverse: 'inverso',
  revers: 'inverso',
  suspended: 'suspendido',
  vertical: 'vertical',
  horizontal: 'horizontal',
  parallel: 'paralelo',
  overhead: 'por encima de la cabeza',
  floor: 'en el suelo',
  wall: 'en la pared',
  bench: 'en banco',
  bar: 'en barra',
  bars: 'en barras',
  box: 'al cajón',
  step: 'al escalón',
  stance: 'postura',
  support: 'con apoyo',
  supported: 'con apoyo',

  // Body parts and targets
  arm: 'de brazo',
  arms: 'de brazos',
  leg: 'de pierna',
  legs: 'de piernas',
  chest: 'de pecho',
  back: 'de espalda',
  shoulder: 'de hombro',
  shoulders: 'de hombros',
  biceps: 'de bíceps',
  bicep: 'de bíceps',
  triceps: 'de tríceps',
  tricep: 'de tríceps',
  forearm: 'de antebrazo',
  wrist: 'de muñeca',
  calf: 'de gemelo',
  calves: 'de gemelos',
  glute: 'de glúteo',
  glutes: 'de glúteos',
  hamstring: 'de isquiotibiales',
  hamstrings: 'de isquiotibiales',
  quad: 'de cuádriceps',
  quads: 'de cuádriceps',
  hip: 'de cadera',
  hips: 'de caderas',
  knee: 'de rodilla',
  knees: 'de rodillas',
  ankle: 'de tobillo',
  neck: 'de cuello',
  abs: 'abdominal',
  abdominal: 'abdominal',
  oblique: 'oblicuo',
  obliques: 'oblicuos',
  lat: 'dorsal',
  lats: 'dorsales',
  delt: 'deltoides',
  delts: 'deltoides',
  trap: 'trapecio',
  traps: 'trapecios',
  spine: 'de columna',
  core: 'de core',
  toe: 'de puntillas',
  toes: 'de puntillas',
  head: 'de cabeza',
  body: 'de cuerpo',
  hand: 'de mano',
  hands: 'de manos',
  elbow: 'de codo',
  palm: 'palma',
  palms: 'palmas',
  finger: 'de dedos',
  flexor: 'flexor',
  shin: 'de espinilla',

  // Qualifiers
  alternate: 'alterno',
  alternating: 'alterno',
  single: 'a una mano',
  double: 'doble',
  one: 'una',
  two: 'dos',
  three: 'tres',
  full: 'completo',
  half: 'medio',
  quarter: 'un cuarto',
  wide: 'abierto',
  narrow: 'cerrado',
  close: 'cerrado',
  neutral: 'neutro',
  front: 'frontal',
  side: 'lateral',
  lateral: 'lateral',
  rear: 'posterior',
  low: 'bajo',
  high: 'alto',
  lower: 'inferior',
  upper: 'superior',
  inner: 'interno',
  outer: 'externo',
  straight: 'recto',
  cross: 'cruzado',
  crossed: 'cruzado',
  twisting: 'con giro',
  static: 'estático',
  dynamic: 'dinámico',
  isometric: 'isométrico',
  explosive: 'explosivo',
  slow: 'lento',
  deep: 'profundo',
  short: 'corto',
  long: 'largo',
  left: 'izquierdo',
  right: 'derecho',
  forward: 'adelante',
  backward: 'atrás',
  down: 'abajo',
  up: 'arriba',
  in: 'dentro',
  out: 'fuera',
  sumo: 'sumo',
  russian: 'ruso',
  bulgarian: 'búlgaro',
  spider: 'araña',
  preacher: 'predicador',
  hammer_style: 'martillo',
  donkey: 'burro',
  goblet: 'goblet',
  zercher: 'Zercher',
  pistol: 'pistol',
  planche: 'planche',
  archer: 'arquero',
  blaster: 'blaster',
  military: 'militar',
  olympic: 'olímpico',
  romanian: 'rumano',
  stiff: 'rígido',
  swiss: 'suizo',
  scott: 'Scott',
  arnold: 'Arnold',
  cuban: 'cubano',
  turkish: 'turco',
  gironda: 'Gironda',

  // Structural glue
  with: 'con',
  on: 'en',
  to: 'a',
  and: 'y',
  the: '',
  a: '',
  of: 'de',
  over: 'sobre',
  under: 'bajo',
  behind: 'tras',
  against: 'contra',
  through: 'a través',
  between: 'entre',
  grip: 'agarre',
  attachment: 'agarre',
  machine: 'máquina',
  exercise: 'ejercicio',
  male: '',
  female: '',
  version: 'versión',
  variation: 'variante',
  pov: '',
};

/** Tokens that carry no meaning worth translating (numerals, plate labels). */
const PASSTHROUGH = /^(v|\d+|\d+°|[a-z])$/;

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Longest-first so multi-word keys are tried before their own substrings. */
function byLengthDesc(keys: string[]): string[] {
  return [...keys].sort((a, b) => b.length - a.length);
}

const EQUIPMENT_KEYS = byLengthDesc(Object.keys(EQUIPMENT_PHRASES));
const PHRASE_KEYS = byLengthDesc(Object.keys(PHRASES));

export interface NameTranslation {
  /** The Spanish name, or null when some token didn't resolve. */
  nameEs: string | null;
  /** Tokens that had no entry — what a reviewer needs to see. */
  unresolved: string[];
}

/**
 * Translate one exercise name.
 *
 * Order matters: equipment comes out first (so "ball" in "exercise ball" is
 * never mistaken for a movement), then set phrases, then the leftover tokens.
 */
export function translateExerciseName(rawName: string): NameTranslation {
  let working = normalize(rawName);
  const trailing: string[] = [];

  // 1. Lift out equipment, remembering it for the tail of the Spanish name.
  for (const key of EQUIPMENT_KEYS) {
    const pattern = new RegExp(`(^|[\\s-])${escapeRegExp(key)}($|[\\s-])`, 'g');
    if (pattern.test(working)) {
      working = working.replace(pattern, '$1\0$2');
      trailing.push(EQUIPMENT_PHRASES[key]);
    }
  }
  working = working.replace(/\0/g, ' ').replace(/\s+/g, ' ').trim();

  // 2. Set phrases, marked so their words aren't re-translated singly.
  const held: string[] = [];
  for (const key of PHRASE_KEYS) {
    const pattern = new RegExp(`(^|\\s)${escapeRegExp(key)}($|\\s)`, 'g');
    working = working.replace(pattern, (_m, before: string, after: string) => {
      held.push(PHRASES[key]);
      return `${before}\x01${held.length - 1}\x01${after}`;
    });
  }

  // 3. Everything left, token by token.
  const unresolved: string[] = [];
  const parts: string[] = [];
  for (const token of working.split(/\s+/).filter(Boolean)) {
    const heldMatch = token.match(/^\x01(\d+)\x01$/);
    if (heldMatch) {
      parts.push(held[Number(heldMatch[1])]);
      continue;
    }
    if (PASSTHROUGH.test(token)) {
      parts.push(token);
      continue;
    }
    const word = WORDS[token];
    if (word === undefined) {
      unresolved.push(token);
      continue;
    }
    if (word) parts.push(word);
  }

  if (unresolved.length > 0) {
    return { nameEs: null, unresolved };
  }

  const assembled = [...parts, ...trailing]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { nameEs: assembled ? capitalize(assembled) : null, unresolved: [] };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
