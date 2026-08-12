import { fireEvent, render } from '@testing-library/react-native';

import { BodyMapPicker } from './body-map-picker';

// The plate itself is a third-party SVG whose regions can't be driven from a
// test renderer, so it's swapped for a button per muscle. What's under test is
// the two-tap rule around it, not the drawing.
jest.mock('./body-map-pager', () => {
  // jest hoists this factory above the imports, so it has to require inline.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text, Pressable } = require('react-native');
  return {
    BodyMapPager: ({
      onSelectMuscle,
    }: {
      selectedMuscle: string | null;
      onSelectMuscle: (muscle: string) => void;
    }) => (
      <>
        {['pectorals', 'lats'].map((muscle) => (
          <Pressable key={muscle} testID={`region-${muscle}`} onPress={() => onSelectMuscle(muscle)}>
            <Text>{muscle}</Text>
          </Pressable>
        ))}
      </>
    ),
  };
});

const COUNTS = { pectorals: 154, lats: 87 };

async function setup(selectedMuscle: string | null = null) {
  const onSelectMuscle = jest.fn();
  const view = await render(
    <BodyMapPicker
      selectedMuscle={selectedMuscle}
      onSelectMuscle={onSelectMuscle}
      counts={COUNTS}
    />,
  );
  return { ...view, onSelectMuscle };
}

test('starts by inviting a tap, with nothing filtered', async () => {
  const { getByText, onSelectMuscle } = await setup();

  expect(getByText('Tap a muscle to learn its name')).toBeTruthy();
  expect(onSelectMuscle).not.toHaveBeenCalled();
});

test('first tap names the muscle and counts it without filtering', async () => {
  const { getByTestId, getByText, onSelectMuscle } = await setup();

  await fireEvent.press(getByTestId('region-pectorals'));

  expect(getByText('Chest')).toBeTruthy();
  expect(getByText('154 exercises')).toBeTruthy();
  expect(getByText('Tap again to see the exercises')).toBeTruthy();
  // The whole point: naming it must not disturb the list.
  expect(onSelectMuscle).not.toHaveBeenCalled();
});

test('second tap on the lit muscle commits it to the filter', async () => {
  const { getByTestId, onSelectMuscle } = await setup();

  await fireEvent.press(getByTestId('region-pectorals'));
  await fireEvent.press(getByTestId('region-pectorals'));

  expect(onSelectMuscle).toHaveBeenCalledWith('pectorals');
});

test('moving to another muscle drops the filter the previous one had set', async () => {
  const { getByTestId, getByText, onSelectMuscle } = await setup('pectorals');

  await fireEvent.press(getByTestId('region-lats'));

  expect(getByText('Lats')).toBeTruthy();
  expect(getByText('87 exercises')).toBeTruthy();
  // Otherwise the list would still show chest while the back is lit.
  expect(onSelectMuscle).toHaveBeenCalledWith(null);
});

test('tapping the confirmed muscle again lets go of it', async () => {
  const { getByTestId, getByText, onSelectMuscle } = await setup('pectorals');

  expect(getByText('Showing these exercises')).toBeTruthy();
  await fireEvent.press(getByTestId('region-pectorals'));

  expect(onSelectMuscle).toHaveBeenCalledWith(null);
});
