"use client";

import { createContext, useContext } from "react";

const ChecklistReviewScopeContext = createContext({ allProjects: false });

export function ChecklistReviewScope({
  allProjects,
  children,
}: {
  allProjects: boolean;
  children: React.ReactNode;
}) {
  return (
    <ChecklistReviewScopeContext.Provider value={{ allProjects }}>
      {children}
    </ChecklistReviewScopeContext.Provider>
  );
}

export function useChecklistReviewScope() {
  return useContext(ChecklistReviewScopeContext);
}
