"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useState } from "react";

const REQUEST_TYPES = [
  "Clinic",
  "Ambulance Coverage",
  "Ambulance Transportation",
  "Station Operation",
  "Other",
];

const SERVICE_TYPES = ["BLS", "ALS"];

const EVENT_TYPES = [
  "Factory",
  "Ceremony",
  "Sports",
  "Festival",
  "Construction Site",
  "Corporate Event",
  "School",
  "Other",
];

export default function NewProjectPage() {
  const router = useRouter();

  const [projectName, setProjectName] = useState("");
  const [client, setClient] = useState("");

  const [siteDetails, setSiteDetails] = useState("");
  const [requestType, setRequestType] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [eventType, setEventType] = useState("");

  const [ambulanceNumber, setAmbulanceNumber] = useState("");
  const [equipment, setEquipment] = useState("");
  const [medicalBagNumber, setMedicalBagNumber] = useState("");
  const [medicationBagNumber, setMedicationBagNumber] = useState("");

  const [organizerName, setOrganizerName] = useState("");
  const [organizerMobile, setOrganizerMobile] = useState("");
  const [eventLocation, setEventLocation] = useState("");

  const createProject = async () => {
    if (!projectName.trim()) {
      alert("Project name is required.");
      return;
    }

    const docRef = await addDoc(collection(db, "projects"), {
      projectName: projectName.trim(),
      client: client.trim(),
      status: "Active",
      isArchived: false,
      projectDetails: {
        siteDetails: siteDetails.trim(),
        requestType,
        serviceType,
        eventType,
        ambulanceNumber: ambulanceNumber.trim(),
        equipment: equipment.trim(),
        medicalBagNumber: medicalBagNumber.trim(),
        medicationBagNumber: medicationBagNumber.trim(),
        organizerName: organizerName.trim(),
        organizerMobile: organizerMobile.trim(),
        eventLocation: eventLocation.trim(),
      },
      createdAt: serverTimestamp(),
    });

    router.push(`/projects/${docRef.id}`);
  };

  const inputClass =
    "w-full h-11 rounded-lg border border-slate-700 bg-[#0b1220] px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500";

  const selectClass =
    "w-full h-11 rounded-lg border border-slate-700 bg-[#0b1220] px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500";

  const textareaClass =
    "w-full rounded-lg border border-slate-700 bg-[#0b1220] px-3 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500";

  const labelClass = "mb-1.5 block text-xs font-medium text-slate-300";

  const cardClass =
    "rounded-2xl border border-slate-800 bg-[#111827] p-4 md:p-5 shadow-sm";

  return (
    <div className="min-h-screen bg-[#030712] p-6">
      <div className="w-full max-w-none space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-white">New Project</h1>
          <p className="mt-1 text-sm text-slate-400">
            Add project and site information before creating the record.
          </p>
        </div>

        {/* Top row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Basic Information */}
          <div className={cardClass}>
            <h2 className="mb-4 text-sm font-semibold text-white">
              Basic Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Project Name</label>
                <input
                  className={inputClass}
                  placeholder="Enter project name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>

              <div>
                <label className={labelClass}>Client</label>
                <input
                  className={inputClass}
                  placeholder="Enter client name"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Project / Site Details */}
          <div className={cardClass}>
            <h2 className="mb-4 text-sm font-semibold text-white">
              Project / Site Details
            </h2>

            <div className="space-y-4">
              <div>
                <label className={labelClass}>Project / Site Details</label>
                <textarea
                  className={`${textareaClass} min-h-[120px]`}
                  placeholder="Any details requested by the client..."
                  value={siteDetails}
                  onChange={(e) => setSiteDetails(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>
                    Type of Request from Client
                  </label>
                  <select
                    className={selectClass}
                    value={requestType}
                    onChange={(e) => setRequestType(e.target.value)}
                  >
                    <option value="">Select request type</option>
                    {REQUEST_TYPES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Service Type</label>
                  <select
                    className={selectClass}
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                  >
                    <option value="">Select service type</option>
                    {SERVICE_TYPES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Event Type</label>
                  <select
                    className={selectClass}
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                  >
                    <option value="">Select event type</option>
                    {EVENT_TYPES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Medical / Equipment Information */}
          <div className={cardClass}>
            <h2 className="mb-4 text-sm font-semibold text-white">
              Medical / Equipment Information
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Ambulance Number</label>
                  <input
                    className={inputClass}
                    placeholder="Enter ambulance number"
                    value={ambulanceNumber}
                    onChange={(e) => setAmbulanceNumber(e.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Medical Bag Number</label>
                  <input
                    className={inputClass}
                    placeholder="Enter medical bag number"
                    value={medicalBagNumber}
                    onChange={(e) => setMedicalBagNumber(e.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Medication Bag Number</label>
                  <input
                    className={inputClass}
                    placeholder="Enter medication bag number"
                    value={medicationBagNumber}
                    onChange={(e) => setMedicationBagNumber(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Equipment</label>
                <textarea
                  className={`${textareaClass} min-h-[110px]`}
                  placeholder="List equipment details..."
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Organizer / Event Information */}
          <div className={cardClass}>
            <h2 className="mb-4 text-sm font-semibold text-white">
              Organizer / Event Information
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Organizer Name</label>
                  <input
                    className={inputClass}
                    placeholder="Enter organizer name"
                    value={organizerName}
                    onChange={(e) => setOrganizerName(e.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Organizer Mobile Number</label>
                  <input
                    className={inputClass}
                    placeholder="Enter organizer mobile number"
                    value={organizerMobile}
                    onChange={(e) => setOrganizerMobile(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Event Location</label>
                <textarea
                  className={`${textareaClass} min-h-[110px]`}
                  placeholder="Enter event location"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom actions */}
        <div className={cardClass}>
          <div className="flex items-center gap-3">
            <button
              onClick={createProject}
              className="rounded-lg bg-[#2f3d59] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3b4c6d] transition"
            >
              Save Project
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}