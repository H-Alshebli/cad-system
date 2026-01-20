"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    setError("");
    setLoading(true);

    try {
      // 1️⃣ Create Auth User
      const cred = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const uid = cred.user.uid;

      // 2️⃣ Create Firestore User
      await setDoc(doc(db, "users", uid), {
        name,
        email,
        role: "pending",
        active: false,
        createdAt: serverTimestamp(),
      });

      alert("Registered successfully. Wait for admin approval.");
      router.push("/login");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="bg-slate-900 p-6 rounded-lg w-80 space-y-4">
        <h1 className="text-xl text-white font-semibold text-center">
          Register
        </h1>

        {error && (
          <div className="text-red-400 text-sm">{error}</div>
        )}

        <input
          className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded"
        >
          {loading ? "Registering..." : "Register"}
        </button>

        <button
          onClick={() => router.push("/login")}
          className="w-full text-sm text-gray-400 hover:text-white"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}
