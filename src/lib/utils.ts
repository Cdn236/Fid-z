import { CURRENCIES } from '@/types';

export function formatCurrency(amount: number, currency = 'USD'): string {
  const entry = CURRENCIES.find((c) => c.code === currency);
  const symbol = entry?.symbol || '$';
  return `${symbol}${amount.toFixed(2)}`;
}

export function formatDate(date: string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatRelativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function getConfidenceColor(score: number): string {
  if (score >= 0.85) return 'text-emerald-600 bg-emerald-50';
  if (score >= 0.6) return 'text-amber-600 bg-amber-50';
  return 'text-rose-600 bg-rose-50';
}

export function getConfidenceLabel(score: number): string {
  if (score >= 0.85) return 'High';
  if (score >= 0.6) return 'Medium';
  return 'Low';
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    uploaded: 'bg-slate-100 text-slate-600',
    extracting: 'bg-blue-100 text-blue-700',
    categorizing: 'bg-violet-100 text-violet-700',
    booked: 'bg-emerald-100 text-emerald-700',
    needs_review: 'bg-amber-100 text-amber-700',
    error: 'bg-rose-100 text-rose-700',
    duplicate: 'bg-orange-100 text-orange-700',
    non_receipt: 'bg-slate-100 text-slate-500',
    draft: 'bg-slate-100 text-slate-600',
    reviewed: 'bg-teal-100 text-teal-700',
  };
  return colors[status] || 'bg-slate-100 text-slate-600';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    uploaded: 'Uploaded',
    extracting: 'Extracting',
    categorizing: 'Categorizing',
    booked: 'Booked',
    needs_review: 'Needs Review',
    error: 'Error',
    duplicate: 'Duplicate',
    non_receipt: 'Not a Receipt',
    draft: 'Draft',
    reviewed: 'Reviewed',
  };
  return labels[status] || status;
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => {
      const str = String(cell);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function getPeriodRange(period: string, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (period) {
    case 'weekly': {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case 'monthly': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end };
    }
    case 'quarterly': {
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      return { start, end };
    }
    case 'yearly': {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start, end };
    }
    case 'custom': {
      const start = customStart ? new Date(customStart) : new Date(now.getFullYear(), 0, 1);
      const customEnd = customEnd ? new Date(customEnd) : end;
      customEnd.setHours(23, 59, 59, 999);
      return { start, end: customEnd };
    }
    default:
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end };
  }
}
