"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* =========================
   HELPERS
========================= */
function formatDate(ts: any) {
  if (!ts) return "";

  const date =
    ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);

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
  role,
  senderName,
}: {
  caseId: string;
  role: "dispatcher" | "medical" | "supervisor";
  senderName: string;
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");

  /* -------------------------
     REALTIME LISTENER
  -------------------------- */
  useEffect(() => {
    if (!caseId) return;

    const q = query(
      collection(db, "cases", caseId, "chat"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [caseId]);

  /* -------------------------
     SEND MESSAGE
  -------------------------- */
  async function sendMessage() {
    if (!text.trim()) return;

    await addDoc(collection(db, "cases", caseId, "chat"), {
      message: text.trim(),
      senderRole: role,
      senderName,
      createdAt: serverTimestamp(),
    });

    setText("");
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex flex-col h-[380px]">
      <h2 className="text-sm font-semibold text-gray-200 mb-2">
        Case Chat
      </h2>

      {/* =======================
          MESSAGES
      ======================== */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">

        {messages.length === 0 && (
          <div className="text-sm text-gray-400 text-center mt-10">
            No messages yet
          </div>
        )}

        {messages.map((m) => {
          const isMe = m.senderRole === role;

          return (
            <div
              key={m.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 shadow
                  ${
                    isMe
                      ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white"
                      : "bg-slate-800 text-gray-100 border border-slate-700"
                  }`}
              >
                {/* HEADER */}
                <div className="flex items-center justify-between mb-1 text-[11px] opacity-80">
                  <span className="font-semibold tracking-wide">
                    {m.senderName}
                  </span>
                  <span className="ml-3">
                    {formatDate(m.createdAt)}
                  </span>
                </div>

                {/* MESSAGE */}
                <div className="text-sm leading-relaxed break-words">
                  {m.message}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* =======================
          INPUT
      ======================== */}
      <div className="flex gap-2 mt-3">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          placeholder="Type message..."
          rows={1}
          className="flex-1 px-4 py-2 rounded-xl resize-none
            bg-slate-800 text-white
            border border-slate-700
            focus:outline-none focus:ring-2 focus:ring-blue-600
            max-h-32 overflow-y-auto"
        />

        <button
          onClick={sendMessage}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-xl"
        >
          Send
        </button>
      </div>
    </div>
  );
}
