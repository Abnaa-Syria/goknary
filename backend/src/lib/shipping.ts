const toCents = (value: number): number => Math.round(value * 100);

export const calculateCheckoutShipping = (
  subtotal: number,
  freeShippingThreshold: number,
  governorateRate: number | null | undefined,
  fallbackRate = 50,
): number => {
  if (subtotal >= freeShippingThreshold) return 0;
  const rate = Number.isFinite(governorateRate) ? Number(governorateRate) : fallbackRate;
  return Math.max(0, toCents(rate) / 100);
};

/** Split one customer-facing shipping charge across vendor orders without changing its total. */
export const allocateShippingCost = (shippingCost: number, subtotals: number[]): number[] => {
  if (subtotals.length === 0) return [];

  const totalCents = toCents(Math.max(0, shippingCost));
  const subtotalSum = subtotals.reduce((sum, subtotal) => sum + Math.max(0, subtotal), 0);
  let remainingCents = totalCents;

  return subtotals.map((subtotal, index) => {
    if (index === subtotals.length - 1) return remainingCents / 100;
    if (subtotalSum <= 0) return 0;

    const proportionalCents = Math.min(
      remainingCents,
      Math.round(totalCents * (Math.max(0, subtotal) / subtotalSum)),
    );
    remainingCents -= proportionalCents;
    return proportionalCents / 100;
  });
};
