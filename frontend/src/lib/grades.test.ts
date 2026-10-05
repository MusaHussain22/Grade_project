import { describe, expect, it } from 'vitest';
import { averageGpa, calculateWeightedAverage, letterFromPercent } from './grades';
import { projectCourse } from './project';
import type { Course } from '../types';

const history: Course = {
  id: 'wh-world-history-3',
  name: 'WH - World History',
  teacher: 'Ms. Brooks',
  percent: 56.5,
  letter: 'F',
  lastUpdated: null,
  weightsPublished: true,
  categories: [
    { name: 'Formative', weight: 30, publishedAverage: 60 },
    { name: 'Summative', weight: 70, publishedAverage: 55 },
  ],
  assignments: [
    {
      id: 'map',
      name: 'Map check',
      dueDate: '09/22/2026',
      assignedDate: null,
      score: 12,
      totalPoints: 20,
      category: 'Formative',
      status: 'graded',
      mock: false,
    },
    {
      id: 'essay',
      name: 'Empire essay',
      dueDate: '10/04/2026',
      assignedDate: null,
      score: 55,
      totalPoints: 100,
      category: 'Summative',
      status: 'graded',
      mock: false,
    },
  ],
};

describe('client grade math', () => {
  it('keeps the published grade until a mock assignment is added', () => {
    const projected = projectCourse(history);
    expect(projected.percent).toBe(56.5);
    expect(projected.letter).toBe('F');
    expect(projected.usingWhatIf).toBe(false);
  });

  it('recalculates the weighted average without mutating the course', () => {
    const projected = projectCourse(history, {
      weights: {},
      assignments: [{
        id: 'mock-1',
        name: 'Retake',
        dueDate: '10/20/2026',
        assignedDate: null,
        score: 100,
        totalPoints: 100,
        category: 'Summative',
        status: 'graded',
        mock: true,
      }],
    });
    expect(projected.percent).toBe(72.25);
    expect(projected.letter).toBe('C-');
    expect(history.assignments).toHaveLength(2);
    expect(averageGpa(['A', 'B', 'C', projected.letter, 'A'])).toBe(2.94);
  });

  it('uses a weight override as a ratio', () => {
    const shifted = calculateWeightedAverage(history.assignments, [
      { name: 'Formative', weight: 3 },
      { name: 'Summative', weight: 7 },
    ]);
    expect(shifted.percent).toBe(56.5);
    expect(letterFromPercent(100)).toBe('A+');
    expect(letterFromPercent(59)).toBe('F');
  });
});
