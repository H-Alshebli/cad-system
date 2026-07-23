import { runSeed, type SeedDocument } from "./seed-lib";

const DEMO_SEED_SOURCE = "hcad-demo-seed" as const;

const dispatcherUid = "sandbox-dispatcher";
const paramedicOneUid = "sandbox-paramedic-01";
const paramedicTwoUid = "sandbox-paramedic-02";
const managerUid = "sandbox-ops-manager";

const projectId = "sandbox-riyadh-ems-coverage";
const clinicProjectId = "sandbox-industrial-clinic-demo";
const hospitalId = "sandbox-general-hospital";
const clinicId = "sandbox-medical-clinic";
const blsAmbulanceId = "sbx-bls-001";
const blsAmbulanceTwoId = "sbx-bls-002";
const alsAmbulanceId = "sbx-als-001";

function timestampIso(offsetHours = 0) {
  return new Date(Date.now() + offsetHours * 60 * 60 * 1000).toISOString();
}

function demoUser(
  id: string,
  name: string,
  email: string,
  role: string,
  extra: Record<string, unknown> = {}
): SeedDocument {
  return {
    collection: "users",
    id,
    seedSource: DEMO_SEED_SOURCE,
    description: `fictional user profile for ${name}`,
    data: {
      uid: id,
      name,
      email,
      active: true,
      role,
      ...extra,
    },
  };
}

function destination(
  id: string,
  name: string,
  type: "hospital" | "clinic",
  lat: number,
  lng: number,
  address: string
): SeedDocument {
  return {
    collection: "destinations",
    id,
    seedSource: DEMO_SEED_SOURCE,
    description: `fictional ${type} destination`,
    data: {
      name,
      type,
      lat,
      lng,
      address,
      googleMapLink: `https://maps.google.com/?q=${lat},${lng}`,
      archived: false,
    },
  };
}

function ambulance(
  id: string,
  code: string,
  location: string,
  status: "available" | "busy" | "offline",
  crewUserIds: string[] = []
): SeedDocument {
  const crewMembers = crewUserIds.map((userId) => {
    const memberName =
      userId === paramedicOneUid
        ? "Sandbox Paramedic One"
        : userId === paramedicTwoUid
        ? "Sandbox Paramedic Two"
        : "Sandbox Crew Member";

    return {
      userId,
      name: memberName,
      email: `${userId}@sandbox.example`,
      role: "paramedic",
    };
  });

  return {
    collection: "ambulances",
    id,
    seedSource: DEMO_SEED_SOURCE,
    description: `fictional ambulance ${code}`,
    data: {
      code,
      location,
      status,
      currentCase: null,
      currentCaseId: null,
      assignedProjectId: null,
      assignedProjectName: null,
      projectId: null,
      projectName: null,
      crewMembers,
      crewUserIds,
      crew: crewMembers.map((member) => member.name),
      assignedUserIds: crewUserIds,
      assignedTeamGroup: `${code} Team`,
      lat: 24.7136,
      lng: 46.6753,
      archived: false,
    },
  };
}

