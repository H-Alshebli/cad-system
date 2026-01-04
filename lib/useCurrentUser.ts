"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export function useCurrentUser() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, "users", fbUser.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          console.error("❌ User document does NOT exist");
          setUser({
            uid: fbUser.uid,
            email: fbUser.email,
            role: "none",
            active: false,
          });
        } else {
          setUser({
            uid: fbUser.uid,
            ...snap.data(),
          });
        }
      } catch (e) {
        console.error("🔥 Failed to load user document", e);
        setUser(null);
      }

      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { user, loading };
}
