"use client";

import PermissionGuard from "@/app/components/PermissionGuard";

export default function LegacyCadCasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionGuard module="cad_cases_old" action="view" showMessage>
      {children}
    </PermissionGuard>
  );
}
