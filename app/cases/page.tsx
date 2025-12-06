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
   🔊 GLOBAL VARIABLES
----------------------------------------------------------*/
let alarmInterval: NodeJS.Timeout | null = null;
let globalAudio: HTMLAudioElement | null = null;

/* ---------------------------------------------------------
   TYPES
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
  const [showLoginPopup, setShowLoginPopup] = useState(true);
  const [showAlarmPopup, setShowAlarmPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastCaseCount, setLastCaseCount] = useState(0);

  /* ---------------------------------------------------------
     🔊 PRIME AUDIO (Safari/iOS fix)
----------------------------------------------------------*/
  function primeAudio() {
    const a = new Audio("/sounds/alert.mp3");
    a.play()
      .then(() => {
        a.pause();
        a.currentTime = 0;
      })
      .catch(() => {});
  }

  /* ---------------------------------------------------------
     🔊 START ALARM LOOP
----------------------------------------------------------*/
  function startAlarm() {
    if (!globalAudio) {
      globalAudio = new Audio("/sounds/alert.mp3");
      globalAudio.volume = 1.0;
    }

    stopAlarm();

    globalAudio.play().catch(() => {});

    alarmInterval = setInterval(() => {
      globalAudio!.currentTime = 0;
      globalAudio!.play().catch(() => {});
    }, 1500);

    setShowAlarmPopup(true);
  }

  /* ---------------------------------------------------------
     🛑 STOP ALARM
----------------------------------------------------------*/
  function stopAlarm() {
    if (alarmInterval) clearInterval(alarmInterval);
    alarmInterval = null;

    if (globalAudio) {
      globalAudio.pause();
      globalAudio.currentTime = 0;
    }

    setShowAlarmPopup(false);
  }

  /* ---------------------------------------------------------
     LOAD LOGIN DATA
----------------------------------------------------------*/
  useEffect(() => {
    const saved = localStorage.getItem("accessCode");

    if (saved) {
      if (saved === "1234") {
        setIsAdmin(true);
        setShowLoginPopup(false);
      } else if (saved.startsWith("AMB-")) {
        setAmbulanceFilter(saved);
        setShowLoginPopup(false);
      }
      primeAudio();
    }
  }, []);

  /* ---------------------------------------------------------
     FIRESTORE LIVE LISTENER
----------------------------------------------------------*/
  useEffect(() => {
    const q = query(collection(db, "cases"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const list: CaseData[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const myCases = ambulanceFilter
        ? list.filter((c) => c.ambulanceCode === ambulanceFilter)
        : list;

      if (ambulanceFilter && myCases.length > lastCaseCount) {
        startAlarm();
      }

      setLastCaseCount(myCases.length);
      setCases(list);
    });

    return () => unsub();
  }, [ambulanceFilter, lastCaseCount]);

  /* ---------------------------------------------------------
     LOGIN SUBMIT
----------------------------------------------------------*/
  function handleLoginSubmit() {
    const input = document.getElementById("accessCode") as HTMLInputElement;
    const code = input.value.trim();

    if (code === "1234") {
      setIsAdmin(true);
      setShowLoginPopup(false);
      localStorage.setItem("accessCode", code);
      primeAudio();
      return;
    }

    if (code.startsWith("AMB-")) {
      setAmbulanceFilter(code);
      setShowLoginPopup(false);
      localStorage.setItem("accessCode", code);
      primeAudio();
      return;
    }

    setErrorMessage("❌ Incorrect code");
  }

  /* ---------------------------------------------------------
     LOGOUT
----------------------------------------------------------*/
  function handleLogout() {
    localStorage.removeItem("accessCode");
    setAmbulanceFilter(null);
    setIsAdmin(false);
    setShowLoginPopup(true);
    setLastCaseCount(0);
    stopAlarm();
  }

  /* ---------------------------------------------------------
     DELETE CASE (Admin Only)
----------------------------------------------------------*/
  async function deleteCase(id: string) {
    if (!confirm("Are you sure you want to delete this case?")) return;
    await deleteDoc(doc(db, "cases", id));
    alert("Case deleted successfully.");
  }

  /* ---------------------------------------------------------
     FILTER CASES
----------------------------------------------------------*/
  const filteredCases = ambulanceFilter
    ? cases.filter((c) => c.ambulanceCode === ambulanceFilter)
    : cases;

  /* ---------------------------------------------------------
     RENDER UI
----------------------------------------------------------*/
  return (
    <div className="p-6 dark:bg-gray-900 min-h-screen">

      {/* LOGIN POPUP */}
      {showLoginPopup && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded shadow-lg w-80 text-center">
            <h2 className="text-xl font-bold mb-4 dark:text-white">
              Enter Access Code
            </h2>

            <input
              id="accessCode"
              type="text"
              placeholder="Admin or Ambulance Code"
              className="border p-2 rounded w-full mb-3 dark:bg-gray-700 dark:text-white dark:border-gray-600"
            />

            {errorMessage && (
              <p className="text-red-500 text-sm">{errorMessage}</p>
            )}

            <button
              onClick={handleLoginSubmit}
              className="bg-blue-600 text-white w-full py-2 rounded mt-2"
            >
              Login
            </button>
          </div>
        </div>
      )}

      {/* ALARM POPUP */}
      {showAlarmPopup && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[60]">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg w-80 text-center animate-pulse">
            <h2 className="text-xl font-bold text-red-600 mb-4 dark:text-red-400">
              🚨 New Case Assigned!
            </h2>

            <button
              className="bg-red-600 text-white px-4 py-2 rounded w-full"
              onClick={stopAlarm}
            >
              STOP ALARM
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold dark:text-white">
          Dispatch Dashboard
        </h1>

        {!showLoginPopup && (
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
          <div
            key={c.id}
            className="
              border rounded shadow-sm p-4 
              bg-white text-gray-900 
              hover:bg-gray-100 
              dark:bg-gray-800 dark:text-white dark:border-gray-700 
              dark:hover:bg-gray-700
            "
          >
            <Link href={`/cases/${c.id}`}>
              <div className="cursor-pointer">
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
                className="mt-2 text-red-500 underline dark:text-red-400"
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
