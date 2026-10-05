export function round2(value: number): number;

export function letterFromPercent(percent: number | null): string | null;

export function gpaPoints(letter: string | null): number | null;

export function averageGpa(letters: Array<string | null>): number | null;

export function calculateWeightedAverage(
  assignments: Array<{
    score: number | null;
    totalPoints: number | null;
    category?: string;
    status?: string;
  }>,
  categories: Array<{ name: string; weight: number }>,
): {
  categories: Array<{
    name: string;
    weight: number;
    earned: number;
    possible: number;
    average: number | null;
  }>;
  percent: number | null;
  letter: string | null;
  weightSum: number;
};
