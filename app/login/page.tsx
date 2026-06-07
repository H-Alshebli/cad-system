"use client";

import { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { Mail, Lock, ShieldCheck, Activity } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (user && user.active === true && user.role && user.role !== "none") {
      router.replace("/welcome");
    }
  }, [user, loading, router]);

  async function resetPassword() {
    if (!email) {
      alert("Enter your email first");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      alert("Password reset email sent.");
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const fbUser = cred.user;

      const ref = doc(db, "users", fbUser.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        await setDoc(
          ref,
          {
            email: fbUser.email,
            name: fbUser.displayName || email.split("@")[0],
            active: true,
            role: "none",
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );

        setError("Your account is pending activation. Please contact admin.");
        setSubmitting(false);
        return;
      }

      const data = snap.data();

      if (data.active === false) {
        setError("Your account is disabled");
        setSubmitting(false);
        return;
      }

      if (!data.role || data.role === "none") {
        setError("Your account has no role yet. Please contact admin.");
        setSubmitting(false);
        return;
      }

      router.replace("/welcome");
    } catch (err: any) {
      setError(err.message || "Login failed");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#06111f] text-white flex items-center justify-center">
        <div className="text-sm text-slate-400">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#06111f] text-slate-100">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute -right-40 top-10 h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-[-120px] left-1/2 h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-indigo-600/10 blur-3xl" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-6 py-10">
        <div className="grid w-full max-w-7xl overflow-hidden rounded-[32px] border border-white/10 bg-[#070d1c]/90 shadow-2xl shadow-black/50 backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left Side */}
          <section className="hidden border-r border-white/10 p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
            <div>
              <div className="mb-10 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-xs font-semibold text-blue-200">
                <Activity className="h-4 w-4" />
                HCAD Command Center
              </div>

              <h1 className="max-w-xl text-4xl font-black leading-tight tracking-tight text-white xl:text-5xl">
                Modern emergency dispatch, built for fast decisions.
              </h1>

              <p className="mt-7 max-w-xl text-base font-medium leading-8 text-slate-400">
                Manage cases, units, projects, ePCR visibility, and operational
                dashboards from one secure command interface.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
                <div className="text-2xl font-black text-white">24/7</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">
                  Ops
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
                <div className="text-2xl font-black text-white">Live</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">
                  Cases
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
                <div className="text-2xl font-black text-white">Secure</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">
                  Access
                </div>
              </div>
            </div>
          </section>

          {/* Right Side */}
          <section className="flex min-h-[620px] items-center justify-center p-6 sm:p-10 xl:p-14">
            <form onSubmit={login} className="w-full max-w-md">
              <div className="mb-8 flex flex-col items-center text-center">
                <img
                  src="/icons/icon-512.png"
                  alt="Lazem Logo"
                  className="mb-4 h-20 w-20 object-contain"
                />

                <h2 className="text-3xl font-black tracking-tight text-white">
                  Lazem HCAD
                </h2>

                <p className="mt-2 text-sm font-medium text-slate-500">
                  Sign in to Emergency Command
                </p>
              </div>

              {error && (
                <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
                  {error}
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-400">
                    Email
                  </label>

                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                    <input
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-14 w-full rounded-2xl border border-white/10 bg-slate-100 pl-12 pr-4 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/20"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-400">
                    Password
                  </label>

                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                    <input
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-14 w-full rounded-2xl border border-white/10 bg-slate-100 pl-12 pr-4 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/20"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={resetPassword}
                  className="text-sm font-bold text-blue-300 transition hover:text-blue-200"
                >
                  Forgot password?
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/register")}
                  className="text-sm font-bold text-slate-500 transition hover:text-white"
                >
                  Create account
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-7 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-base font-black text-white shadow-xl shadow-blue-600/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShieldCheck className="h-5 w-5" />
                {submitting ? "Logging in..." : "Login"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}