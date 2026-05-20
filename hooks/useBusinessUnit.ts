'use client';

import { useContext } from 'react';

import { BusinessUnitContext } from '@/components/providers/BusinessUnitProvider';

export function useBusinessUnit() {
  const ctx = useContext(BusinessUnitContext);
  if (!ctx) {
    throw new Error('useBusinessUnit must be used inside a <BusinessUnitProvider>');
  }
  return ctx;
}
