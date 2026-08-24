"use client";

import PermissionGuard from "@/app/components/PermissionGuard";

export default function MissionsPlusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionGuard module="missions_plus" action="view" showMessage>
      {children}
    </PermissionGuard>
  );
}
