/**
 * Deterministic number & currency formatting utilities.
 * Uses explicit 'en-US' locale to ensure identical server (SSR) and client rendering,
 * preventing Next.js hydration mismatches across different client OS/browser locales.
 */

export function formatNumber(
  val: number | string | null | undefined,
  options?: Intl.NumberFormatOptions
): string {
  if (val === null || val === undefined || isNaN(Number(val))) return '0';
  const num = Number(val);
  return num.toLocaleString('en-US', options);
}

export function formatCurrency(
  val: number | string | null | undefined,
  minimumFractionDigits: number = 0,
  maximumFractionDigits: number = 2
): string {
  if (val === null || val === undefined || isNaN(Number(val))) return '$0';
  const num = Number(val);
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
  });
  return `${formatted}`;
}
