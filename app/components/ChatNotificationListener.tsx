"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";

type ChatNotification = {
  id: string;
  caseId?: string;
  caseNumber?: string;
  senderName?: string;
  messagePreview?: string;
  link?: string;
  createdAt?: any;
};

export default function ChatNotificationListener() {
  const { user, loading } = useCurrentUser();
  const [notification, setNotification] = useState<ChatNotification | null>(null);
  const initializedRef = useRef(false);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    initializedRef.current = false;
    seenMessageIdsRef.current = new Set();
    if (timerRef.current) clearTimeout(timerRef.current);
    setNotification(null);
    if (loading || !user?.uid) return;

    return onSnapshot(
      collection(db, "cases"),
      (snapshot) => {
        if (!initializedRef.current) {
          snapshot.docs.forEach((document) => {
            const messageId = String(document.get("lastChatMessage.id") || "").trim();
            if (messageId) seenMessageIdsRef.current.add(messageId);
          });
          initializedRef.current = true;
          return;
        }

        const newest = snapshot
          .docChanges()
          .filter((change) => change.type === "modified")
          .map((change) => {
            const caseData = change.doc.data() as any;
            const chatMessage = caseData.lastChatMessage || {};
            return {
              id: String(chatMessage.id || ""),
              caseId: change.doc.id,
              caseNumber: caseData.caseNumber,
              senderName: chatMessage.senderName,
              senderId: chatMessage.senderId,
              recipientUserIds: Array.isArray(chatMessage.recipientUserIds)
                ? chatMessage.recipientUserIds
                : [],
              messagePreview: chatMessage.messagePreview,
              link: `/cadcases/${change.doc.id}`,
              createdAt: chatMessage.createdAt,
            };
          })
          .filter((item) => {
            if (!item.id || seenMessageIdsRef.current.has(item.id)) return false;
            seenMessageIdsRef.current.add(item.id);
            return item.senderId !== user.uid && item.recipientUserIds.includes(user.uid);
          })
          .sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
          })[0] as ChatNotification | undefined;

        if (!newest) return;
        setNotification(newest);
        const audio = new Audio("/sounds/alert.mp3");
        audio.volume = 0.55;
        audio.play().catch(() => {});
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setNotification(null), 10000);
      },
      (error) => console.warn("Chat case listener failed", error)
    );
  }, [loading, user?.uid]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!notification) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[90] w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-[#86A7B2]/35 bg-white p-4 text-[#274C5A] shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-[#607482]">
            Chat notification
          </div>
          <div className="mt-1 text-base font-black">
            New message for {notification.caseNumber || "HCAD case"}
          </div>
          <div className="mt-1 text-sm font-semibold text-[#607482]">
            From {notification.senderName || "HCAD user"}
          </div>
          {notification.messagePreview && (
            <div className="mt-2 line-clamp-2 text-sm text-[#274C5A]">
              {notification.messagePreview}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setNotification(null)}
          className="rounded-lg px-2 py-1 text-sm font-black text-[#607482] hover:bg-[#eef4f6]"
          aria-label="Dismiss chat notification"
        >
          ×
        </button>
      </div>
      <Link
        href={notification.link || `/cadcases/${notification.caseId}`}
        onClick={() => setNotification(null)}
        className="mt-3 block rounded-xl bg-[#274C5A] px-4 py-2 text-center text-sm font-black text-white hover:bg-[#1f3f4c]"
      >
        Open chat
      </Link>
    </div>
  );
}
