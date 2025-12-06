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

/* ---------------------------------------------------------
   🔊 GLOBAL AUDIO OBJECT (must be outside component)
----------------------------------------------------------*/
let globalAlertAudio: HTMLAudioElement | null = null;

/* ---------------------------------------------------------
   COMPONENT
----------------------------------------------------------*/
interface CaseData {
  id: string;
  patientName?: string;
  chiefComplaint?: string;
  level?: string;
  status?: string;
  locationText?: string;
  ambulanceCode?: string;
  [key: string]: any;
}

export default function CasesDashboard() {
  const [cases, setCases] = useState<CaseData[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ambulanceFilter, setAmbulanceFilter] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastCaseCount, setLastCaseCount] = useState(0);

  /* ---------------------------------------------------------
     🔊 Unlock audio (required by Chrome/iPhone)
  ----------------------------------------------------------*/
  function primeAudio() {
    const a = new Audio("/sounds/alert.mp3");
    a.play()
      .then(() => {
        a.pause();
        a.currentTime = 0;
        console.log("Audio unlocked.");
      })
      .catch(() => {});
  }

  /* ---------------------------------------------------------
     🔊 Looping alarm sound (REPEATS non-stop)
  ----------------------------------------------------------*/
  function playAlertSoundLoop() {
    if (!globalAlertAudio) {
      globalAlertAudio = new Audio("/sounds/alert.mp3");
      globalAlertAudio.loop = true;
      globalAlertAudio.volume = 1.0;
    }
    globalAlertAudio.play().catch(() => {});
  }

  /* ---------------------------------------------------------
     🛑 Stop alarm sound
  ----------------------------------------------------------*/
  function stopAlertSound() {
    if (globalAlertAudio) {
      globalAlertAudio.pause();
      globalAlertAudio.currentTime = 0;
    }
  }

  /* ---------------------------------------------------------
     ⚠️ Visual popup + STOP after click
  ----------------------------------------------------------*/
  function showVisualAlert() {
    playAlertSoundLoop();

    setTimeout(() => {
      alert("🚨 New Case Assigned to You!");
      stopAlertSound();
    }, 200);
  }

  /* ---------------------------------------------------------
     Load login from localStorage
  ----------------------------------------------------------*/
  useEffect(() => {
    const saved = localStorage.getItem("accessCode");

    if (saved) {
      if (saved === "1234") {
        setIsAdmin(true);
        setShowPopup(false);
      } else if (saved.startsWith("AMB-")) {
        setAmbulanceFilter(saved);
        setShowPopup(false);
      }

      primeAudio();
    }
  }, []);

  /* ---------------------------------------------------------
     Firestore listener
  ----------------------------------------------------------*/
  useEffect(() => {
    const q = query(collection(db, "cases"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const list: CaseData[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Filter for ambulance
      const myCases = ambulanceFilter
        ? list.filter((c) => c.ambulanceCode === ambulanceFilter)
        : list;

      // Detect new case → trigger alert
      if (ambulanceFilter && myCases.length > lastCaseCount) {
        showVisualAlert();
      }

      setLastCaseCount(myCases.length);
      setCases(list);
    });

    return () => unsub();
  }, [ambulanceFilter, lastCaseCount]);

  /* ---------------------------------------------------------
     Delete case
  ----------------------------------------------------------*/
  async function deleteCase(id: string) {
    if (!confirm("Delete this case?")) return;
    await deleteDoc(doc(db, "cases", id));
    alert("Case deleted.");
  }

  /* ---------------------------------------------------------
     Login submit
  ----------------------------------------------------------*/
  function handleCodeSubmit() {
    const input = document.getElementById("accessCode") as HTMLInputElement;
    const code = input.value.trim();

    if (code === "1234") {
      setIsAdmin(true);
      setShowPopup(false);
      localStorage.setItem("accessCode", code);
      primeAudio();
      return;
    }

    if (code.startsWith("AMB-")) {
      setAmbulanceFilter(code);
      setIsAdmin(false);
      setShowPopup(false);
      localStorage.setItem("accessCode", code);
      primeAudio();
      return;
    }

    setErrorMessage("❌ Incorrect code. Try again.");
  }

  /* ---------------------------------------------------------
     Logout
  ----------------------------------------------------------*/
  function handleLogout() {
    localStorage.removeItem("accessCode");
    setAmbulanceFilter(null);
    setIsAdmin(false);
    setShowPopup(true);
    setLastCaseCount(0);
  }

  /* ---------------------------------------------------------
     Case Filtering
  ----------------------------------------------------------*/
  let filteredCases = cases;
  if (ambulanceFilter) {
    filteredCases = cases.filter(
      (c) => c.ambulanceCode === ambulanceFilter
    );
  }

  /* ---------------------------------------------------------
     RENDER UI
  ----------------------------------------------------------*/
  return (
    <div className="p-6">

      {/* POPUP LOGIN */}
      {showPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-80 text-center">
            <h2 className="text-xl font-bold mb-4">Enter Access Code</h2>

            <input
              id="accessCode"
              type="text"
              placeholder="Admin or Ambulance Code"
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
          <div key={c.id} className="border p-4 rounded bg-white shadow-sm">
            <Link href={`/cases/${c.id}`}>
              <div className="cursor-pointer hover:bg-gray-100">
                <h2 className="text-xl font-bold">{c.patientName}</h2>
                <p><strong>Complaint:</strong> {c.chiefComplaint}</p>
                <p><strong>Level:</strong> {c.level}</p>
                <p><strong>Status:</strong> {c.status}</p>
                <p><strong>Ambulance:</strong> {c.ambulanceCode}</p>
                <p><strong>Location:</strong> {c.locationText}</p>
              </div>
            </Link>

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
