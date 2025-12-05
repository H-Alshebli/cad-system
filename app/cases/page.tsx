"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  doc,
} from "firebase/firestore";
import Link from "next/link";

// ✅ FIX: Case interface so TS accepts ambulanceCode
interface CaseData {
  id: string;
  patientName?: string;
  chiefComplaint?: string;
  level?: string;
  status?: string;
  locationText?: string;
  ambulanceId?: string;
  ambulanceCode?: string;
  createdAt?: any;
  [key: string]: any; // allow extra fields
}

export default function CasesDashboard() {
  const [cases, setCases] = useState<CaseData[]>([]);

  // Access Control
  const [isAdmin, setIsAdmin] = useState(false);
  const [ambulanceFilter, setAmbulanceFilter] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // Real-time alert tracking
  const [lastCaseCount, setLastCaseCount] = useState(0);

  // Load saved login on page load
  useEffect(() => {
    const savedCode = localStorage.getItem("accessCode");

    if (savedCode) {
      if (savedCode === "1234") {
        setIsAdmin(true);
        setShowPopup(false);
      } else if (savedCode.startsWith("AMB-")) {
        setAmbulanceFilter(savedCode);
        setShowPopup(false);
      }
    }
  }, []);

  // 🔊 Play Alert Sound
  function playAlertSound() {
    const audio = new Audio("/alert.mp3");
    audio.play().catch(() => {});
  }

  // ⚠️ Visual Alert
  function showVisualAlert() {
    alert("🚨 New Case Assigned to You!");
  }

  // Load cases + alert detection
  useEffect(() => {
    const q = query(collection(db, "cases"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const list: CaseData[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Cases belonging to this ambulance
      const myCases = ambulanceFilter
        ? list.filter((c) => c.ambulanceCode === ambulanceFilter)
        : list;

      // Detect NEW case assigned to this ambulance
      if (ambulanceFilter && myCases.length > lastCaseCount) {
        playAlertSound();
        showVisualAlert();
      }

      setLastCaseCount(myCases.length);
      setCases(list);
    });

    return () => unsub();
  }, [ambulanceFilter, lastCaseCount]);

  // Delete Case (Admin Only)
  async function deleteCase(id: string) {
    if (!confirm("Are you sure you want to delete this case?")) return;
    await deleteDoc(doc(db, "cases", id));
    alert("Case deleted successfully");
  }

  // Handle Login Code
  function handleCodeSubmit() {
    const input = document.getElementById("accessCode") as HTMLInputElement;
    const code = input.value.trim();

    // Admin Login
    if (code === "1234") {
      setIsAdmin(true);
      setShowPopup(false);
      localStorage.setItem("accessCode", code);
      return;
    }

    // Ambulance Login (AMB-001, AMB-002...)
    if (code.startsWith("AMB-")) {
      setAmbulanceFilter(code);
      setIsAdmin(false);
      setShowPopup(false);
      localStorage.setItem("accessCode", code);
      return;
    }

    // Wrong Code
    setErrorMessage("❌ Incorrect code. Please enter a valid access code.");
  }

  // Logout Handler
  function handleLogout() {
    localStorage.removeItem("accessCode");
    setAmbulanceFilter(null);
    setIsAdmin(false);
    setShowPopup(true);
    setLastCaseCount(0);
  }

  // Apply filtering
  let filteredCases = cases;

  if (ambulanceFilter) {
    filteredCases = cases.filter((c) => c.ambulanceCode === ambulanceFilter);
  }

  return (
    <div className="p-6">

      {/* POPUP LOGIN SCREEN */}
      {showPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-80 text-center">
            <h2 className="text-xl font-bold mb-4">Enter Access Code</h2>

            <input
              id="accessCode"
              type="text"
              placeholder="Enter Admin or Ambulance Code"
              className="border p-2 rounded w-full mb-3"
            />

            {errorMessage && (
              <p className="text-red-500 text-sm mb-3">{errorMessage}</p>
            )}

            <button
              onClick={handleCodeSubmit}
              className="bg-blue-600 text-white px-4 py-2 rounded w-full"
            >
              Submit
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Dispatch Dashboard</h1>

        {!showPopup && (
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-3 py-1 rounded"
          >
            Logout
          </button>
        )}
      </div>

      {/* CASE LIST */}
      <div className="space-y-3">
        {filteredCases.map((c) => (
          <div key={c.id} className="border p-4 rounded shadow-sm bg-white">
            
            <Link href={`/cases/${c.id}`}>
              <div className="cursor-pointer hover:bg-gray-100">
                <h2 className="text-xl font-bold">{c.patientName}</h2>
                <p><strong>Complaint:</strong> {c.chiefComplaint}</p>
                <p><strong>Level:</strong> {c.level}</p>
                <p><strong>Status:</strong> {c.status}</p>
                <p><strong>Ambulance:</strong> {c.ambulanceCode}</p>
                <p><strong>Location:</strong> {c.locationText}</p>
                <p className="text-gray-400 text-sm mt-1">Click to open →</p>
              </div>
            </Link>

            {/* ADMIN DELETE BUTTON */}
            {isAdmin && (
              <button
                onClick={() => deleteCase(c.id)}
                className="mt-3 text-red-600 underline"
              >
                Delete Case
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
