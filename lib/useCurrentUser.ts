"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

export function useCurrentUser() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUser = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      unsubscribeUser();

      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      unsubscribeUser = onSnapshot(
        doc(db, "users", fbUser.uid),
        (snap) => {
          if (!snap.exists()) {
            console.error("❌ User document does NOT exist");
            setUser({
              uid: fbUser.uid,
              email: fbUser.email,
              role: "none",
              active: false,
              accountStatus: "pending",
            });
          } else {
            setUser({ uid: fbUser.uid, ...snap.data() });
          }
          setLoading(false);
        },
        (error) => {
          console.error("🔥 Failed to load user document", error);
          setUser(null);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeUser();
      unsubscribeAuth();
    };
  }, []);

  return { user, loading };
}
