"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

/* =========================
   TYPES
========================= */
type SenderRole = string; // أي دور


type ChatMessage = {
  id: string;
  message: string;
  senderId: string;
  senderRole: SenderRole;
  senderName: string;
  createdAt?: any;
};
type AppUser = {
  name?: string;
  role?: string;   // أي role من النظام
  active?: boolean;
};


/* =========================
   HELPERS
========================= */
function formatDate(ts: any) {
  if (!ts) return "";

  const date = ts?.seconds
    ? new Date(ts.seconds * 1000)
    : new Date(ts);

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* =========================
   CASE CHAT
========================= */
export default function CaseChat({
  caseId,
  disabled = false,
}: {
  caseId: string;
  disabled?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");

  const [uid, setUid] = useState<string | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);

const messagesBoxRef = useRef<HTMLDivElement>(null);
  /* -------------------------
     AUTH + LOAD USER
  -------------------------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUid(null);
        setUser(null);
        return;
      }

      setUid(u.uid);

      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) {
          setUser(snap.data() as AppUser);
        } else {
          setUser({
            name: u.displayName || "User",
            role: "dispatcher",
            active: true,
          });
        }
      } catch (e) {
        console.error("Failed to load user doc:", e);
        setUser({
          name: u.displayName || "User",
          role: "dispatcher",
          active: true,
        });
      }
    });

    return () => unsub();
  }, []);

  /* -------------------------
     LOAD CHAT
  -------------------------- */
  useEffect(() => {
    if (!caseId) return;

    const q = query(
      collection(db, "cases", caseId, "chat"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ChatMessage, "id">),
        }))
      );
    });

    return () => unsub();
  }, [caseId]);

  /* -------------------------
     AUTO SCROLL
  -------------------------- */
useEffect(() => {
  if (messages.length === 0) return;

  const box = messagesBoxRef.current;
  if (!box) return;

  box.scrollTop = box.scrollHeight;
}, [messages.length]);

  /* -------------------------
     DISABLE LOGIC (FIXED)
  -------------------------- */
const effectiveDisabled =
  disabled ||
  !uid ||
  !user ||
  user.active === false;


  /* -------------------------
     SEND MESSAGE
  -------------------------- */
  async function sendMessage() {
  if (!text.trim() || effectiveDisabled) return;

  try {
    await addDoc(collection(db, "cases", caseId, "chat"), {
      message: text.trim(),
      senderId: uid!,
      senderName: user?.name || "Unknown User",
      senderRole: user?.role || "unknown",
      createdAt: serverTimestamp(),
    });

    setText("");
  } catch (err) {
    console.error("Chat send failed:", err);
    alert("Failed to send message");
  }
}


  return (
    <div className="flex h-[380px] flex-col rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-black text-[#274C5A]">
          Case Chat
        </h2>

        {!uid ? (
          <span className="text-xs font-semibold text-[#7F7F7F]">
            Not signed in
          </span>
        ) : user?.active === false ? (
          <span className="text-xs font-semibold text-red-700">
            Inactive user
          </span>
        ) : user ? (
          <span className="text-xs font-semibold text-[#7F7F7F]">
            {user.name} • {user.role}
          </span>
        ) : (
          <span className="text-xs font-semibold text-[#7F7F7F]">
            Loading user…
          </span>
        )}
      </div>

      {/* MESSAGES */}
      <div ref={messagesBoxRef} className="flex-1 overflow-y-auto space-y-3 pr-2">
        {messages.length === 0 && (
          <div className="mt-10 text-center text-sm font-semibold text-[#7F7F7F]">
            No messages yet
          </div>
        )}

        {messages.map((m) => {
          const isMe = uid === m.senderId;

          return (
            <div
              key={m.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 shadow ${
                  isMe
                    ? "bg-[#274C5A] text-white"
                    : "border border-[#86A7B2]/25 bg-[#f8fbfc] text-[#274C5A]"
                }`}
              >
                <div className="flex justify-between text-[11px] opacity-80 mb-1">
                  <span className="font-semibold">
                    {m.senderName} ({m.senderRole})
                  </span>
                  <span>{formatDate(m.createdAt)}</span>
                </div>
                <div className="text-sm break-words">
                  {m.message}
                </div>
              </div>
            </div>
          );
        })}

      </div>

      {/* INPUT */}
      <div className="mt-3 flex gap-2">
        <textarea
          value={text}
          disabled={effectiveDisabled}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            !uid
              ? "Sign in to chat..."
              : user?.active === false
              ? "User inactive..."
              : disabled
              ? "Chat is disabled"
              : "Type message..."
          }
          rows={1}
          className="flex-1 px-4 py-2 rounded-xl resize-none
            bg-white text-[#274C5A] border border-[#86A7B2]/35
            focus:border-[#274C5A] focus:outline-none focus:ring-4 focus:ring-[#274C5A]/10
            disabled:opacity-50"
        />

        <button
          onClick={sendMessage}
          disabled={effectiveDisabled}
          className="rounded-xl bg-[#274C5A] px-4 font-bold text-white hover:bg-[#1f3f4c] disabled:bg-[#7F7F7F]"
        >
          Send
        </button>
      </div>
    </div>
  );
}
