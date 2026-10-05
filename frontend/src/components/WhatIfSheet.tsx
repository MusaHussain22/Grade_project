import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { formatPercent } from '../lib/format';
import { calculateWeightedAverage } from '../lib/grades';
import type { Assignment, Category } from '../types';

export function WhatIfSheet({
  categories,
  assignments,
  onClose,
  onAdd,
}: {
  categories: Category[];
  assignments: Assignment[];
  onClose: () => void;
  onAdd: (assignment: Assignment) => void;
}) {
  const titleId = useId();
  const [name, setName] = useState('Mock assignment');
  const [category, setCategory] = useState(categories[0]?.name ?? 'Uncategorized');
  const [score, setScore] = useState('');
  const [total, setTotal] = useState('100');
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const draft = useMemo(() => {
    const scoreValue = Number(score);
    const totalValue = Number(total);
    if (score === '' || !Number.isFinite(scoreValue) || !Number.isFinite(totalValue) || totalValue <= 0) {
      return null;
    }
    return {
      category,
      score: scoreValue,
      totalPoints: totalValue,
      status: 'graded' as const,
    };
  }, [category, score, total]);

  const preview = useMemo(() => {
    if (!draft) return null;
    return calculateWeightedAverage([...assignments, draft], categories);
  }, [assignments, categories, draft]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const scoreValue = Number(score);
    const totalValue = Number(total);
    if (!name.trim()) {
      setError('Name the mock assignment.');
      return;
    }
    if (!Number.isFinite(scoreValue) || scoreValue < 0) {
      setError('Enter a score of zero or more.');
      return;
    }
    if (!Number.isFinite(totalValue) || totalValue <= 0) {
      setError('Enter the points possible.');
      return;
    }
    onAdd({
      id: `mock-${crypto.randomUUID()}`,
      name: name.trim(),
      dueDate: date || null,
      assignedDate: null,
      score: scoreValue,
      totalPoints: totalValue,
      category,
      status: 'graded',
      mock: true,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-navy/40 p-3 sm:items-center" role="presentation">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        className="max-h-[90dvh] w-full max-w-md overflow-auto rounded-3xl bg-card p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="font-display text-3xl text-navy">Add mock assignment</h2>
            <p className="mt-1 text-sm text-muted">This stays in the browser and is never sent to HAC.</p>
          </div>
          <button type="button" className="rounded-full px-3 py-1 text-sm font-semibold text-muted" onClick={onClose}>
            Close
          </button>
        </div>

        <label className="mt-4 block text-sm font-semibold" htmlFor="mock-name">Name</label>
        <input id="mock-name" className="field" value={name} onChange={(event) => setName(event.target.value)} />

        <label className="mt-3 block text-sm font-semibold" htmlFor="mock-category">Category</label>
        <select id="mock-category" className="field" value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((item) => (
            <option key={item.name} value={item.name}>{item.name}</option>
          ))}
          {!categories.some((item) => item.name === category) && (
            <option value={category}>{category}</option>
          )}
        </select>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold" htmlFor="mock-score">Score</label>
            <input id="mock-score" inputMode="decimal" className="field" value={score} onChange={(event) => setScore(event.target.value)} autoFocus />
          </div>
          <div>
            <label className="block text-sm font-semibold" htmlFor="mock-total">Out of</label>
            <input id="mock-total" inputMode="decimal" className="field" value={total} onChange={(event) => setTotal(event.target.value)} />
          </div>
        </div>

        <label className="mt-3 block text-sm font-semibold" htmlFor="mock-date">Date</label>
        <input id="mock-date" type="date" className="field" value={date} onChange={(event) => setDate(event.target.value)} />

        {preview && (
          <p className="mt-4 rounded-2xl bg-paper px-3 py-3 text-sm">
            The class average would become <strong>{formatPercent(preview.percent)} · {preview.letter}</strong>.
          </p>
        )}
        {error && <p className="mt-3 text-sm font-semibold text-f" role="alert">{error}</p>}

        <button type="submit" className="btn-primary mt-4 w-full">Add to this class</button>
      </form>
    </div>
  );
}