function project(
  id: string,
  projectName: string,
  client: string,
  assignedAmbulanceIds: string[],
  projectHospitalIds: string[]
): SeedDocument {
  const assignedUsers = {
    [dispatcherUid]: true,
    [paramedicOneUid]: true,
    [paramedicTwoUid]: true,
    [managerUid]: true,
  };

  return {
    collection: "projects",
    id,
    seedSource: DEMO_SEED_SOURCE,
    description: `fictional project ${projectName}`,
    data: {
      projectName,
      client,
      status: "Active",
      isArchived: false,
      assignedUsers,
      assignedAmbulanceIds,
      assignedAmbulances: assignedAmbulanceIds.map((ambulanceId) => ({
        id: ambulanceId,
        code: ambulanceId.toUpperCase(),
        location: "Riyadh Sandbox Zone",
        status: "available",
        crewUserIds: [paramedicOneUid, paramedicTwoUid],
        crewMembers: [
          {
            userId: paramedicOneUid,
            name: "Sandbox Paramedic One",
            email: "sandbox.paramedic1@sandbox.example",
            role: "paramedic",
          },
          {
            userId: paramedicTwoUid,
            name: "Sandbox Paramedic Two",
            email: "sandbox.paramedic2@sandbox.example",
            role: "paramedic",
          },
        ],
      })),
      projectHospitalIds,
      projectHospitals: projectHospitalIds.map((destinationId) => ({
        id: destinationId,
        name:
          destinationId === hospitalId
            ? "Sandbox General Hospital"
            : "Sandbox Medical Clinic",
        type: destinationId === hospitalId ? "hospital" : "clinic",
        lat: destinationId === hospitalId ? 24.7743 : 24.6981,
        lng: destinationId === hospitalId ? 46.7386 : 46.6841,
        address:
          destinationId === hospitalId
            ? "Sandbox Hospital District, Riyadh"
            : "Sandbox Industrial Clinic, Riyadh",
      })),
      projectDetails: {
        siteDetails: "Fictional Sandbox site used for HCAD workflow validation.",
        requestType: "Ambulance Coverage",
        serviceType: "BLS",
        eventType: "Corporate Event",
        ambulanceNumber: assignedAmbulanceIds.join(", "),
        equipment: "Sandbox demo equipment only.",
        medicalBagNumber: "SBX-MED-BAG-001",
        medicationBagNumber: "SBX-RX-BAG-001",
        organizerName: "Sandbox Coordinator",
        organizerMobile: "+966500000000",
        eventLocation: "Riyadh Sandbox Zone",
      },
    },
  };
}

function caseDocument(id: string, status: string, assignedUnitId?: string): SeedDocument {
  return {
    collection: "cases",
    id,
    seedSource: DEMO_SEED_SOURCE,
    description: `fictional CAD case in ${status} status`,
    data: {
      sourceType: "PROJECT",
      projectId,
      projectName: "Riyadh Sandbox EMS Coverage",
      patientName: `Sandbox Patient ${status}`,
      chiefComplaint: "Sandbox training scenario",
      level: "Level 4 (Less Urgent)",
      status,
      dispatchStatus: status,
      assignedUnit: assignedUnitId
        ? {
            type: "ambulance",
            id: assignedUnitId,
            code: assignedUnitId.toUpperCase(),
          }
        : null,
      assignedUserIds: assignedUnitId ? [paramedicOneUid, paramedicTwoUid] : [],
      location: {
        text: "Sandbox pickup location",
        googleMapLink: "https://maps.google.com/?q=24.7136,46.6753",
        source: "hcad_demo_seed",
      },
      locationText: "Sandbox pickup location",
      destination: {
        id: hospitalId,
        text: "Sandbox General Hospital",
        name: "Sandbox General Hospital",
        type: "hospital",
        lat: 24.7743,
        lng: 46.7386,
      },
      timeline: {
        Received: status === "Received" ? timestampIso(-6) : null,
        Assigned: ["Assigned", "EnRoute", "OnScene", "Transporting", "Hospital", "Closed"].includes(status)
          ? timestampIso(-5)
          : null,
        EnRoute: ["EnRoute", "OnScene", "Transporting", "Hospital", "Closed"].includes(status)
          ? timestampIso(-4)
          : null,
        OnScene: ["OnScene", "Transporting", "Hospital", "Closed"].includes(status)
          ? timestampIso(-3)
          : null,
        Transporting: ["Transporting", "Hospital", "Closed"].includes(status)
          ? timestampIso(-2)
          : null,
        Hospital: ["Hospital", "Closed"].includes(status) ? timestampIso(-1) : null,
        Closed: status === "Closed" ? timestampIso(0) : null,
      },
      notes: "Fictional Sandbox case. No real patient data.",
      isArchived: false,
    },
  };
}

