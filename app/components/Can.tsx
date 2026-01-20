"use client";

import { ReactNode } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";

type CanProps = {
  permission: string; // مثال: "cases.view"
  children: ReactNode;
};

export default function Can({ permission, children }: CanProps) {
  const { user, loading: userLoading } = useCurrentUser();
  const { permissions, loading: permLoading } = usePermissions(user?.role);

  // ⏳ انتظر تحميل المستخدم والصلاحيات
  if (userLoading || permLoading) {
    return null;
  }

  // 🔒 لا يوجد مستخدم
  if (!user) {
    console.warn("❌ Can: no user");
    return null;
  }

  // 🧩 صيغة صلاحية خاطئة
  if (!permission.includes(".")) {
    console.warn("❌ Can: invalid permission format:", permission);
    return null;
  }

  const [module, action] = permission.split(".");

  const allowed = Boolean(permissions?.[module]?.[action]);

  // 🔍 DEBUG LOG (كما طلبت)
  console.log("Can check:", {
    permission,
    module,
    action,
    permissions,
    allowed,
  });

  // 🚫 غير مسموح
  if (!allowed) {
    return null;
  }

  // ✅ مسموح
  return <>{children}</>;
}
