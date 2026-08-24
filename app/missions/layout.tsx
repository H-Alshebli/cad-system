"use client";

import PermissionGuard from "@/app/components/PermissionGuard";

export default function MissionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PermissionGuard module="missions" action="view" showMessage>
      {children}
    </PermissionGuard>
  );
}
