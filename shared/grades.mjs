/**
 * Shared grade math for the API and the browser.
 * What-if scores stay on the client; this module never talks to the network.
 */

const LETTER_BANDS = [
  [97, 'A+'],
  [93, 'A'],
  [90, 'A-'],
  [87, 'B+'],
  [83, 'B'],
  [80, 'B-'],
  [77, 'C+'],
  [73, 'C'],
  [70, 'C-'],
  [67, 'D+'],
  [63, 'D'],
  [60, 'D-'],
];

export const GPA_POINTS = {
  'A+': 4,
  A: 4,
  'A-': 3.7,
  'B+': 3.3,
  B: 3,
  'B-': 2.7,
  'C+': 2.3,
  C: 2,
  'C-': 1.7,
  'D+': 1.3,
  D: 1,
  'D-': 0.7,
  F: 0,
};

export function round2(value) {
  return Math.round(value * 100) / 100;
}

export function letterFromPercent(percent) {
  if (percent == null || Number.isNaN(Number(percent))) return null;
  const value = Number(percent);
  for (const [minimum, letter] of LETTER_BANDS) {
    if (value >= minimum) return letter;
  }
  return 'F';
}

export function gpaPoints(letter) {
  if (!letter) return null;
  const key = String(letter).toUpperCase().replace(/\s/g, '');
  return Object.prototype.hasOwnProperty.call(GPA_POINTS, key) ? GPA_POINTS[key] : null;
}

export function averageGpa(letters) {
  const points = letters.map((letter) => gpaPoints(letter)).filter((value) => value != null);
  if (!points.length) return null;
  return round2(points.reduce((sum, value) => sum + value, 0) / points.length);
}

function countsTowardAverage(assignment) {
  if (!assignment) return false;
  if (assignment.status === 'excused' || assignment.status === 'pending') return false;
  const total = Number(assignment.totalPoints);
  if (!Number.isFinite(total) || total <= 0) return false;
  if (assignment.status === 'missing') return true;
  return assignment.score != null && Number.isFinite(Number(assignment.score));
}

/**
 * Category percent is points earned divided by points possible.
 * The course percent is the weighted mean of those category percents.
 */
export function calculateWeightedAverage(assignments, categories) {
  const groups = new Map();
  for (const category of categories || []) {
    groups.set(category.name, {
      name: category.name,
      weight: Number(category.weight) || 0,
      earned: 0,
      possible: 0,
    });
  }

  for (const assignment of assignments || []) {
    if (!countsTowardAverage(assignment)) continue;
    const name = assignment.category || 'Uncategorized';
    if (!groups.has(name)) {
      groups.set(name, { name, weight: 0, earned: 0, possible: 0 });
    }
    const group = groups.get(name);
    const score = assignment.status === 'missing' ? 0 : Number(assignment.score);
    const total = Number(assignment.totalPoints);
    group.earned += score;
    group.possible += total;
  }

  const detailed = [...groups.values()].map((group) => ({
    ...group,
    earned: round2(group.earned),
    possible: round2(group.possible),
    average: group.possible > 0 ? (group.earned / group.possible) * 100 : null,
  }));

  let weighted = 0;
  let weightSum = 0;
  for (const group of detailed) {
    if (group.average == null || group.weight <= 0) continue;
    weighted += group.average * group.weight;
    weightSum += group.weight;
  }

  const precise = weightSum > 0 ? weighted / weightSum : null;
  return {
    categories: detailed,
    percent: precise == null ? null : round2(precise),
    letter: precise == null ? null : letterFromPercent(precise),
    weightSum: round2(weightSum),
  };
}
