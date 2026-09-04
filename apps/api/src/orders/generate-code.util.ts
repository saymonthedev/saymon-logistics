function randomSuffix(length: number): string {
  return Math.random()
    .toString(36)
    .slice(2, 2 + length)
    .toUpperCase();
}

/** Time-based + random, so it never needs a DB round-trip (or races) to stay unique. */
export function generateOrderNumber(): string {
  return `PED-${Date.now().toString(36).toUpperCase()}-${randomSuffix(4)}`;
}

export function generateTrackingCode(): string {
  return `TRK-${Date.now().toString(36).toUpperCase()}-${randomSuffix(5)}`;
}
