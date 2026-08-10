import { render } from '@testing-library/react-native';

import { ThemedText } from '@/components/themed-text';

test('renders text content', async () => {
  const { getByText } = await render(<ThemedText>Hello WiviFit</ThemedText>);

  expect(getByText('Hello WiviFit')).toBeTruthy();
});
