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
   GLOBAL ALARM HANDLING
----------------------------------------------------------*/
let alarmInterval: NodeJS.Timeout | null = null;
let globalAudio: HTMLAudioElement | null = null;

/* ---------------------------------------------------------
   CASE TYPE
----------------------------------------------------------*/
interface CaseData {
  id: string;
  caseCode?: string;
  Ijrny?: string;
  chiefComplaint?: string;
  level?: string;
  status?: string;
  locationText?: string;
  ambulanceCode?: string;
  [key: string]: any;
}

export default function CasesDashboard() {
  const [cases, setCases] = useState<CaseData[]>([]);
  const [role, setRole] = useState<
    "admin" | "management" | "dispatch" | "ambulance" | null
  >(null);

  const [ambulanceFilter, setAmbulanceFilter] = useState<string | null>(null);
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
     AUTO LOGIN
----------------------------------------------------------*/
  useEffect(() => {
    const saved = localStorage.getItem("accessCode");

    if (!saved) return;

    if (saved === "727978") setRole("admin");
    else if (saved === "mng000") setRole("management");
    else if (saved === "dcp000") setRole("dispatch");
    else if (saved.startsWith("AMB-")) {
      setRole("ambulance");
      setAmbulanceFilter(saved);
    }

    setShowLoginPopup(false);
    primeAudio();
  }, []);

  /* ---------------------------------------------------------
     FIRESTORE LISTENER (with fixed spread operator)
----------------------------------------------------------*/
  useEffect(() => {
    const q = query(collection(db, "cases"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const list: CaseData[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...((d.data() || {}) as any), // 🔥 FIXED HERE
      }));

      setCases(list);

      /* DISPATCH → Alarm for EVERY new case */
      if (role === "dispatch") {
        const newest = list[0];
        if (newest && newest.id !== lastLatestCaseId) {
          startAlarm();
          setLastLatestCaseId(newest.id);
        }
      }

      /* AMBULANCE → Alarm for assigned cases */
      if (role === "ambulance" && ambulanceFilter) {
        const myCases = list.filter((c) => c.ambulanceCode === ambulanceFilter);
        if (myCases.length === 0) return;

        const newest = myCases[0];
        if (
          newest &&
          newest.id !== lastLatestCaseId &&
          (newest.status === "Received" || newest.status === "Assigned")
        ) {
          startAlarm();
          setLastLatestCaseId(newest.id);
        }
      }
    });

    return () => unsub();
  }, [role, ambulanceFilter, lastLatestCaseId]);

  /* ---------------------------------------------------------
     LOGIN SUBMIT
----------------------------------------------------------*/
  function handleLoginSubmit() {
    const input = document.getElementById("accessCode") as HTMLInputElement;
    const code = input.value.trim();

    if (code === "727978") setRole("admin");
    else if (code === "mng000") setRole("management");
    else if (code === "dcp000") setRole("dispatch");
    else if (code.startsWith("AMB-")) {
      setRole("ambulance");
      setAmbulanceFilter(code);
    } else {
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
    setAmbulanceFilter(null);
    setLastLatestCaseId(null);
    stopAlarm();
    setShowLoginPopup(true);
  }

  /* ---------------------------------------------------------
     DELETE CASE (Admin only)
----------------------------------------------------------*/
  async function deleteCase(id: string) {
    if (!confirm("Are you sure you want to delete this case?")) return;
    await deleteDoc(doc(db, "cases", id));
    alert("Case deleted.");
  }

  /* ---------------------------------------------------------
     CASE FILTERING (Hide closed)
----------------------------------------------------------*/
  let visibleCases =
    role === "ambulance"
      ? cases.filter((c) => c.ambulanceCode === ambulanceFilter)
      : cases;

  if (!showCompleted) {
    visibleCases = visibleCases.filter((c) => c.status !== "Closed");
  }

  /* ---------------------------------------------------------
     UI (unchanged)
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
              placeholder="Enter role code…"
              className="border p-2 rounded w-full mb-3 dark:bg-gray-700 dark:text-white"
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
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[60]">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg w-80 text-center animate-pulse">
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">
              🚨 New Case Alert!
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

      {/* SHOW/HIDE COMPLETED BUTTON */}
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
                <h2 className="text-xl font-bold dark:text-white">
  <strong>Lazem Code:</strong> {c.lazemCode || "—"}
</h2>

<p className="text-gray-600 dark:text-gray-300">
  <strong>Ijrny Code:</strong> {c.ijrny || "—"}
</p>


                <p>
                  <strong>Complaint:</strong> {c.chiefComplaint}
                </p>
                <p>
                  <strong>Level:</strong> {c.level}
                </p>
                <p>
                  <strong>Status:</strong> {c.status}
                </p>
                <p>
                  <strong>Ambulance:</strong> {c.ambulanceCode || "None"}
                </p>
                <p>
                  <strong>Location:</strong> {c.locationText}
                </p>
              </div>
            </Link>

            {/* ADMIN DELETE */}
            {role === "admin" && (
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
