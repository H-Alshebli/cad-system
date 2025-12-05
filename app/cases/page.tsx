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

export default function CasesDashboard() {
  const [cases, setCases] = useState<any[]>([]);

  // Access control
  const [isAdmin, setIsAdmin] = useState(false);
  const [ambulanceFilter, setAmbulanceFilter] = useState<string | null>(null);

  // popup must stay open until correct code entered
  const [showPopup, setShowPopup] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // Load all cases sorted by newest first
  useEffect(() => {
    const q = query(collection(db, "cases"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCases(list);
    });

    return () => unsub();
  }, []);

  // Admin delete function
  async function deleteCase(id: string) {
    if (!confirm("Are you sure you want to delete this case?")) return;
    await deleteDoc(doc(db, "cases", id));
    alert("Case deleted successfully");
  }

  // Handle popup code submission
  function handleCodeSubmit() {
    const codeInput = document.getElementById("accessCode") as HTMLInputElement;
    const code = codeInput.value.trim();

    // Admin Code
    if (code === "1234") {
      setIsAdmin(true);
      setShowPopup(false);
      return;
    }

    // Ambulance Code Example: AMB-001, AMB-002, AMB-003
    if (code.startsWith("AMB-")) {
      setAmbulanceFilter(code);
      setIsAdmin(false);
      setShowPopup(false);
      return;
    }

    // WRONG CODE → popup stays open
    setErrorMessage("Incorrect code. Please enter a valid access code.");
  }

  // Filter cases
  let filteredCases = cases;

  if (ambulanceFilter) {
    filteredCases = cases.filter(
      (c) => c.ambulanceCode === ambulanceFilter
    );
  }

  return (
    <div className="p-6">

      {/* ACCESS CODE POPUP */}
      {showPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-80 text-center">
            <h2 className="text-xl font-bold mb-4">Enter Access Code</h2>

            <input
              id="accessCode"
              type="text"
              placeholder="Enter code (Admin or Ambulance)"
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

      <h1 className="text-2xl font-bold mb-4">Dispatch Dashboard</h1>

      <div className="space-y-3">
        {filteredCases.map((c) => (
          <div key={c.id} className="border p-4 rounded shadow-sm bg-white">

            <Link href={`/cases/${c.id}`}>
              <div className="cursor-pointer hover:bg-gray-100">
                <h2 className="text-xl font-bold">{c.patientName}</h2>
                <p><strong>Complaint:</strong> {c.chiefComplaint}</p>
                <p><strong>Level:</strong> {c.level}</p>
                <p><strong>Status:</strong> {c.status}</p>
                <p><strong>Ambulance Code:</strong> {c.ambulanceCode}</p>
                <p><strong>Location:</strong> {c.locationText}</p>
                <p className="text-gray-400 text-sm mt-1">Click to open →</p>
              </div>
            </Link>

            {/* Delete Case — Only Admin */}
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
