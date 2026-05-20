'use client';

import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';

export type BU = { key: string; name: string; color: string };

export type BusinessUnitContextValue = {
  currentBU: string;
  setCurrentBU: (bu: string) => void;
  businessUnits: BU[];
};

export const BusinessUnitContext = createContext<BusinessUnitContextValue | null>(null);

const STORAGE_KEY = 'instapath:currentBU';

type Props = {
  children: ReactNode;
  businessUnits: BU[];
  defaultBU: string;
};

export function BusinessUnitProvider({ children, businessUnits, defaultBU }: Props) {
  const [currentBU, setCurrentBUState] = useState<string>(defaultBU);

  // Hydrate from localStorage on mount — but only if the saved value is still
  // a BU this user can see (admin permissions might have changed).
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!saved) return;
    const isValid = saved === 'all' || businessUnits.some((bu) => bu.key === saved);
    if (isValid) setCurrentBUState(saved);
  }, [businessUnits]);

  const setCurrentBU = useCallback((bu: string) => {
    setCurrentBUState(bu);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, bu);
  }, []);

  return (
    <BusinessUnitContext.Provider value={{ currentBU, setCurrentBU, businessUnits }}>
      {children}
    </BusinessUnitContext.Provider>
  );
}
