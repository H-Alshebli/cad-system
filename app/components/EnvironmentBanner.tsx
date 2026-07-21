"use client";

import { getEnvironmentLabel, isSandboxEnvironment } from "@/lib/environment";

export default function EnvironmentBanner() {
  if (!isSandboxEnvironment()) {
    return null;
  }

  return (
    <div className="border-b border-amber-400/30 bg-amber-500/15 px-4 py-2 text-center text-xs font-black uppercase tracking-[0.18em] text-amber-800 dark:text-amber-200">
      {getEnvironmentLabel()} Environment - Test Data Only
    </div>
  );
}
