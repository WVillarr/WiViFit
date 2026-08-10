import { enrichExercise } from './enrichment';

test('barbell bench press is a compound horizontal push', () => {
  const result = enrichExercise(
    { name: 'barbell bench press', target: 'pectorals', equipment: 'barbell', bodyPart: 'chest' },
    'barbell',
  );
  expect(result.movementPattern).toBe('horizontal_push');
  expect(result.compound).toBe(true);
});

test('barbell deadlift is a compound hip-dominant lift, advanced difficulty', () => {
  const result = enrichExercise(
    { name: 'barbell deadlift', target: 'spine', equipment: 'barbell', bodyPart: 'back' },
    'barbell',
  );
  expect(result.movementPattern).toBe('hip_dominant');
  expect(result.compound).toBe(true);
  expect(result.difficulty).toBe(3);
});

test('dumbbell bicep curl is an isolation exercise, not compound', () => {
  const result = enrichExercise(
    {
      name: 'dumbbell bicep curl',
      target: 'biceps',
      equipment: 'dumbbell',
      bodyPart: 'upper arms',
    },
    'dumbbell',
  );
  expect(result.movementPattern).toBe('isolation');
  expect(result.compound).toBe(false);
});

test('glute kickback is isolation, not a hip-hinge compound', () => {
  const result = enrichExercise(
    { name: 'cable glute kickback', target: 'glutes', equipment: 'cable', bodyPart: 'upper legs' },
    'cable',
  );
  expect(result.movementPattern).toBe('isolation');
});

test('plank is tracked by time, not reps', () => {
  const result = enrichExercise(
    { name: 'plank', target: 'abs', equipment: 'body weight', bodyPart: 'waist' },
    'body_weight',
  );
  expect(result.trackingType).toBe('time');
  expect(result.avgSecondsPerRep).toBeNull();
});

test('bodyweight push-up is beginner difficulty', () => {
  const result = enrichExercise(
    { name: 'push-up', target: 'pectorals', equipment: 'body weight', bodyPart: 'chest' },
    'body_weight',
  );
  expect(result.difficulty).toBe(1);
});

test('confidence is always within [0, 1]', () => {
  const result = enrichExercise(
    {
      name: 'some obscure machine exercise',
      target: 'traps',
      equipment: 'leverage machine',
      bodyPart: 'back',
    },
    'leverage_machine',
  );
  expect(result.movementPatternConfidence).toBeGreaterThanOrEqual(0);
  expect(result.movementPatternConfidence).toBeLessThanOrEqual(1);
  expect(result.trackingTypeConfidence).toBeGreaterThanOrEqual(0);
  expect(result.trackingTypeConfidence).toBeLessThanOrEqual(1);
});
