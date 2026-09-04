export class InsufficientStockError extends Error {
  constructor(
    public readonly shortages: {
      productId: string;
      sku: string;
      requested: number;
      available: number;
    }[],
  ) {
    super(
      `Insufficient stock for: ${shortages
        .map((s) => `${s.sku} (requested ${s.requested}, available ${s.available})`)
        .join(', ')}`,
    );
    this.name = 'InsufficientStockError';
  }
}
