import { calculateWeightedAverage } from './grades';
import type { Course, CourseTweak } from '../types';

export function projectCourse(course: Course, tweak?: CourseTweak) {
  const categories = course.categories.map((category) => ({
    ...category,
    weight: tweak?.weights[category.name] ?? category.weight,
  }));
  const assignments = [...course.assignments, ...(tweak?.assignments ?? [])];
  const calculated = calculateWeightedAverage(assignments, categories);
  const usingWhatIf = Boolean(
    tweak && (tweak.assignments.length > 0 || Object.keys(tweak.weights).length > 0),
  );

  return {
    calculated,
    categories,
    assignments,
    usingWhatIf,
    percent: usingWhatIf ? calculated.percent : (course.percent ?? calculated.percent),
    letter: usingWhatIf ? calculated.letter : (course.letter ?? calculated.letter),
  };
}
