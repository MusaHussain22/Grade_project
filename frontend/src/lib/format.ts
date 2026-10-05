export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(1)}%`;
}

export function formatDelta(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(1)}`;
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export type GradeFamily = 'A' | 'B' | 'C' | 'D' | 'F' | 'N';

export function gradeFamily(letter: string | null): GradeFamily {
  const base = letter?.[0]?.toUpperCase();
  if (base === 'A' || base === 'B' || base === 'C' || base === 'D' || base === 'F') return base;
  return 'N';
}

export const TONE = {
  A: { text: 'text-a', soft: 'bg-a-soft', border: 'border-a', bar: 'bg-a' },
  B: { text: 'text-b', soft: 'bg-b-soft', border: 'border-b', bar: 'bg-b' },
  C: { text: 'text-c', soft: 'bg-c-soft', border: 'border-c', bar: 'bg-c' },
  D: { text: 'text-d', soft: 'bg-d-soft', border: 'border-d', bar: 'bg-d' },
  F: { text: 'text-f', soft: 'bg-f-soft', border: 'border-f', bar: 'bg-f' },
  N: { text: 'text-muted', soft: 'bg-line', border: 'border-line', bar: 'bg-muted' },
} as const;
