import { useCallback, useState } from 'react';

import { i18n, SupportedLocale } from '@/i18n';

export function useTranslation() {
  const [locale, setLocaleState] = useState<SupportedLocale>(i18n.locale as SupportedLocale);

  const setLocale = useCallback((next: SupportedLocale) => {
    i18n.locale = next;
    setLocaleState(next);
  }, []);

  const t = useCallback<typeof i18n.t>((scope, options) => i18n.t(scope, options), []);

  return { t, locale, setLocale };
}
