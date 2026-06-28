import { DateTime } from 'luxon';
import { formatTime, isMarketOpen } from './market-hours';

const inSantiago = (iso: string) =>
  DateTime.fromISO(iso, { zone: 'America/Santiago' });

describe('isMarketOpen', () => {
  it('bloquea los sábados por defecto', () => {
    expect(
      isMarketOpen('09:30', '16:00', undefined, inSantiago('2026-06-13T12:00')),
    ).toBe(false);
  });

  it('bloquea los domingos por defecto', () => {
    expect(
      isMarketOpen('09:30', '16:00', undefined, inSantiago('2026-06-14T12:00')),
    ).toBe(false);
  });

  it('abre un día hábil dentro del horario configurado', () => {
    expect(
      isMarketOpen('09:30', '16:00', undefined, inSantiago('2026-06-15T12:00')),
    ).toBe(true);
  });

  it('cierra un día hábil fuera del horario configurado', () => {
    expect(
      isMarketOpen('09:30', '16:00', undefined, inSantiago('2026-06-15T18:00')),
    ).toBe(false);
  });

  it('respeta closedDays personalizados', () => {
    expect(
      isMarketOpen(
        '09:30',
        '16:00',
        [1, 2, 3, 4, 5],
        inSantiago('2026-06-15T12:00'),
      ),
    ).toBe(false);
  });

  it('formatea la hora actual en America/Santiago', () => {
    expect(formatTime(new Date('2026-06-15T15:30:00.000Z'))).toBe('11:30');
  });
});
