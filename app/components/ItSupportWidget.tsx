"use client";

import { useState } from "react";
import { Headphones, TicketCheck, X } from "lucide-react";

import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";
import { isClientAccount } from "@/lib/userAccounts";

const IT_TICKETING_URL =
  process.env.NEXT_PUBLIC_IT_TICKETING_URL ||
  "https://lazem-it-ticketing.vercel.app/";

export default function ItSupportWidget() {
  const [open, setOpen] = useState(false);
  const { user, loading: userLoading } = useCurrentUser();
  const { can, isAdmin, loading: permissionsLoading } = usePermissions(user?.role);

  if (
    userLoading ||
    permissionsLoading ||
    !user ||
    isClientAccount(user) ||
    (!isAdmin && !can("it_support", "view"))
  ) {
    return null;
  }

  return (
    <div className="fixed bottom-16 right-4 z-[80] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 sm:bottom-5 sm:right-5">
      {open && (
        <section className="relative w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#86A7B2]/35 bg-gradient-to-br from-white via-[#f7fbfc] to-[#dff0f4] p-5 text-[#274C5A] shadow-2xl">
          <div className="absolute -right-8 -top-9 h-28 w-28 rounded-full bg-[#86A7B2]/15" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 z-10 rounded-full border border-[#86A7B2]/25 bg-white/85 p-1.5 text-[#607482] transition hover:text-[#274C5A]"
            aria-label="Close IT support"
          >
            <X size={15} />
          </button>

          <div className="relative pr-7">
            <div className="flex items-center gap-2 text-lg font-black">
              <Headphones size={21} />
              Need IT help?
            </div>
            <p className="mt-2 text-sm font-medium leading-5 text-[#637982]">
              Report a technical issue or request support from the IT team.
            </p>
            <a
              href={IT_TICKETING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#274C5A] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-[#1f3f4c]"
            >
              <TicketCheck size={17} />
              Create Ticket
            </a>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-14 w-14 items-center justify-center rounded-full border border-[#86A7B2]/35 bg-white text-[#274C5A] shadow-xl transition hover:-translate-y-0.5 hover:bg-[#f5f9fa] sm:h-16 sm:w-16"
        aria-label={open ? "Close IT support" : "Open IT support"}
        aria-expanded={open}
      >
        <Headphones size={28} strokeWidth={1.9} />
      </button>
    </div>
  );
}
