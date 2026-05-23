/** Format an amount with the given ISO currency code. Safe for any of our 4 supported currencies. */
export function formatCurrency(amount: number, currency: string): string {
  try {
    return amount.toLocaleString(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    // Fallback if browser can't format the currency for some reason.
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function isoToDateInput(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}
