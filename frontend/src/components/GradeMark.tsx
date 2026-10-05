import { formatPercent, gradeFamily, TONE } from '../lib/format';

export function GradeMark({
  letter,
  percent,
  large = false,
}: {
  letter: string | null;
  percent: number | null;
  large?: boolean;
}) {
  const tone = TONE[gradeFamily(letter)];
  return (
    <div className={`flex shrink-0 flex-col items-center justify-center rounded-2xl ${tone.soft} ${tone.text} ${large ? 'h-24 w-24' : 'h-20 w-20'}`}>
      <span className={`font-display leading-none ${large ? 'text-5xl' : 'text-3xl'}`}>{letter ?? '–'}</span>
      <span className="mt-1 text-xs font-semibold">{formatPercent(percent)}</span>
    </div>
  );
}
