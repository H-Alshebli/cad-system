"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";

type PermissionGuardProps = {
  module: string;
  action?: string;
  redirectTo?: string;
  showMessage?: boolean;
  children: ReactNode;
};

export default function PermissionGuard({
  module,
  action = "view",
  redirectTo = "/",
  showMessage = false,
  children,
}: PermissionGuardProps) {
  const router = useRouter();

  const { user, loading: userLoading } = useCurrentUser();
  const role = user?.role ?? "none";

  const { can, loading: permLoading, isAdmin } = usePermissions(role);

  const loading = userLoading || permLoading;
  const allowed = !!user && (isAdmin || can(module, action));

  useEffect(() => {
    if (!loading && !allowed && !showMessage) {
      router.replace(redirectTo);
    }
  }, [loading, allowed, showMessage, router, redirectTo]);

  if (loading) return null;

  if (!allowed && showMessage) {
    return (
      <div className="min-h-screen bg-[#030712] p-6 text-white">
        <div className="rounded-2xl border border-red-800 bg-red-950/30 p-6">
          <h1 className="text-2xl font-bold text-red-300">
            Unauthorized Access
          </h1>

          <p className="mt-2 text-sm text-red-100">
            Only authorized people can access this page.
          </p>
        </div>
      </div>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
}