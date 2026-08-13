import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A labeled integer input — used by the routine builder (sets/reps/rest) and the workout screen (weight/reps). */
export function NumberField({
  label,
  value,
  onChange,
  allowDecimal = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Weight fields need a decimal point (12.5 kg plates); rep/set counts don't. */
  allowDecimal?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        value={String(value)}
        onChangeText={(text) => {
          const cleaned = allowDecimal ? text.replace(/[^0-9.]/g, '') : text.replace(/[^0-9]/g, '');
          const parsed = allowDecimal ? parseFloat(cleaned) : parseInt(cleaned, 10);
          onChange(Number.isNaN(parsed) ? 0 : parsed);
        }}
        keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
        style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.half, minWidth: 64 },
  input: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    minWidth: 56,
    textAlign: 'center',
  },
});
