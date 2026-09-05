"use client";

import {
  getEnvironmentLabel,
  isProductionPreviewEnvironment,
  isSandboxEnvironment,
} from "@/lib/environment";

export default function EnvironmentBanner() {
  const isProductionPreview = isProductionPreviewEnvironment();

  if (!isSandboxEnvironment() && !isProductionPreview) {
    return null;
  }

  return (
    <div
      className={`border-b px-4 py-2 text-center text-xs font-black uppercase tracking-[0.18em] ${
        isProductionPreview
          ? "border-rose-700 bg-rose-600 text-white"
          : "border-amber-400/30 bg-amber-500/15 text-amber-800 dark:text-amber-200"
      }`}
    >
      {isProductionPreview
        ? `${getEnvironmentLabel()} - Live Records`
        : `${getEnvironmentLabel()} Environment - Test Data Only`}
    </div>
  );
}
