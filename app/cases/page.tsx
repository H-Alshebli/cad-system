"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  deleteDoc,
  doc,
} from "firebase/firestore";
import Link from "next/link";

/* ---------------------------------------------------------
   GLOBAL ALARM HANDLING
----------------------------------------------------------*/
let alarmInterval: NodeJS.Timeout | null = null;
let globalAudio: HTMLAudioElement | null = null;

/* ---------------------------------------------------------
   CASE TYPE
----------------------------------------------------------*/
interface CaseData {
  id: string;
  lazemCode?: string;
  ijrny?: string;
  chiefComplaint?: string;
  level?: string;
  status?: string;
  locationText?: string;
  ambulanceCode?: string;
  roaming?: string;
  timeline?: {
    Received?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export default function CasesDashboard() {
  /* ---------------------------------------------------------
     STATE
  ----------------------------------------------------------*/
  const [cases, setCases] = useState<CaseData[]>([]);
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [roamingUnits, setRoamingUnits] = useState<any[]>([]);

  const [role, setRole] = useState<
    "admin" | "management" | "dispatch" | "ambulance" | "roaming" | null
  >(null);

  const [unitFilter, setUnitFilter] = useState<string | null>(null);

  const [showLoginPopup, setShowLoginPopup] = useState(true);
  const [showAlarmPopup, setShowAlarmPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [lastLatestCaseId, setLastLatestCaseId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  /* ---------------------------------------------------------
     PRIME AUDIO
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
     START ALARM
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
     STOP ALARM
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
     LOAD AMBULANCES + ROAMING UNITS
  ----------------------------------------------------------*/
  useEffect(() => {
    const unsubA = onSnapshot(collection(db, "ambulances"), (snap) => {
      setAmbulances(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubR = onSnapshot(collection(db, "Roaming"), (snap) => {
      setRoamingUnits(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubA();
      unsubR();
    };
  }, []);

  /* ---------------------------------------------------------
     AUTO LOGIN (system roles only)
  ----------------------------------------------------------*/
  useEffect(() => {
    const saved = localStorage.getItem("accessCode");
    if (!saved) return;

    if (saved === "727978") setRole("admin");
    else if (saved === "mng000") setRole("management");
    else if (saved === "dcp000") setRole("dispatch");
    else return; // ambulances & roaming must login each time

    setShowLoginPopup(false);
    primeAudio();
  }, []);

  /* ---------------------------------------------------------
     FIRESTORE LISTENER FOR CASES
     ✅ NO createdAt
     ✅ Sort by timeline.Received
  ----------------------------------------------------------*/
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "cases"), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as CaseData[];

      // ✅ Sort by timeline.Received DESC (latest first)
      list.sort((a, b) => {
        const ta = a.timeline?.Received ? new Date(a.timeline.Received).getTime() : 0;
        const tb = b.timeline?.Received ? new Date(b.timeline.Received).getTime() : 0;
        return tb - ta;
      });

      setCases(list);

      const newest = list[0];
      if (!newest) return;

      // Dispatch alarm
      if (role === "dispatch" && newest.id !== lastLatestCaseId) {
        startAlarm();
        setLastLatestCaseId(newest.id);
      }

      // Ambulance alarm
      if (role === "ambulance" && unitFilter) {
        const myCase = list.find((c) => c.ambulanceCode === unitFilter);
        if (
          myCase &&
          myCase.id !== lastLatestCaseId &&
          (myCase.status === "Assigned" || myCase.status === "Received")
        ) {
          startAlarm();
          setLastLatestCaseId(myCase.id);
        }
      }

      // Roaming alarm
      if (role === "roaming" && unitFilter) {
        const myCase = list.find((c) => c.roaming === unitFilter);
        if (
          myCase &&
          myCase.id !== lastLatestCaseId &&
          (myCase.status === "Assigned" || myCase.status === "Received")
        ) {
          startAlarm();
          setLastLatestCaseId(myCase.id);
        }
      }
    });

    return () => unsub();
  }, [role, unitFilter, lastLatestCaseId]);

  /* ---------------------------------------------------------
     LOGIN HANDLER
  ----------------------------------------------------------*/
  function handleLoginSubmit() {
    const input = document.getElementById("accessCode") as HTMLInputElement;
    const code = input.value.trim();
    setErrorMessage("");

    // System roles
    if (code === "727978") {
      setRole("admin");
    } else if (code === "mng000") {
      setRole("management");
    } else if (code === "dcp000") {
      setRole("dispatch");
    } else {
      // Ambulance login
      const amb = ambulances.find(
        (a) => a.code.trim().toLowerCase() === code.toLowerCase()
      );

      if (amb) {
        setRole("ambulance");
        setUnitFilter(amb.code);
        localStorage.setItem("accessCode", code);
        setShowLoginPopup(false);
        primeAudio();
        return;
      }

      // Roaming login
      const roam = roamingUnits.find(
        (r) => r.code.trim().toLowerCase() === code.toLowerCase()
      );

      if (roam) {
        setRole("roaming");
        setUnitFilter(roam.code);
        localStorage.setItem("accessCode", code);
        setShowLoginPopup(false);
        primeAudio();
        return;
      }

      setErrorMessage("❌ Incorrect code");
      return;
    }

    localStorage.setItem("accessCode", code);
    setShowLoginPopup(false);
    primeAudio();
  }

  /* ---------------------------------------------------------
     LOGOUT
  ----------------------------------------------------------*/
  function handleLogout() {
    localStorage.removeItem("accessCode");
    setRole(null);
    setUnitFilter(null);
    setLastLatestCaseId(null);
    stopAlarm();
    setShowLoginPopup(true);
  }

  /* ---------------------------------------------------------
     DELETE CASE
  ----------------------------------------------------------*/
  async function deleteCase(id: string) {
    if (!confirm("Are you sure?")) return;
    await deleteDoc(doc(db, "cases", id));
    alert("Case deleted.");
  }

  /* ---------------------------------------------------------
     FILTER CASES
  ----------------------------------------------------------*/
  let visibleCases = cases;

  if (role === "ambulance" && unitFilter) {
    visibleCases = cases.filter((c) => c.ambulanceCode === unitFilter);
  }

  if (role === "roaming" && unitFilter) {
    visibleCases = cases.filter((c) => c.roaming === unitFilter);
  }

  if (!showCompleted) {
    visibleCases = visibleCases.filter((c) => c.status !== "Closed");
  }

  /* ---------------------------------------------------------
     UI
  ----------------------------------------------------------*/
  return (
    <div className="p-6 dark:bg-gray-900 min-h-screen">
      {/* LOGIN POPUP */}
      {showLoginPopup && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-80 text-center">
            <h2 className="text-xl font-bold mb-4 dark:text-white">
              Enter Access Code
            </h2>

            <input
              id="accessCode"
              type="text"
              placeholder="Enter role or unit code…"
              className="w-full p-2 rounded dark:bg-gray-700 dark:text-white"
            />

            {errorMessage && <p className="text-red-500 mt-2">{errorMessage}</p>}

            <button
              onClick={handleLoginSubmit}
              className="bg-blue-600 text-white w-full py-2 rounded mt-3"
            >
              Login
            </button>
          </div>
        </div>
      )}

      {/* ALARM POPUP */}
      {showAlarmPopup && (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[60]">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg w-80 text-center animate-pulse">
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">
              🚨 New Case Alert!
            </h2>

            <button
              className="bg-red-600 text-white w-full py-2 rounded"
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

      {/* SHOW COMPLETED */}
      <button
        onClick={() => setShowCompleted(!showCompleted)}
        className="bg-gray-700 text-white px-4 py-2 rounded mb-4"
      >
        {showCompleted ? "Hide Completed Cases" : "Show Completed Cases"}
      </button>

      {/* CASE LIST */}
      <div className="space-y-3">
        {visibleCases.map((c) => (
          <div
            key={c.id}
            className="border rounded p-4 bg-white dark:bg-gray-800 dark:text-white"
          >
            <Link href={`/cases/${c.id}`}>
              <div className="cursor-pointer">
                <h2 className="text-xl font-bold">
                  Lazem Code: {c.lazemCode || "—"}
                </h2>
                <p>Ijrny Code: {c.ijrny || "—"}</p>
                <p>Complaint: {c.chiefComplaint}</p>
                <p>Level: {c.level}</p>
                <p>Status: {c.status}</p>
                <p>Ambulance: {c.ambulanceCode || "None"}</p>
                <p>Roaming: {c.roaming || "None"}</p>
                <p>Location: {c.locationText}</p>
              </div>
            </Link>

           {role === "admin" && (
  <button
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteCase(c.id);
    }}
    className="mt-2 text-red-500 underline"
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
