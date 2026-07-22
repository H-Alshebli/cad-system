"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Mail, Lock, User, ShieldCheck, Activity } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const fbUser = cred.user;

      await setDoc(
        doc(db, "users", fbUser.uid),
        {
          name,
          email: fbUser.email,
          active: true,
          role: "none",
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      alert("Account created. Please contact admin to activate your role.");
      router.replace("/login");
    } catch (err: any) {
      setError(err.message || "Registration failed");
      setSubmitting(false);
    }
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
                Create secure access for emergency operations.
              </h1>

              <p className="mt-7 max-w-xl text-base font-medium leading-8 text-[#d7e4e8]">
                Register your account to request access to the Lazem HCAD
                command system. Your role will be assigned by the admin team.
              </p>
            </div>

            <div className="space-y-5">
              <div className="h-px w-full bg-white/20" />
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-white/15 bg-white/10 p-4">
                  <div className="text-2xl font-black text-white">Role</div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#d7e4e8]">
                    Based
                  </div>
                </div>

                <div className="rounded-lg border border-white/15 bg-white/10 p-4">
                  <div className="text-2xl font-black text-white">Admin</div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#d7e4e8]">
                    Approval
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
            <form onSubmit={register} className="w-full max-w-xl">
              <div className="mb-8 flex flex-col items-center text-center">
                <img
                  src="/brand/lazem-secondary-logo-solid.svg"
                  alt="Lazem Logo"
                  className="mb-5 h-24 w-24 object-contain"
                />

                <h2 className="text-3xl font-black tracking-tight text-[#274C5A]">
                  Create Account
                </h2>

                <p className="mt-2 text-sm font-semibold text-[#7F7F7F]">
                  Register to request HCAD system access
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
                    Full Name
                  </label>

                  <div className="relative">
                    <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#86A7B2]" />
                    <input
                      type="text"
                      placeholder="Enter your full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-14 w-full rounded-xl border border-[#86A7B2]/45 bg-white pl-12 pr-4 text-base font-semibold text-[#2B2B2B] outline-none transition placeholder:text-[#7F7F7F]/70 focus:border-[#274C5A] focus:ring-4 focus:ring-[#86A7B2]/25"
                      required
                    />
                  </div>
                </div>

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
                      placeholder="Create your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-14 w-full rounded-xl border border-[#86A7B2]/45 bg-white pl-12 pr-4 text-base font-semibold text-[#2B2B2B] outline-none transition placeholder:text-[#7F7F7F]/70 focus:border-[#274C5A] focus:ring-4 focus:ring-[#86A7B2]/25"
                      required
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-7 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#274C5A] text-base font-black text-white shadow-xl shadow-[#274C5A]/20 transition hover:bg-[#1f3d48] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShieldCheck className="h-5 w-5" />
                {submitting ? "Creating account..." : "Register"}
              </button>

              <button
                type="button"
                onClick={() => router.push("/login")}
                className="mt-5 w-full text-center text-sm font-bold text-[#7F7F7F] transition hover:text-[#274C5A]"
              >
                Back to Login
              </button>

              <div className="mt-6 h-1 rounded-full bg-gradient-to-r from-[#274C5A] via-[#86A7B2] to-[#274C5A]" />
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