function epcrDocument(caseId: string): SeedDocument {
  return {
    collection: "epcr",
    id: caseId,
    seedSource: DEMO_SEED_SOURCE,
    description: "fictional draft ePCR linked to demo CAD case",
    data: {
      epcrId: caseId,
      caseId,
      projectId,
      projectName: "Riyadh Sandbox EMS Coverage",
      sourceType: "PROJECT",
      patientInfo: {
        patientId: "SBX-PATIENT-001",
        firstName: "Sandbox",
        lastName: "Patient",
        age: 34,
        gender: "unknown",
        phone: "+966500000000",
        factoryName: "Riyadh Sandbox EMS Coverage",
        nationality: "Other",
        triageColor: "Level 4 (Less Urgent)",
        healthClassification: "",
        chiefComplaints: ["Sandbox training scenario"],
        signsAndSymptoms: [],
      },
      caseSnapshot: {
        sourceType: "PROJECT",
        customerName: "Sandbox Coordinator",
        customerMobile: "+966500000000",
        serviceType: "Ambulance Coverage",
        chiefComplaint: "Sandbox training scenario",
        pickupText: "Sandbox pickup location",
        pickupMapLink: "https://maps.google.com/?q=24.7136,46.6753",
        pickupLat: 24.7136,
        pickupLng: 46.6753,
        destinationText: "Sandbox General Hospital",
        destinationMapLink: "https://maps.google.com/?q=24.7743,46.7386",
        destinationLat: 24.7743,
        destinationLng: 46.7386,
        assignedUnit: {
          type: "ambulance",
          id: blsAmbulanceId,
          code: "SBX-BLS-001",
        },
        assignedAmbulanceId: blsAmbulanceId,
        assignedAmbulanceCode: "SBX-BLS-001",
        assignedUserIds: [paramedicOneUid, paramedicTwoUid],
      },
      narrative: {
        narrative: "Fictional Sandbox ePCR narrative.",
        contactedMedicalDirector: false,
        contactedTime: null,
        doctorName: "",
      },
      assessment: {
        primaryAssessment: "Sandbox primary assessment.",
        secondaryAssessment: "",
        impression: "Demo only.",
      },
      vitals: [],
      treatment: {
        procedures: [],
        medications: [],
        oxygenTherapy: "",
        notes: "",
      },
      transport: {
        destination: "Sandbox General Hospital",
        handoverTo: "",
        handoverTime: null,
        receivingFacility: "Sandbox General Hospital",
      },
      status: "draft",
      locked: false,
      finalizedAt: null,
      createdBy: paramedicOneUid,
    },
  };
}

