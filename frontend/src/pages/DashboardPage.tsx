import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { CourseCard } from '../components/CourseCard';
import { GpaWidget } from '../components/GpaWidget';
import { InstallButton } from '../components/InstallButton';
import { useSession } from '../context/useSession';
import { formatWhen } from '../lib/format';

export function DashboardPage() {
  const { token, studentName, demo, gradebook, whatIf, loading, fromCache, error, logout, refresh } = useSession();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    document.title = `${studentName} · Gradebook`;
  }, [studentName]);

  if (!token && !loading) return <Navigate to="/" replace />;

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.16em] text-gold uppercase">
              {demo ? 'Sample gradebook' : 'Home Access'}
            </p>
            <h1 className="truncate font-display text-3xl text-navy">{studentName}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <InstallButton />
            <button type="button" className="btn-secondary" onClick={() => void onRefresh()} disabled={refreshing || loading}>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => void logout()}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-4 pb-16">
        {fromCache && (
          <p className="mb-4 rounded-2xl bg-c-soft px-4 py-3 text-sm text-c" role="status">
            Showing the last gradebook saved on this device.
          </p>
        )}
        {error && (
          <p className="mb-4 rounded-2xl bg-f-soft px-4 py-3 text-sm text-f" role="alert">{error}</p>
        )}
        {loading && !gradebook && (
          <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-3xl bg-line/70" />
            ))}
          </div>
        )}
        {gradebook && gradebook.warning === 'no-courses' && (
          <section className="rounded-3xl border border-line bg-card p-5">
            <h2 className="font-display text-3xl text-navy">No published classes</h2>
            <p className="mt-2 text-muted">
              The sign-in worked, but the gradebook page did not include any class tables this app recognizes.
            </p>
          </section>
        )}
        {gradebook && gradebook.courses.length > 0 && (
          <>
            <GpaWidget courses={gradebook.courses} whatIf={whatIf} />
            <p className="mt-4 text-sm text-muted">
              {demo ? 'Sample data parsed from a Home Access classwork page. ' : 'Published averages from your portal. '}
              Updated {formatWhen(gradebook.fetchedAt)}.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {gradebook.courses.map((course) => (
                <CourseCard key={course.id} course={course} tweak={whatIf[course.id]} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
