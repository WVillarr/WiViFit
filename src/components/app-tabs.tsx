import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors, FontFamily } from '@/constants/theme';
import { useTranslation } from '@/i18n/use-translation';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'dark' : scheme];
  const { t } = useTranslation();

  return (
    <NativeTabs
      backgroundColor={colors.background}
      iconColor={{ default: colors.textSecondary, selected: colors.accent }}
      labelStyle={{
        default: { color: colors.textSecondary, fontFamily: FontFamily.bodyMedium, fontSize: 11 },
        selected: { color: colors.accent, fontFamily: FontFamily.bodySemi, fontSize: 11 },
      }}
      // The green icon and label already say "selected"; Android's pill on top
      // of them only muddies the navy.
      disableIndicator
      rippleColor={colors.backgroundSelected}
    >
      <NativeTabs.Trigger name="exercises">
        <NativeTabs.Trigger.Label>{t('tabs.exercises')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('tabs.home')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>{t('tabs.explore')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
