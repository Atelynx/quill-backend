let cachedMap: Map<string, string> | null = null;

const DEFAULT_CURRENCY = 'USD';

function parseCurrencyMap(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const suffix = trimmed.slice(0, eqIndex).trim();
    const currency = trimmed.slice(eqIndex + 1).trim();
    if (suffix && currency) {
      map.set(suffix.toUpperCase(), currency.toUpperCase());
    }
  }
  return map;
}

export function getCurrencyFromSymbol(symbol: string): string {
  if (cachedMap === null) {
    const raw = process.env['CURRENCY_SUFFIX_MAP'] ?? '.SN=CLP,.US=USD';
    cachedMap = parseCurrencyMap(raw);
  }

  const dotIndex = symbol.lastIndexOf('.');
  if (dotIndex === -1) return DEFAULT_CURRENCY;

  const suffix = symbol.slice(dotIndex).toUpperCase();
  return cachedMap.get(suffix) ?? DEFAULT_CURRENCY;
}

export function resetCurrencyCache(): void {
  cachedMap = null;
}
