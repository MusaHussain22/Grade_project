import { averageGpa, gpaPoints } from '../lib/grades';
import { projectCourse } from '../lib/project';
import type { Course, WhatIfMap } from '../types';

export function GpaWidget({ courses, whatIf }: { courses: Course[]; whatIf: WhatIfMap }) {
  const rows = courses.map((course) => {
    const projected = projectCourse(course, whatIf[course.id]);
    return { course, projected, points: gpaPoints(projected.letter) };
  });
  const gpa = averageGpa(rows.map((row) => row.projected.letter));
  const includesWhatIf = rows.some((row) => row.projected.usingWhatIf);

  return (
    <section className="overflow-hidden rounded-3xl bg-navy text-paper shadow-[0_16px_40px_rgba(27,54,84,0.18)]">
      <div className="grid gap-4 p-5 sm:grid-cols-[auto_1fr] sm:items-end">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-gold-soft uppercase">Unweighted GPA</p>
          <p className="font-display text-6xl leading-none">{gpa == null ? '—' : gpa.toFixed(2)}</p>
          <p className="mt-2 text-sm text-paper/80">
            {rows.length} {rows.length === 1 ? 'class' : 'classes'} on a 4.0 scale
            {includesWhatIf ? ' · includes what-if scores' : ''}
          </p>
        </div>
        <ul className="flex flex-wrap gap-2 sm:justify-end">
          {rows.map((row) => (
            <li key={row.course.id} className="rounded-full bg-white/10 px-3 py-1 text-sm">
              <span className="font-semibold">{row.projected.letter ?? '–'}</span>
              <span className="text-paper/70"> {row.points == null ? '' : row.points.toFixed(1)}</span>
            </li>
          ))}
        </ul>
      </div>
      <details className="border-t border-white/10 px-5 py-3 text-sm text-paper/80">
        <summary className="cursor-pointer font-semibold text-gold-soft">How the 4.0 scale is applied</summary>
        <p className="mt-2 max-w-2xl">
          A and A+ are 4.0, A- is 3.7, B+ is 3.3, B is 3.0, B- is 2.7, C+ is 2.3, C is 2.0,
          C- is 1.7, D+ is 1.3, D is 1.0, D- is 0.7, and F is 0. The widget averages those points.
          It does not add honors or AP weight.
        </p>
      </details>
    </section>
  );
}
