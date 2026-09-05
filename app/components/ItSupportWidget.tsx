"use client";

import { useEffect, useState } from "react";
import { Headphones, MoveHorizontal, TicketCheck, X } from "lucide-react";

import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";
import { isClientAccount } from "@/lib/userAccounts";

const IT_TICKETING_URL =
  process.env.NEXT_PUBLIC_IT_TICKETING_URL ||
  "https://lazem-it-ticketing.vercel.app/tickets/new";

export default function ItSupportWidget() {
  const [open, setOpen] = useState(false);
  const [dockSide, setDockSide] = useState<"left" | "right">("right");
  const { user, loading: userLoading } = useCurrentUser();
  const { can, isAdmin, loading: permissionsLoading } = usePermissions(user?.role);

  useEffect(() => {
    const saved = window.localStorage.getItem("hcad-it-support-dock");
    if (saved === "left" || saved === "right") {
      setDockSide(saved);
      return;
    }
    setDockSide(window.matchMedia("(max-width: 1023px)").matches ? "left" : "right");
  }, []);

  function moveToOtherSide() {
    setDockSide((current) => {
      const next = current === "right" ? "left" : "right";
      window.localStorage.setItem("hcad-it-support-dock", next);
      return next;
    });
  }

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
    <div
      className={`fixed bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-[80] flex max-w-[calc(100vw-1.5rem)] flex-col gap-3 lg:bottom-5 ${
        dockSide === "left" ? "left-3 items-start lg:left-5" : "right-3 items-end lg:right-5"
      }`}
    >
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
            <button
              type="button"
              onClick={moveToOtherSide}
              className="ml-2 mt-4 inline-flex items-center gap-2 rounded-xl border border-[#86A7B2]/35 bg-white px-3 py-2.5 text-sm font-black text-[#274C5A] transition hover:bg-[#eef5f7]"
            >
              <MoveHorizontal size={16} />
              Move to {dockSide === "right" ? "left" : "right"}
            </button>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-[#86A7B2]/35 bg-white text-[#274C5A] shadow-xl transition hover:-translate-y-0.5 hover:bg-[#f5f9fa] lg:h-16 lg:w-16"
        aria-label={open ? "Close IT support" : "Open IT support"}
        aria-expanded={open}
      >
        <Headphones className="h-6 w-6 lg:h-7 lg:w-7" strokeWidth={1.9} />
      </button>
    </div>
  );
}
