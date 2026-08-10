import { i18n } from '@/i18n';

test('translates the same key across supported locales', () => {
  i18n.locale = 'en';
  expect(i18n.t('common.welcome')).toBe('Welcome');

  i18n.locale = 'es';
  expect(i18n.t('common.welcome')).toBe('Bienvenido');
});
