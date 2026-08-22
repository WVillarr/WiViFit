import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/auth';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';

export default function SignInScreen() {
  const { signIn, signUp } = useAuth();
  const { t } = useTranslation();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = creating ? await signUp(email, password) : await signIn(email, password);
    setBusy(false);
    if (result.error) setError(result.error.message);
    else if (creating) setMessage(t('auth.accountCreated'));
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.content}
        >
          <View style={styles.heading}>
            <ThemedText type="eyebrow" themeColor="accent">
              WIVIFIT
            </ThemedText>
            <ThemedText type="title">{t('auth.title')}</ThemedText>
            <ThemedText themeColor="textSecondary">{t('auth.subtitle')}</ThemedText>
          </View>

          <View style={styles.form}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.email')}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.password')}
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              textContentType="password"
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
            />
            {error ? <ThemedText style={{ color: theme.accentAlt }}>{error}</ThemedText> : null}
            {message ? <ThemedText themeColor="accent">{message}</ThemedText> : null}
            <PressableScale
              onPress={submit}
              disabled={busy || !email.trim() || password.length < 6}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: theme.accent,
                  opacity: busy || !email.trim() || password.length < 6 ? 0.5 : 1,
                },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                  {creating ? t('auth.createAccount') : t('auth.signIn')}
                </ThemedText>
              )}
            </PressableScale>
            <Pressable
              onPress={() => {
                setCreating((value) => !value);
                setError(null);
                setMessage(null);
              }}
            >
              <ThemedText type="small" themeColor="accent" style={styles.switchText}>
                {creating ? t('auth.haveAccount') : t('auth.needAccount')}
              </ThemedText>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: Spacing.five, gap: Spacing.six },
  heading: { gap: Spacing.two },
  form: { gap: Spacing.three },
  input: {
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchText: { textAlign: 'center' },
});
