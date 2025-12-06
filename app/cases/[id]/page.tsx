"use client";

import {
  doc,
  updateDoc,
  onSnapshot,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import CaseTimeline from "@/app/components/CaseTimeline";
import Map from "@/app/components/Map";

type DestinationType = "hospital" | "clinic" | null;

export default function CaseDetailsPage({ params }: { params: { id: string } }) {
  const caseId = params.id;

  const [caseData, setCaseData] = useState<any>(null);
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // For Transporting → destination selection flow
  const [showDestinationPopup, setShowDestinationPopup] = useState(false); // ask: hospital or clinic
  const [destinationType, setDestinationType] = useState<DestinationType>(null);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [showDestinationList, setShowDestinationList] = useState(false);

  /* -------------------------------------------------------
     LIVE CASE DATA
  -------------------------------------------------------- */
  useEffect(() => {
    const ref = doc(db, "cases", caseId);

    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setCaseData({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    });

    return () => unsub();
  }, [caseId]);

  /* -------------------------------------------------------
     LOAD AMBULANCES (for code display)
  -------------------------------------------------------- */
  useEffect(() => {
    const loadAmbulances = async () => {
      const ambSnap = await getDocs(collection(db, "ambulances"));
      const list: any[] = [];
      ambSnap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setAmbulances(list);
    };

    loadAmbulances();
  }, []);

  if (loading || !caseData) return <p className="p-6">Loading...</p>;

  /* -------------------------------------------------------
     AMBULANCE CODE
  -------------------------------------------------------- */
  const ambulanceObj = ambulances.find((a) => a.id === caseData.ambulanceId);
  const ambulanceCode = ambulanceObj?.code ?? "None";

  /* -------------------------------------------------------
     STATUS UPDATE (normal statuses)
     Transporting opens popup instead
  -------------------------------------------------------- */
  const handleStatusUpdate = async (newStatus: string) => {
    // Special flow for Transporting
    if (newStatus === "Transporting") {
      setShowDestinationPopup(true);
      return;
    }

    const timestamp = new Date().toISOString();

    await updateDoc(doc(db, "cases", caseId), {
      status: newStatus,
      [`timeline.${newStatus}`]: timestamp,
    });

    setCaseData((prev: any) => ({
      ...prev,
      status: newStatus,
      timeline: {
        ...(prev?.timeline || {}),
        [newStatus]: timestamp,
      },
    }));
  };

  /* -------------------------------------------------------
     STEP 1: Choose Hospital or Clinic
  -------------------------------------------------------- */
  const chooseDestinationType = async (type: DestinationType) => {
    if (!type) return;

    setDestinationType(type);
    setShowDestinationPopup(false);

    // Load list of destinations of this type
    const q = query(
      collection(db, "destinations"),
      where("type", "==", type)
    );

    const snap = await getDocs(q);
    const list: any[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));

    setDestinations(list);
    setShowDestinationList(true);
  };

  /* -------------------------------------------------------
     STEP 2: User picks specific destination
  -------------------------------------------------------- */
  const handleSelectDestination = async (dest: any) => {
    if (!destinationType) return;

    const timestamp = new Date().toISOString();

    await updateDoc(doc(db, "cases", caseId), {
      status: "Transporting",
      transportingToType: destinationType, // "hospital" / "clinic"
      destinationId: dest.id,
      destinationName: dest.name,
      destinationAddress: dest.address || "",
      destinationLat: dest.lat,
      destinationLng: dest.lng,
      "timeline.Transporting": timestamp,
    });

    setCaseData((prev: any) => ({
      ...prev,
      status: "Transporting",
      transportingToType: destinationType,
      destinationId: dest.id,
      destinationName: dest.name,
      destinationAddress: dest.address || "",
      destinationLat: dest.lat,
      destinationLng: dest.lng,
      timeline: {
        ...(prev?.timeline || {}),
        Transporting: timestamp,
      },
    }));

    setShowDestinationList(false);
  };

  /* -------------------------------------------------------
     SAVE EDITS
  -------------------------------------------------------- */
  const saveEdits = async () => {
    await updateDoc(doc(db, "cases", caseId), {
      chiefComplaint: caseData.chiefComplaint,
      level: Number(caseData.level),
      paramedicNote: caseData.paramedicNote || "",
    });

    alert("Case updated!");
  };

  /* -------------------------------------------------------
     RENDER UI
  -------------------------------------------------------- */
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Case Details</h1>

      {/* CASE INFO */}
      <div
        className="
          border p-6 rounded-lg shadow mb-6
          bg-white text-gray-900 border-gray-300
          dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700
        "
      >
        <p>
          <strong>Patient:</strong> {caseData.patientName}
        </p>
        <p>
          <strong>Complaint:</strong> {caseData.chiefComplaint}
        </p>
        <p>
          <strong>Level:</strong> {caseData.level}
        </p>
        <p>
          <strong>Status:</strong> {caseData.status}
        </p>
        <p>
          <strong>Location:</strong> {caseData.locationText}
        </p>
        <p>
          <strong>Ambulance:</strong> {ambulanceCode}
        </p>

        <p className="mt-2">
          <strong>Destination:</strong>{" "}
          {caseData.destinationName
            ? `${caseData.destinationName} (${caseData.transportingToType})`
            : "—"}
        </p>
        {caseData.destinationAddress && (
          <p>
            <strong>Destination Address:</strong> {caseData.destinationAddress}
          </p>
        )}
      </div>

      {/* UPDATE STATUS */}
      <h2 className="text-xl font-semibold mb-2">Update Status</h2>
      <div className="grid grid-cols-3 md:grid-cols-7 gap-2 mb-6">
        {[
          "Received",
          "Assigned",
          "EnRoute",
          "OnScene",
          "Transporting",
          "Hospital",
          "Closed",
        ].map((s) => (
          <button
            key={s}
            onClick={() => handleStatusUpdate(s)}
            className={`p-2 rounded text-white text-sm md:text-base ${
              caseData.status === s ? "bg-green-600" : "bg-blue-600"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* TIMELINE */}
      <CaseTimeline timeline={caseData.timeline || {}} />

      {/* EDIT CASE */}
      <div
        className="
          mt-10 max-w-xl
          border p-6 rounded-lg shadow
          bg-white text-gray-900 border-gray-300
          dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700
        "
      >
        <h2 className="text-xl font-bold mb-4">Edit Case</h2>

        <label className="block font-semibold mb-1">Complaint</label>
        <input
          className="border rounded w-full mb-4 p-2
                     bg-white text-gray-900 border-gray-300
                     dark:bg-gray-900 dark:text-gray-100 dark:border-gray-600"
          value={caseData.chiefComplaint}
          onChange={(e) =>
            setCaseData({ ...caseData, chiefComplaint: e.target.value })
          }
        />

        <label className="block font-semibold mb-1">Level</label>
        <select
          className="border rounded w-full mb-4 p-2
                     bg-white text-gray-900 border-gray-300
                     dark:bg-gray-900 dark:text-gray-100 dark:border-gray-600"
          value={caseData.level}
          onChange={(e) =>
            setCaseData({ ...caseData, level: Number(e.target.value) })
          }
        >
          <option value="1">Level 1 - Critical</option>
          <option value="2">Level 2 - Emergency</option>
          <option value="3">Level 3 - Urgent</option>
          <option value="4">Level 4 - Non-Urgent</option>
        </select>

        <label className="block font-semibold mb-1">Paramedic Note</label>
        <textarea
          className="border rounded w-full h-28 mb-4 p-2
                     bg-white text-gray-900 border-gray-300
                     dark:bg-gray-900 dark:text-gray-100 dark:border-gray-600"
          value={caseData.paramedicNote || ""}
          onChange={(e) =>
            setCaseData({ ...caseData, paramedicNote: e.target.value })
          }
        />

        <button
          onClick={saveEdits}
          className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded w-full"
        >
          Save Changes
        </button>
      </div>

      {/* MAPS */}
      {(caseData.lat && caseData.lng) || (caseData.destinationLat && caseData.destinationLng) ? (
        <div className="mt-10 space-y-6">
          {caseData.lat && caseData.lng && (
            <div>
              <h2 className="text-xl font-bold mb-2">Patient Location</h2>
              <Map
                lat={Number(caseData.lat)}
                lng={Number(caseData.lng)}
                name={caseData.patientName}
              />
            </div>
          )}

          {caseData.destinationLat && caseData.destinationLng && (
            <div>
              <h2 className="text-xl font-bold mb-2">Hospital\Clinic Location</h2>
              <Map
                lat={Number(caseData.destinationLat)}
                lng={Number(caseData.destinationLng)}
                name={caseData.destinationName}
              />
            </div>
          )}
        </div>
      ) : null}

      {/* POPUP 1: Hospital or Clinic */}
      {showDestinationPopup && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div
            className="
              bg-white text-gray-900 p-6 rounded-lg shadow w-80 text-center
              dark:bg-gray-800 dark:text-gray-100
            "
          >
            <h2 className="text-xl font-bold mb-4">Transporting To?</h2>

            <button
              onClick={() => chooseDestinationType("hospital")}
              className="bg-blue-600 text-white w-full p-2 rounded mb-2"
            >
              Hospital
            </button>

            <button
              onClick={() => chooseDestinationType("clinic")}
              className="bg-green-600 text-white w-full p-2 rounded mb-2"
            >
              Clinic
            </button>

            <button
              onClick={() => setShowDestinationPopup(false)}
              className="mt-2 text-sm text-gray-600 dark:text-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* POPUP 2: Destination List */}
      {showDestinationList && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div
            className="
              bg-white text-gray-900 p-6 rounded-lg shadow w-96
              dark:bg-gray-800 dark:text-gray-100
            "
          >
            <h2 className="text-xl font-bold mb-4 text-center">
              Select {destinationType === "hospital" ? "Hospital" : "Clinic"}
            </h2>

            {destinations.length === 0 && (
              <p className="text-sm mb-4">
                No {destinationType} destinations found in Firestore.
              </p>
            )}

            <div className="max-h-64 overflow-y-auto space-y-2">
              {destinations.map((d) => (
                <button
                  key={d.id}
                  onClick={() => handleSelectDestination(d)}
                  className="w-full text-left p-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  <div className="font-semibold">{d.name}</div>
                  {d.address && (
                    <div className="text-xs opacity-80">{d.address}</div>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowDestinationList(false)}
              className="mt-4 w-full py-2 rounded border border-gray-300 text-sm
                         dark:border-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
