/**
 * Format a YYYY-MM-DD string as "15 Jan 2024".
 * Parses in local time so the date never shifts due to timezone offsets.
 */
export function fmtDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format an ISO datetime string as "15 Jan 2024".
 */
export function fmtDatetime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format an ISO datetime string as "15 Jan 2024, 14:30".
 */
export function fmtDatetimeWithTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
