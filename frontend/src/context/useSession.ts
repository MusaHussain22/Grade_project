import { useContext } from 'react';
import { SessionContext } from './sessionContext';

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
