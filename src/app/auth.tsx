import { Stack, router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isSupabaseConfigured, signIn, signUp } from '@/auth';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';

export default function AuthScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit() {
    if (!email.trim() || password.length < 6) {
      setMessage(t('account.invalidForm'));
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const session =
        mode === 'signIn' ? await signIn(email, password) : await signUp(email, password);
      if (session) router.back();
      else setMessage(t('account.confirmEmail'));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('common.errorMessage'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: t('account.title') }} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
        >
          <ThemedText type="subtitle">
            {mode === 'signIn' ? t('account.signIn') : t('account.signUp')}
          </ThemedText>
          <ThemedText themeColor="textSecondary">{t('account.subtitle')}</ThemedText>

          {!isSupabaseConfigured() ? (
            <ThemedText themeColor="textSecondary">{t('account.configureHint')}</ThemedText>
          ) : (
            <ThemedView style={styles.form}>
              <Field
                label={t('account.email')}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
              />
              <Field
                label={t('account.password')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              {message ? <ThemedText style={{ color: theme.accent }}>{message}</ThemedText> : null}
              <PressableScale
                onPress={submit}
                disabled={busy}
                accessibilityRole="button"
                style={[
                  styles.primaryButton,
                  { backgroundColor: theme.accent, opacity: busy ? 0.6 : 1 },
                ]}
              >
                <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                  {busy
                    ? t('account.working')
                    : mode === 'signIn'
                      ? t('account.signIn')
                      : t('account.signUp')}
                </ThemedText>
              </PressableScale>
              <PressableScale
                onPress={() => {
                  setMode((current) => (current === 'signIn' ? 'signUp' : 'signIn'));
                  setMessage('');
                }}
                accessibilityRole="button"
                style={styles.switchButton}
              >
                <ThemedText type="small" style={{ color: theme.accent }}>
                  {mode === 'signIn' ? t('account.needAccount') : t('account.haveAccount')}
                </ThemedText>
              </PressableScale>
            </ThemedView>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Field(props: ComponentProps<typeof TextInput> & { label: string }) {
  const theme = useTheme();
  const { label, ...inputProps } = props;
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        {...inputProps}
        autoCapitalize="none"
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.background, borderColor: theme.border },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  content: { padding: Spacing.three, gap: Spacing.two },
  form: { gap: Spacing.three, marginTop: Spacing.two },
  field: { gap: Spacing.half },
  input: {
    minHeight: 48,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
  },
  primaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.pill,
  },
  switchButton: { alignItems: 'center', paddingVertical: Spacing.one },
});
