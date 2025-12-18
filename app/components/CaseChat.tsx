"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ✅ ضع الدالة هنا (خارج الـ component) */
function formatDate(ts: any) {
  if (!ts) return "";

  const date =
    ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);

  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* =========================
   CASE CHAT COMPONENT
========================= */
export default function CaseChat({
  caseId,
  role,
  senderName,
}: {
  caseId: string;
  role: "dispatcher" | "medical";
  senderName: string;
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");

  // باقي الكود...



useEffect(() => {
  if (!caseId) return; // 🔑 مهم جدًا

  console.log("Listening to chat for caseId:", caseId);

  const q = query(
    collection(db, "caseChats"),
    where("caseId", "==", caseId)
  );

  const unsub = onSnapshot(q, (snap) => {
    console.log("Messages count:", snap.size);
    setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });

  return () => unsub();
}, [caseId]); // 🔑 لازم caseId هنا


  async function sendMessage() {
    if (!text.trim()) return;

    await addDoc(collection(db, "caseChats"), {
      caseId,
      senderRole: role,
      senderName,
      message: text.trim(),
      createdAt: serverTimestamp(),
    });

    setText("");
  }

return (
  <div className="border rounded-lg p-4 bg-white dark:bg-gray-800 dark:text-white flex flex-col">
    <h2 className="font-bold mb-2">Case Chat</h2>

    {/* ✅ MESSAGES (fixed height so it shows) */}
<div className="h-72 overflow-y-auto space-y-3 mb-3 pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
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
        className="flex justify-start">
        <div
          className={`max-w-[75%] rounded-2xl px-4 py-3 shadow
            ${
              isMe
                ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white"
                : "bg-gray-700 text-gray-100"
            }`}
        >
          {/* header */}
          <div className="flex items-center justify-between mb-1 text-[11px] opacity-80">
            <span className="font-semibold tracking-wide">
              {m.senderName}
            </span>
            <span className="ml-3">
              {formatDate(m.createdAt)}
            </span>
          </div>

          {/* message */}
          <div className="text-sm leading-relaxed break-words text-left">
            {m.message}
          </div>
        </div>
      </div>
    );
  })}
</div>


    {/* INPUT */}
    <div className="flex gap-2">
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
             bg-gray-900 text-white
             border border-gray-700
             focus:outline-none focus:ring-2 focus:ring-blue-600
             max-h-32 overflow-y-auto"
/>


      <button
        onClick={sendMessage}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded"
      >
        Send
      </button>
    </div>
  </div>
);

}
