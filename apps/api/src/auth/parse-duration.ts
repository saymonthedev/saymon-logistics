const UNITS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** Parses simple durations like "8h", "30m", "7d" (or a bare number of ms) into milliseconds. */
export function parseDurationMs(input: string, fallbackMs = 8 * 3_600_000): number {
  const match = /^(\d+)([smhd])$/.exec(input.trim());
  if (!match) {
    const asNumber = Number(input);
    return Number.isFinite(asNumber) ? asNumber : fallbackMs;
  }
  const [, amount, unit] = match;
  return Number(amount) * UNITS[unit];
}
