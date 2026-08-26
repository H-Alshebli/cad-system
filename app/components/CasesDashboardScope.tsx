"use client";

import { createContext, useContext } from "react";

type CasesDashboardScopeValue = {
  projectId?: string;
  embedded?: boolean;
};

const CasesDashboardScopeContext = createContext<CasesDashboardScopeValue>({});

export function CasesDashboardScope({
  projectId,
  embedded = false,
  children,
}: CasesDashboardScopeValue & { children: React.ReactNode }) {
  return (
    <CasesDashboardScopeContext.Provider value={{ projectId, embedded }}>
      {children}
    </CasesDashboardScopeContext.Provider>
  );
}

export function useCasesDashboardScope() {
  return useContext(CasesDashboardScopeContext);
}
