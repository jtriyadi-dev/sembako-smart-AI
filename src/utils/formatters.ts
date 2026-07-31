/**
 * Format number to Indonesian Rupiah currency
 * @example 15000 -> "Rp 15.000"
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date to readable Indonesian format
 * @example "2026-07-28T10:00:00Z" -> "28 Juli 2026, 10:00 WIB"
 */
export function formatDateIndo(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date) + ' WIB';
}

/**
 * Format short date (e.g. 28 Jul)
 */
export function formatShortDate(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

/**
 * Get stock status badge helper
 */
export function getStockStatus(stok: number, minStok: number): { label: string; color: string; bg: string } {
  if (stok <= 0) {
    return {
      label: 'Habis',
      color: 'text-rose-500',
      bg: 'bg-rose-500/10 border-rose-500/20',
    };
  }
  if (stok <= minStok) {
    return {
      label: 'Menipis',
      color: 'text-amber-500',
      bg: 'bg-amber-500/10 border-amber-500/20',
    };
  }
  return {
    label: 'Aman',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  };
}
