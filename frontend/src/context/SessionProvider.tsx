import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { demoRequest, gradesRequest, loginRequest, logoutRequest } from '../lib/api';
import type { Assignment, Gradebook, WhatIfMap } from '../types';
import { SessionContext, type SessionContextValue } from './sessionContext';

const TOKEN_KEY = 'hac.token';
const WHATIF_KEY = 'hac.whatIf';
const CACHE_KEY = 'hac.gradebook.last';

function readWhatIf(): WhatIfMap {
  try {
    return JSON.parse(sessionStorage.getItem(WHATIF_KEY) || '{}') as WhatIfMap;
  } catch {
    return {};
  }
}

function readCache(): Gradebook | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) as Gradebook : null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [studentName, setStudentName] = useState('Student');
  const [demo, setDemo] = useState(false);
  const [gradebook, setGradebook] = useState<Gradebook | null>(null);
  const [whatIf, setWhatIf] = useState<WhatIfMap>(() => readWhatIf());
  const [loading, setLoading] = useState(() => Boolean(sessionStorage.getItem(TOKEN_KEY)));
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sessionStorage.setItem(WHATIF_KEY, JSON.stringify(whatIf));
  }, [whatIf]);

  const clearLocalSession = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(WHATIF_KEY);
    localStorage.removeItem(CACHE_KEY);
    setToken(null);
    setGradebook(null);
    setDemo(false);
    setWhatIf({});
    setFromCache(false);
    setLoading(false);
  }, []);

  const loadGrades = useCallback(async (activeToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await gradesRequest(activeToken);
      setGradebook(data);
      setStudentName(data.studentName);
      setDemo(data.source === 'demo');
      setFromCache(false);
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not load grades.';
      const status = typeof caught === 'object' && caught && 'status' in caught ? Number(caught.status) : 0;
      if (status === 401) {
        clearLocalSession();
        setError(message);
        return;
      }
      const cached = readCache();
      if (cached) {
        setGradebook(cached);
        setStudentName(cached.studentName);
        setDemo(cached.source === 'demo');
        setFromCache(true);
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [clearLocalSession]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (!cancelled) await loadGrades(token);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, loadGrades]);

  const applySession = useCallback((next: { token: string; studentName: string; demo: boolean }) => {
    sessionStorage.setItem(TOKEN_KEY, next.token);
    setStudentName(next.studentName);
    setDemo(next.demo);
    setError(null);
    setToken(next.token);
  }, []);

  const login = useCallback(async (input: { username: string; password: string; portalUrl: string }) => {
    setError(null);
    const session = await loginRequest(input);
    applySession(session);
  }, [applySession]);

  const loginDemo = useCallback(async () => {
    setError(null);
    const session = await demoRequest();
    applySession(session);
  }, [applySession]);

  const logout = useCallback(async () => {
    try {
      await logoutRequest(token);
    } catch {
      // The local session still needs to disappear if the API is offline.
    }
    clearLocalSession();
  }, [token, clearLocalSession]);

  const refresh = useCallback(async () => {
    if (token) await loadGrades(token);
  }, [token, loadGrades]);

  const addMock = useCallback((courseId: string, assignment: Assignment) => {
    setWhatIf((current) => {
      const tweak = current[courseId] ?? { assignments: [], weights: {} };
      return {
        ...current,
        [courseId]: { ...tweak, assignments: [...tweak.assignments, assignment] },
      };
    });
  }, []);

  const removeMock = useCallback((courseId: string, assignmentId: string) => {
    setWhatIf((current) => {
      const tweak = current[courseId];
      if (!tweak) return current;
      return {
        ...current,
        [courseId]: {
          ...tweak,
          assignments: tweak.assignments.filter((assignment) => assignment.id !== assignmentId),
        },
      };
    });
  }, []);

  const setWeight = useCallback((courseId: string, category: string, weight: number) => {
    setWhatIf((current) => {
      const tweak = current[courseId] ?? { assignments: [], weights: {} };
      return {
        ...current,
        [courseId]: {
          ...tweak,
          weights: { ...tweak.weights, [category]: weight },
        },
      };
    });
  }, []);

  const resetCourse = useCallback((courseId: string) => {
    setWhatIf((current) => {
      const next = { ...current };
      delete next[courseId];
      return next;
    });
  }, []);

  const value = useMemo<SessionContextValue>(() => ({
    token,
    studentName,
    demo,
    gradebook,
    whatIf,
    loading,
    fromCache,
    error,
    login,
    loginDemo,
    logout,
    refresh,
    addMock,
    removeMock,
    setWeight,
    resetCourse,
  }), [
    token, studentName, demo, gradebook, whatIf, loading, fromCache, error,
    login, loginDemo, logout, refresh, addMock, removeMock, setWeight, resetCourse,
  ]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
