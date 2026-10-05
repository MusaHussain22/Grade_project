import { createContext } from 'react';
import type { Assignment, Gradebook, WhatIfMap } from '../types';

export type SessionContextValue = {
  token: string | null;
  studentName: string;
  demo: boolean;
  gradebook: Gradebook | null;
  whatIf: WhatIfMap;
  loading: boolean;
  fromCache: boolean;
  error: string | null;
  login: (input: { username: string; password: string; portalUrl: string }) => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  addMock: (courseId: string, assignment: Assignment) => void;
  removeMock: (courseId: string, assignmentId: string) => void;
  setWeight: (courseId: string, category: string, weight: number) => void;
  resetCourse: (courseId: string) => void;
};

export const SessionContext = createContext<SessionContextValue | null>(null);
