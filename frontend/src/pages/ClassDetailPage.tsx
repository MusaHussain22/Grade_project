import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { GradeMark } from '../components/GradeMark';
import { WhatIfSheet } from '../components/WhatIfSheet';
import { useSession } from '../context/useSession';
import { formatDelta, formatPercent, gradeFamily, TONE } from '../lib/format';
import { projectCourse } from '../lib/project';
import type { Assignment } from '../types';

function assignmentTime(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function scoreLabel(assignment: Assignment): string {
  if (assignment.status === 'excused') return 'Excused';
  if (assignment.status === 'pending') return 'Not graded';
  if (assignment.status === 'missing') return `Missing · 0/${assignment.totalPoints ?? '—'}`;
  if (assignment.score == null) return '—';
  return `${assignment.score}/${assignment.totalPoints ?? '—'}`;
}

export function ClassDetailPage() {
  const { courseId } = useParams();
  const { token, loading, gradebook, whatIf, addMock, removeMock, setWeight, resetCourse } = useSession();
  const [group, setGroup] = useState<'category' | 'date'>('category');
  const [sheetOpen, setSheetOpen] = useState(false);
  const course = gradebook?.courses.find((item) => item.id === courseId);
  const tweak = course ? whatIf[course.id] : undefined;
  const projected = useMemo(() => (course ? projectCourse(course, tweak) : null), [course, tweak]);

  useEffect(() => {
    document.title = course ? `${course.name} · Gradebook` : 'Class · Gradebook';
  }, [course]);

  if (!token && !loading) return <Navigate to="/" replace />;
  if (!loading && gradebook && !course) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-muted">That class is not in the current gradebook.</p>
        <Link className="mt-3 inline-block font-semibold text-navy" to="/dashboard">Back to classes</Link>
      </main>
    );
  }
  if (!course || !projected) {
    return <main className="px-4 py-10 text-muted">Loading class…</main>;
  }

  const tone = TONE[gradeFamily(projected.letter)];
  const published = course.percent;
  const delta = projected.usingWhatIf && published != null && projected.percent != null
    ? projected.percent - published
    : null;
  const weightTotal = projected.categories.reduce((sum, category) => sum + (Number(category.weight) || 0), 0);

  const grouped = projected.categories.map((category) => ({
    category,
    rows: projected.assignments.filter((assignment) => assignment.category === category.name),
  }));
  const chronological = [...projected.assignments].sort((a, b) => assignmentTime(b.dueDate) - assignmentTime(a.dueDate));

  return (
    <div className="min-h-dvh pb-28">
      <header className="border-b border-line/80 bg-paper/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/dashboard" className="text-sm font-semibold text-navy">← Classes</Link>
          {projected.usingWhatIf && (
            <button type="button" className="text-sm font-semibold text-gold" onClick={() => resetCourse(course.id)}>
              Reset what-if
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        <div className={`rounded-3xl border border-l-4 bg-card p-5 ${tone.border}`}>
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted">{course.teacher}</p>
              <h1 className="font-display text-4xl leading-tight text-navy">{course.name}</h1>
              {delta != null && (
                <p className="mt-2 text-sm font-semibold text-navy">
                  {formatDelta(delta)} points from the published {formatPercent(published)}
                  {course.letter ? ` (${course.letter})` : ''}
                </p>
              )}
            </div>
            <GradeMark letter={projected.letter} percent={projected.percent} large />
          </div>
        </div>

        <section className="mt-4 rounded-3xl border border-line bg-card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl text-navy">Category weights</h2>
            <p className="text-sm text-muted">Total {weightTotal.toFixed(0)}%</p>
          </div>
          {!course.weightsPublished && (
            <p className="mt-2 text-sm text-muted">
              HAC did not publish weights for this class, so they started out equal. Change them here. Nothing is sent back to the portal.
            </p>
          )}
          <ul className="mt-4 space-y-4">
            {projected.calculated.categories.map((category) => (
              <li key={category.name}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{category.name}</p>
                    <p className="text-sm text-muted">
                      {category.possible > 0 ? `${category.earned} / ${category.possible} · ${formatPercent(category.average)}` : 'No graded points yet'}
                    </p>
                  </div>
                  <label className="text-sm font-semibold text-muted">
                    Weight
                    <input
                      className="field mt-1 w-24"
                      type="number"
                      min={0}
                      step={1}
                      aria-label={`${category.name} weight`}
                      value={category.weight}
                      onChange={(event) => setWeight(course.id, category.name, Number(event.target.value))}
                    />
                  </label>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
                  <div
                    className={`h-full rounded-full ${tone.bar}`}
                    style={{ width: `${Math.max(0, Math.min(100, category.average ?? 0))}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Weights work as a ratio, so 30 and 70 count the same as 3 and 7.</p>
        </section>

        <div className="mt-4 flex gap-2" role="group" aria-label="Assignment grouping">
          <button type="button" className={group === 'category' ? 'btn-primary' : 'btn-secondary'} aria-pressed={group === 'category'} onClick={() => setGroup('category')}>
            By category
          </button>
          <button type="button" className={group === 'date' ? 'btn-primary' : 'btn-secondary'} aria-pressed={group === 'date'} onClick={() => setGroup('date')}>
            By date
          </button>
        </div>

        {group === 'category' ? (
          <div className="mt-3 space-y-4">
            {grouped.map(({ category, rows }) => (
              <section key={category.name}>
                <h3 className="font-display text-xl text-navy">{category.name}</h3>
                <AssignmentList rows={rows} onRemove={(id) => removeMock(course.id, id)} />
              </section>
            ))}
          </div>
        ) : (
          <div className="mt-3">
            <AssignmentList rows={chronological} onRemove={(id) => removeMock(course.id, id)} />
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <button type="button" className="btn-primary w-full" onClick={() => setSheetOpen(true)}>
            Add mock assignment
          </button>
        </div>
      </div>

      {sheetOpen && (
        <WhatIfSheet
          categories={projected.categories}
          assignments={projected.assignments}
          onClose={() => setSheetOpen(false)}
          onAdd={(assignment) => addMock(course.id, assignment)}
        />
      )}
    </div>
  );
}

function AssignmentList({ rows, onRemove }: { rows: Assignment[]; onRemove: (id: string) => void }) {
  if (!rows.length) return <p className="mt-2 text-sm text-muted">No assignments in this group.</p>;
  return (
    <ul className="mt-2 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-card">
      {rows.map((assignment) => (
        <li key={assignment.id} className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="font-semibold">{assignment.name}</p>
            <p className="text-sm text-muted">
              {assignment.dueDate || 'No date'} · {assignment.category}
              {assignment.mock ? ' · Mock' : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold">{scoreLabel(assignment)}</p>
            {assignment.mock && (
              <button type="button" className="text-sm font-semibold text-f" onClick={() => onRemove(assignment.id)}>
                Remove
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
