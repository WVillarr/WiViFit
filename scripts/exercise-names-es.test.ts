import { translateExerciseName } from './exercise-names-es';

test('a fully-resolved name assembles equipment at the tail', () => {
  const { nameEs, unresolved } = translateExerciseName('barbell bench press');
  expect(unresolved).toEqual([]);
  expect(nameEs).toBe('Press de banca con barra');
});

test('an unresolved token returns null rather than a half-translated name', () => {
  const { nameEs, unresolved } = translateExerciseName('sphinx pose');
  expect(nameEs).toBeNull();
  expect(unresolved).toContain('sphinx');
});

test('parentheses are stripped so the word inside can still resolve', () => {
  // Regression: "(male)" as a literal token never matched WORDS.male because
  // of the glued paren — see normalize()'s docstring.
  const { nameEs, unresolved } = translateExerciseName('arms overhead full sit-up (male)');
  expect(unresolved).toEqual([]);
  expect(nameEs).not.toBeNull();
});

test('a preposition immediately before an equipment phrase is consumed, not stranded', () => {
  // Regression: "fly on exercise ball" used to leave "on" translated as a
  // bare "en" with nothing after it, since only "exercise ball" was lifted.
  const { nameEs } = translateExerciseName('dumbbell incline one arm fly on exercise ball');
  expect(nameEs).not.toBeNull();
  expect(nameEs).not.toMatch(/\ben\s+con\b/i);
});

test('a preposition NOT touching equipment is left alone', () => {
  const { nameEs } = translateExerciseName('band pull through');
  expect(nameEs).toBe('Tirón a través con banda');
});

test('the mis-encoded degree sign normalizes before the numeral passthrough', () => {
  const { nameEs, unresolved } = translateExerciseName('45в° side bend');
  expect(unresolved).toEqual([]);
  expect(nameEs).toBe('45° flexión lateral');
});

test('a version marker keeps its number instead of dropping the period as unresolved', () => {
  const { nameEs, unresolved } = translateExerciseName('barbell rear lunge v. 2');
  expect(unresolved).toEqual([]);
  expect(nameEs).toContain('2');
});

test('a bare hyphen between clauses reads as a comma, not a stranded token', () => {
  const { nameEs, unresolved } = translateExerciseName('elbow lift - reverse push-up');
  expect(unresolved).toEqual([]);
  expect(nameEs).toContain(',');
});
