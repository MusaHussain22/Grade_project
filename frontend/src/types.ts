export type AssignmentStatus = 'graded' | 'missing' | 'excused' | 'pending';

export type Assignment = {
  id: string;
  name: string;
  dueDate: string | null;
  assignedDate: string | null;
  score: number | null;
  totalPoints: number | null;
  category: string;
  status: AssignmentStatus;
  mock: boolean;
};

export type Category = {
  name: string;
  weight: number;
  publishedAverage: number | null;
};

export type Course = {
  id: string;
  name: string;
  teacher: string;
  percent: number | null;
  letter: string | null;
  lastUpdated: string | null;
  categories: Category[];
  assignments: Assignment[];
  weightsPublished: boolean;
};

export type Gradebook = {
  studentName: string;
  fetchedAt: string;
  source: 'hac' | 'demo';
  courses: Course[];
  warning: string | null;
};

export type CourseTweak = {
  assignments: Assignment[];
  weights: Record<string, number>;
};

export type WhatIfMap = Record<string, CourseTweak>;

export type SessionResponse = {
  token: string;
  studentName: string;
  demo: boolean;
};
