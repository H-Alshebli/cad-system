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
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8f9] text-[#274C5A]">
        <div className="text-sm font-semibold text-[#7F7F7F]">Loading...</div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen overflow-hidden bg-[#f5f8f9] text-[#2B2B2B]"
      style={{ fontFamily: "TheSans, 'TheSans Plain', Arial, Helvetica, sans-serif" }}
    >
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(135deg,#ffffff_0%,#f5f8f9_48%,#e7eef1_100%)]" />
      <div className="absolute inset-x-0 top-0 h-2 bg-[#274C5A]" />
      <div className="absolute inset-x-0 bottom-0 h-2 bg-[#86A7B2]" />

      <div className="pointer-events-none absolute left-0 top-0 h-full w-2 bg-[#274C5A]" />
      <div className="pointer-events-none absolute right-0 top-0 h-full w-2 bg-[#86A7B2]" />

      <div className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full max-w-[90rem] overflow-hidden rounded-2xl border border-[#86A7B2]/30 bg-white shadow-2xl shadow-[#274C5A]/10 lg:grid-cols-[1.12fr_0.88fr]">
          <section className="hidden min-h-[660px] bg-[#274C5A] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14 2xl:p-16">
            <div>
              <div className="mb-10 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white">
                <Activity className="h-4 w-4" />
                HCAD Command Center
              </div>

              <h1 className="max-w-xl text-4xl font-black leading-tight text-white xl:text-5xl">
                Modern emergency dispatch, built for fast decisions.
              </h1>

              <p className="mt-7 max-w-xl text-base font-medium leading-8 text-[#d7e4e8]">
                Manage cases, units, projects, ePCR visibility, and operational
                dashboards from one secure command interface.
              </p>
            </div>

            <div className="space-y-5">
              <div className="h-px w-full bg-white/20" />
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-white/15 bg-white/10 p-4">
                  <div className="text-2xl font-black text-white">24/7</div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#d7e4e8]">
                    Ops
                  </div>
                </div>

                <div className="rounded-lg border border-white/15 bg-white/10 p-4">
                  <div className="text-2xl font-black text-white">Live</div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#d7e4e8]">
                    Cases
                  </div>
                </div>

                <div className="rounded-lg border border-white/15 bg-white/10 p-4">
                  <div className="text-2xl font-black text-white">Secure</div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#d7e4e8]">
                    Access
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="flex min-h-[660px] items-center justify-center p-8 sm:p-10 xl:p-14 2xl:p-16">
            <form onSubmit={login} className="w-full max-w-xl">
              <div className="mb-8 flex flex-col items-center text-center">
                <img
                  src="/brand/lazem-secondary-logo-solid.svg"
                  alt="Lazem Logo"
                  className="mb-5 h-24 w-24 object-contain"
                />

                <h2 className="text-3xl font-black tracking-tight text-[#274C5A]">
                  Lazem HCAD
                </h2>

                <p className="mt-2 text-sm font-semibold text-[#7F7F7F]">
                  Sign in to Emergency Command
                </p>
              </div>

              {error && (
                <div className="mb-5 rounded-xl border border-[#ef0052]/30 bg-[#ef0052]/10 px-4 py-3 text-sm font-semibold text-[#9d0037]">
                  {error}
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-bold text-[#274C5A]">
                    Email
                  </label>

                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#86A7B2]" />
                    <input
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-14 w-full rounded-xl border border-[#86A7B2]/45 bg-white pl-12 pr-4 text-base font-semibold text-[#2B2B2B] outline-none transition placeholder:text-[#7F7F7F]/70 focus:border-[#274C5A] focus:ring-4 focus:ring-[#86A7B2]/25"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-[#274C5A]">
                    Password
                  </label>

                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#86A7B2]" />
                    <input
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-14 w-full rounded-xl border border-[#86A7B2]/45 bg-white pl-12 pr-4 text-base font-semibold text-[#2B2B2B] outline-none transition placeholder:text-[#7F7F7F]/70 focus:border-[#274C5A] focus:ring-4 focus:ring-[#86A7B2]/25"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={resetPassword}
                  className="text-sm font-bold text-[#274C5A] transition hover:text-[#86A7B2]"
                >
                  Forgot password?
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/register")}
                  className="text-sm font-bold text-[#7F7F7F] transition hover:text-[#274C5A]"
                >
                  Create account
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-7 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#274C5A] text-base font-black text-white shadow-xl shadow-[#274C5A]/20 transition hover:bg-[#1f3d48] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShieldCheck className="h-5 w-5" />
                {submitting ? "Logging in..." : "Login"}
              </button>

              <div className="mt-6 h-1 rounded-full bg-gradient-to-r from-[#274C5A] via-[#86A7B2] to-[#274C5A]" />
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
