import { Link } from 'react-router-dom';
import { GradeMark } from './GradeMark';
import { gradeFamily, TONE } from '../lib/format';
import { projectCourse } from '../lib/project';
import type { Course, CourseTweak } from '../types';

export function CourseCard({ course, tweak }: { course: Course; tweak?: CourseTweak }) {
  const projected = projectCourse(course, tweak);
  const tone = TONE[gradeFamily(projected.letter)];
  const weights = projected.categories.filter((category) => category.weight > 0);

  return (
    <Link
      to={`/class/${course.id}`}
      className={`block rounded-3xl border border-line border-l-4 bg-card p-4 shadow-[0_10px_30px_rgba(27,54,84,0.05)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${tone.border}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl leading-tight text-navy">{course.name}</h2>
          <p className="mt-1 text-sm text-muted">{course.teacher}</p>
          {course.lastUpdated && (
            <p className="mt-1 text-xs text-muted">Updated {course.lastUpdated}</p>
          )}
        </div>
        <GradeMark letter={projected.letter} percent={projected.percent} />
      </div>
      {weights.length > 0 && (
        <p className="mt-4 text-sm text-muted">
          {weights.map((category) => `${category.name} ${category.weight}%`).join(' · ')}
        </p>
      )}
      {projected.usingWhatIf && (
        <p className="mt-2 text-sm font-semibold text-gold">What-if score on this class</p>
      )}
    </Link>
  );
}
