import { DateTime } from 'luxon';

const MARKET_TIME_ZONE = 'America/Santiago';

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function getCurrentMinutes(): number {
  const now = DateTime.now().setZone(MARKET_TIME_ZONE);
  return now.hour * 60 + now.minute;
}

export function isMarketOpen(
  openTime: string,
  closeTime: string,
  now = DateTime.now().setZone(MARKET_TIME_ZONE),
): boolean {
  const zonedNow = now.setZone(MARKET_TIME_ZONE);
  if (zonedNow.weekday > 5) {
    return false;
  }

  const openMinutes = parseTimeToMinutes(openTime);
  const closeMinutes = parseTimeToMinutes(closeTime);
  const currentMinutes = zonedNow.hour * 60 + zonedNow.minute;
  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

export function formatTime(date: Date): string {
  return DateTime.fromJSDate(date).setZone(MARKET_TIME_ZONE).toFormat('HH:mm');
}
