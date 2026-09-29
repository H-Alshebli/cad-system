"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function ReviewNotificationInbox() {
  const { user } = useCurrentUser();
  const [state, setState] = useState<{ uid: string; items: any[]; error: boolean }>({ uid: "", items: [], error: false });
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const uid = user?.uid;
    if (!uid || user.active !== true || user.accountType === "client") return;
    let live = true;
    return (() => {
      const stop = onSnapshot(query(collection(db, "users", uid, "reviewNotifications"), orderBy("createdAt", "desc"), limit(30)), snap => {
        if (live) setState({ uid, items: snap.docs.map(d => ({ ...d.data(), id: d.id })), error: false });
      }, () => { if (live) setState({ uid, items: [], error: true }); });
      return () => { live = false; stop(); };
    })();
  }, [user?.uid, user?.active, user?.accountType]);
  if (!user?.uid || user.active !== true || user.accountType === "client") return null;
  const items = state.uid === user.uid ? state.items : [];
  return <div className="relative mb-3 flex justify-end">
    <button type="button" className="btn-secondary" aria-expanded={open} onClick={() => setOpen(v => !v)}>Review notifications ({items.filter(n => !n.read).length})</button>
    {open && <section aria-label="Review notifications" className="absolute right-0 top-full z-40 mt-2 max-h-96 w-[min(24rem,85vw)] overflow-auto rounded-xl border bg-white p-4 shadow-xl">
      <h2 className="font-bold">Latest review notifications</h2>
      {state.uid === user.uid && state.error ? <p role="alert">Notifications could not be loaded.</p> : items.length === 0 ? <p>No review notifications yet.</p> : items.map(n => <div key={n.id} className="my-3 border-b pb-3">
        <Link href={n.link} className="font-semibold underline">{n.title}</Link>
        {!n.read && <button type="button" className="ml-2 text-sm" onClick={() => updateDoc(doc(db, "users", user.uid, "reviewNotifications", n.id), { read: true }).catch(() => setState(s => ({ ...s, error: true })))}>Mark read</button>}
      </div>)}
    </section>}
  </div>;
}
