import * as Notifications from 'expo-notifications';

import { formatTime } from '@/astro/format';
import { nextQuarters } from '@/astro/moon';
import { computeSunDay } from '@/astro/sun';
import { addDays, MIN_MS, startOfDay } from '@/astro/time';
import { strings } from '@/i18n';
import { selectPlace, useApp } from '@/store/app';

let handlerSet = false;

function ensureHandler() {
  if (handlerSet || process.env.EXPO_OS === 'web') return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (process.env.EXPO_OS === 'web') return false;
  try {
    ensureHandler();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const res = await Notifications.requestPermissionsAsync();
    return res.granted;
  } catch {
    return false;
  }
}

/** Rebuilds the next 7 days of local reminders from the user's preferences. */
export async function rescheduleNotifications(): Promise<number> {
  if (process.env.EXPO_OS === 'web') return 0;
  try {
    ensureHandler();
    await Notifications.cancelAllScheduledNotificationsAsync();
    const s = useApp.getState();
    if (!s.notificationsEnabled) return 0;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return 0;

    const place = selectPlace(s);
    const prefs = s.notifications;
    const lead = prefs.leadMinutes * MIN_MS;
    const now = Date.now();
    const jobs: { at: number; title: string; body: string }[] = [];
    const tx = strings().notifications;
    const leadMin = prefs.leadMinutes;
    const at = (d: Date | null) => formatTime(d, place.tz, s.use24h);

    let day = startOfDay(new Date(), place.tz);
    for (let i = 0; i < 7; i++) {
      const d = computeSunDay(place, day);
      if (prefs.sunrise && d.sunrise)
        jobs.push({ at: d.sunrise.getTime() - lead, title: tx.sunriseTitle(leadMin), body: tx.sunriseBody(at(d.sunrise), place.name) });
      if (prefs.sunset && d.sunset)
        jobs.push({ at: d.sunset.getTime() - lead, title: tx.sunsetTitle(leadMin), body: tx.sunsetBody(at(d.sunset)) });
      if (prefs.golden && d.goldenEvening.start)
        jobs.push({
          at: d.goldenEvening.start.getTime() - lead,
          title: tx.goldenTitle(leadMin),
          body: tx.goldenBody(at(d.goldenEvening.end)),
        });
      day = addDays(day, 1, place.tz);
    }
    for (const q of nextQuarters(new Date(), 4)) {
      if (prefs.fullMoon && q.key === 'full') jobs.push({ at: q.date.getTime() - 3 * 3_600_000, title: tx.fullMoonTitle, body: tx.fullMoonBody });
      if (prefs.newMoon && q.key === 'new') jobs.push({ at: q.date.getTime() - 3 * 3_600_000, title: tx.newMoonTitle, body: tx.newMoonBody });
    }

    const upcoming = jobs.filter((j) => j.at > now + MIN_MS).sort((a, b) => a.at - b.at).slice(0, 60);
    for (const j of upcoming) {
      await Notifications.scheduleNotificationAsync({
        content: { title: j.title, body: j.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: j.at },
      });
    }
    return upcoming.length;
  } catch {
    return 0;
  }
}
