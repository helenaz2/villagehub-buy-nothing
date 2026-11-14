import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { dayAndTime } from './format';

/** Three sensible pickup times: later today if there is still daylight, then tomorrow. */
export function suggestSlots(now = Date.now()): number[] {
  const at = (dayOffset: number, hour: number, minute = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d.getTime();
  };
  const hour = new Date(now).getHours();
  const slots: number[] = [];
  if (hour < 16) slots.push(at(0, 17, 30));
  else if (hour < 19) slots.push(at(0, hour + 2, 0));
  slots.push(at(1, 10, 0), at(1, 17, 30));
  if (slots.length < 3) slots.push(at(2, 10, 0));
  return slots.slice(0, 3);
}

const SAFE_SPOTS: Record<string, string> = {
  Southside: 'Sproul Plaza, by the steps',
  Northside: 'North Gate, by the campus map',
  'Downtown Berkeley': 'Downtown Berkeley BART plaza',
  Rockridge: 'Rockridge BART, street-level entrance',
  Albany: 'Albany Library front entrance',
};

/** A public, well-lit place to meet for small items. */
export const safeSpot = (neighborhood: string): string =>
  SAFE_SPOTS[neighborhood] ?? 'the front steps, in daylight, with a friend nearby';

const stamp = (ts: number) => new Date(ts).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Opens a pre-filled calendar event. Works on every platform with no permission prompt. */
export function addToCalendar(input: { title: string; at: number; where: string; details: string }) {
  const end = input.at + 30 * 60_000;
  const url =
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${encodeURIComponent(input.title)}` +
    `&dates=${stamp(input.at)}/${stamp(end)}` +
    `&location=${encodeURIComponent(input.where)}` +
    `&details=${encodeURIComponent(input.details)}`;
  return Linking.openURL(url);
}

export function openDirections(address: string) {
  const q = encodeURIComponent(address);
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${q}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
  });
  return Linking.openURL(url);
}

export const call = (phone: string) => Linking.openURL(`tel:${phone}`);

/** Local notification one hour before pickup. Returns a short status line for the UI. */
export async function remindBeforePickup(title: string, pickupAt: number): Promise<string> {
  if (Platform.OS === 'web') return 'Reminders work on the phone app.';
  const fireAt = pickupAt - 60 * 60_000;
  if (fireAt <= Date.now()) return 'Pickup is less than an hour away.';
  try {
    // Imported lazily so the module is only touched when someone asks for a reminder.
    const Notifications = await import('expo-notifications');
    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return 'Notifications are off for Curbside.';
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Pickup in an hour', body: `${title}, ${dayAndTime(pickupAt)}.` },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(fireAt) },
    });
    return 'We will remind you an hour before.';
  } catch {
    return 'Could not set a reminder on this device.';
  }
}