const documents: SeedDocument[] = [
  demoUser(dispatcherUid, "Sandbox Dispatcher", "sandbox.dispatcher@sandbox.example", "dispatcher"),
  demoUser(paramedicOneUid, "Sandbox Paramedic One", "sandbox.paramedic1@sandbox.example", "paramedic", {
    ambulanceIds: [blsAmbulanceId, alsAmbulanceId],
  }),
  demoUser(paramedicTwoUid, "Sandbox Paramedic Two", "sandbox.paramedic2@sandbox.example", "paramedic", {
    ambulanceIds: [blsAmbulanceId, blsAmbulanceTwoId],
  }),
  demoUser(managerUid, "Sandbox Operations Manager", "sandbox.manager@sandbox.example", "operations_manager"),
  destination(hospitalId, "Sandbox General Hospital", "hospital", 24.7743, 46.7386, "Sandbox Hospital District, Riyadh"),
  destination(clinicId, "Sandbox Medical Clinic", "clinic", 24.6981, 46.6841, "Sandbox Industrial Clinic, Riyadh"),
  ambulance(blsAmbulanceId, "SBX-BLS-001", "Riyadh Sandbox Zone A", "available", [paramedicOneUid, paramedicTwoUid]),
  ambulance(blsAmbulanceTwoId, "SBX-BLS-002", "Riyadh Sandbox Zone B", "available", [paramedicTwoUid]),
  ambulance(alsAmbulanceId, "SBX-ALS-001", "Riyadh Sandbox Zone C", "available", [paramedicOneUid]),
  project(projectId, "Riyadh Sandbox EMS Coverage", "Sandbox Client", [blsAmbulanceId, alsAmbulanceId], [hospitalId, clinicId]),
  project(clinicProjectId, "Industrial Clinic Demo", "Sandbox Industrial Client", [], [clinicId, hospitalId]),
  caseDocument("sandbox-case-received", "Received"),
  caseDocument("sandbox-case-assigned", "Assigned", blsAmbulanceId),
  caseDocument("sandbox-case-enroute", "EnRoute", blsAmbulanceId),
  caseDocument("sandbox-case-onscene", "OnScene", alsAmbulanceId),
  caseDocument("sandbox-case-transporting", "Transporting", alsAmbulanceId),
  caseDocument("sandbox-case-hospital", "Hospital", blsAmbulanceTwoId),
  caseDocument("sandbox-case-closed", "Closed", blsAmbulanceTwoId),
  epcrDocument("sandbox-case-closed"),
  {
    collection: "transport_requests",
    id: "sandbox-transport-request-001",
    seedSource: DEMO_SEED_SOURCE,
    description: "fictional transport coverage request",
    data: {
      projectType: "transporting",
      serviceType: "BLS",
      serviceTime: timestampIso(24),
      serviceStartTime: timestampIso(24),
      serviceEndTime: timestampIso(30),
      requirements: "Fictional Sandbox transport request.",
      teams: [{ composition: "emt_paramedic", qty: 1 }],
      teamNeeded: true,
      teamCount: 1,
      teamType: "BLS",
      teamComposition: "emt_paramedic",
      ambulanceNeeded: true,
      ambulanceCount: 1,
      roamingNeeded: false,
      roamingCount: 0,
      daysCount: 1,
      hoursCount: 6,
      cityScope: "inside",
      cityName: "Riyadh",
      status: "new",
      createdBy: dispatcherUid,
      updatedBy: dispatcherUid,
      salesOwnerUid: dispatcherUid,
      salesOwnerEmail: "sandbox.dispatcher@sandbox.example",
    },
  },
  {
    collection: "partnerBookings",
    id: "sandbox-partner-booking-001",
    seedSource: DEMO_SEED_SOURCE,
    description: "fictional Partner API booking for API dashboard validation",
    data: {
      partnerId: "amigo-sandbox",
      externalReference: "AMIGO-SBX-DEMO-001",
      idempotencyKey: "sandbox-demo-idempotency-key",
      status: "pending_review",
      patient: {
        name: "Sandbox Partner Patient",
        phone: "+966500000000",
        age: 42,
        gender: "unknown",
      },
      service: {
        type: "Ambulance Transportation",
        requestedAt: timestampIso(12),
        notes: "Fictional Partner API seed booking.",
      },
      pickup: {
        text: "Sandbox partner pickup location",
        lat: 24.7136,
        lng: 46.6753,
      },
      destination: {
        text: "Sandbox General Hospital",
        lat: 24.7743,
        lng: 46.7386,
      },
      source: "partner_api_v1",
      createdVia: "partner_api",
    },
  },
  {
    collection: "partnerBookingIdempotency",
    id: "sandbox-partner-booking-001-idempotency",
    seedSource: DEMO_SEED_SOURCE,
    description: "fictional idempotency marker for seeded Partner Booking",
    data: {
      partnerId: "amigo-sandbox",
      idempotencyKeyHash: "sandbox-demo-hash-not-a-real-key",
      requestHash: "sandbox-demo-request-hash-not-a-real-key",
      bookingId: "sandbox-partner-booking-001",
    },
  },
];

runSeed("demo", documents).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
