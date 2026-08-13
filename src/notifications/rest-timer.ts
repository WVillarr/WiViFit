import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'rest-timer';

let setupDone: Promise<void> | null = null;

/**
 * Permission + Android channel setup, done once and cached — every call to
 * scheduleRestEnd() awaits this rather than re-requesting permission on
 * every set logged. A denied permission isn't an error here: the timestamp
 * countdown in the workout screen is the source of truth, this notification
 * is only a backstop for "the user never looked back at the screen".
 */
async function ensureSetUp(): Promise<void> {
  setupDone ??= (async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Rest timer',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
  })();
  return setupDone;
}

/**
 * Schedules a local notification for when a rest period ends. Returns the
 * notification's id so the caller can cancel it if the rest is skipped or
 * the workout ends early — an uncancelled one would otherwise fire minutes
 * after the person already moved on.
 */
export async function scheduleRestEnd(seconds: number, title: string, body: string): Promise<string> {
  await ensureSetUp();
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.round(seconds)),
      channelId: CHANNEL_ID,
    },
  });
}

export async function cancelRestEnd(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}
