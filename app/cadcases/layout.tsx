"use client";

import PermissionGuard from "@/app/components/PermissionGuard";

export default function ModernCadCasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionGuard module="cad_cases_new" action="view" showMessage>
      {children}
    </PermissionGuard>
  );
}
