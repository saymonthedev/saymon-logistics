/** Time-based, so it never needs a DB round-trip (or races) to stay unique. */
export function generateWaveCode(): string {
  return `WAVE-${Date.now().toString(36).toUpperCase()}`;
}
