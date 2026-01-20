"use client";

import { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* =========================================
     ✅ AUTO REDIRECT WHEN USER IS READY
  ========================================= */
  useEffect(() => {
    if (loading) return;

    if (
      user &&
      user.active === true &&
      user.role &&
      user.role !== "none"
    ) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  /* =========================================
     🔐 LOGIN HANDLER
  ========================================= */
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const fbUser = cred.user;

      const ref = doc(db, "users", fbUser.uid);
      const snap = await getDoc(ref);

      // 🟡 User document not exists → create minimal profile
      if (!snap.exists()) {
        await setDoc(
          ref,
          {
            email: fbUser.email,
            name: fbUser.displayName || email.split("@")[0],
            active: true,
            role: "none", // ⚠️ لا تُعطى صلاحية هنا
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );

        setError(
          "Your account is pending activation. Please contact admin."
        );
        setSubmitting(false);
        return;
      }

      const data = snap.data();

      // 🔴 Disabled user
      if (data.active === false) {
        setError("Your account is disabled");
        setSubmitting(false);
        return;
      }

      // 🟡 No role yet
      if (!data.role || data.role === "none") {
        setError(
          "Your account has no role yet. Please contact admin."
        );
        setSubmitting(false);
        return;
      }

      // ✅ All good
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
      setSubmitting(false);
    }
  }

  if (loading) return null;

  /* =========================================
     UI
  ========================================= */
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <form
        onSubmit={login}
        className="bg-white dark:bg-gray-800 p-6 rounded w-80 space-y-4"
      >
        <h1 className="text-xl font-bold text-center dark:text-white">
          Login
        </h1>

        {error && (
          <div className="text-red-500 text-sm text-center">
            {error}
          </div>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border rounded dark:bg-gray-700"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border rounded dark:bg-gray-700"
          required
        />
<button
  onClick={() => router.push("/register")}
  className="w-full text-sm text-gray-400 hover:text-white mt-2"
>
  Create new account
</button>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}
