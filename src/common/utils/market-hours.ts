import {DateTime} from "luxon"
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function getCurrentMinutes(): number {
  const now = DateTime.now().setZone("America/Santiago");

  return now.hour * 60 + now.minute;
}

export function isMarketOpen(
  openTime: string,
  closeTime: string,
  currentMinutes = getCurrentMinutes(),
): boolean {
  const openMinutes = parseTimeToMinutes(openTime);
  const closeMinutes = parseTimeToMinutes(closeTime);
  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

export function formatTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
