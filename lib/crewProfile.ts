import { findCrewOrganizationRole } from "@/lib/crewOrganization";

// Temporary launch flag. Keep profile compliance reporting active while allowing
// operational assignments until employees have been asked to complete profiles.
export const CREW_COMPLIANCE_ENFORCEMENT_ENABLED = false;

export type CrewProfileFieldType =
  | "text"
  | "email"
  | "tel"
  | "date"
  | "select"
  | "textarea"
  | "file";

export type CrewProfileField = {
  key: string;
  label: string;
  type: CrewProfileFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  optionsSource?: "roles" | "projects";
};

export type CrewProfileSection = {
  key: string;
  title: string;
  description: string;
  fields: CrewProfileField[];
};

export const CREW_PROFILE_SECTIONS: CrewProfileSection[] = [
  {
    key: "personal",
    title: "Personal Information",
    description: "Identity details used by operations, HR, and medical command.",
    fields: [
      { key: "firstNameEn", label: "First Name (English)", type: "text" },
      { key: "secondNameEn", label: "Second Name (English)", type: "text" },
      { key: "thirdNameEn", label: "Third Name (English)", type: "text" },
      { key: "familyNameEn", label: "Family Name (English)", type: "text" },
      { key: "firstNameAr", label: "First Name (Arabic)", type: "text" },
      { key: "secondNameAr", label: "Second Name (Arabic)", type: "text" },
      { key: "thirdNameAr", label: "Third Name (Arabic)", type: "text" },
      { key: "familyNameAr", label: "Family Name (Arabic)", type: "text" },
      { key: "nationalId", label: "National ID / Iqama", type: "text" },
      { key: "dateOfBirth", label: "Date of Birth", type: "date" },
      {
        key: "nationality",
        label: "Nationality",
        type: "select",
        options: [
          "Saudi Arabia",
          "United Arab Emirates",
          "Bahrain",
          "Kuwait",
          "Oman",
          "Qatar",
          "Egypt",
          "Jordan",
          "Sudan",
          "India",
          "Pakistan",
          "Bangladesh",
          "Philippines",
          "Other",
        ],
      },
      { key: "otherNationality", label: "Other Nationality", type: "text" },
      {
        key: "identityType",
        label: "Identity Type",
        type: "select",
        options: ["National ID", "Iqama"],
      },
      { key: "iqamaExpiry", label: "Iqama Expiry Date", type: "date" },
      {
        key: "gender",
        label: "Gender",
        type: "select",
        options: ["Male", "Female"],
      },
      {
        key: "bloodType",
        label: "Blood Type",
        type: "select",
        options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      },
      { key: "nationalAddressRNumber", label: "National Address Unified Number (R)", type: "text", placeholder: "R..." },
      { key: "nationalIdAttachment", label: "National ID / Iqama Attachment", type: "file" },
    ],
  },
  {
    key: "contact",
    title: "Contact Details",
    description: "Reachability information for scheduling, escalation, and emergency contact.",
    fields: [
      {
        key: "mobileCountryCode",
        label: "Mobile Country Code",
        type: "select",
        options: ["+966", "+971", "+973", "+965", "+968", "+974", "+20", "+962", "+249", "+91", "+92", "+63", "Other"],
      },
      { key: "mobile", label: "Mobile Number", type: "tel", placeholder: "5xxxxxxxx or 05xxxxxxxx" },
      {
        key: "mobileHasWhatsapp",
        label: "Does this number have WhatsApp?",
        type: "select",
        options: ["Yes", "No"],
      },
      {
        key: "alternateCountryCode",
        label: "Alternate Country Code",
        type: "select",
        options: ["+966", "+971", "+973", "+965", "+968", "+974", "+20", "+962", "+249", "+91", "+92", "+63", "Other"],
      },
      { key: "alternateMobile", label: "Alternate Mobile", type: "tel" },
      { key: "email", label: "Email Address", type: "email" },
      { key: "personalEmail", label: "Personal Email", type: "email" },
      {
        key: "city",
        label: "City",
        type: "select",
        options: [
          "Riyadh",
          "Jeddah",
          "Makkah",
          "Madinah",
          "Dammam",
          "Khobar",
          "Dhahran",
          "Jubail",
          "Al Ahsa",
          "Taif",
          "Tabuk",
          "Abha",
          "Khamis Mushait",
          "Jazan",
          "Najran",
          "Hail",
          "Qassim",
          "Yanbu",
          "Other",
        ],
      },
    ],
  },
  {
    key: "employment",
    title: "Employment Details",
    description: "Operational profile data used for assignments and supervisor follow-up.",
    fields: [
      { key: "employeeId", label: "Employee ID", type: "text" },
      {
        key: "roleCategory",
        label: "Role Category",
        type: "select",
        options: ["Medical Role", "Non-Medical Role"],
      },
      { key: "jobTitle", label: "Job Title", type: "select", optionsSource: "roles" },
      { key: "department", label: "Department", type: "text" },
      { key: "supervisorName", label: "Supervisor Name", type: "text" },
      {
        key: "employmentType",
        label: "Employment Type",
        type: "select",
        options: ["Full Time", "Part Time", "Volunteer", "Trainee", "Locum"],
      },
      { key: "joiningDate", label: "Joining Date", type: "date" },
      { key: "contractEndDate", label: "End of Contract Date", type: "date" },
      {
        key: "drivesAmbulance",
        label: "Will This Employee Drive an Ambulance?",
        type: "select",
        options: ["Yes", "No"],
      },
      {
        key: "workLocation",
        label: "Work Location",
        type: "select",
        options: ["Lazem Center / Event", "Project", "Not assigned yet"],
      },
      {
        key: "primaryProjectId",
        label: "Primary Project",
        type: "select",
        optionsSource: "projects",
      },
    ],
  },
  {
    key: "credentials",
    title: "Credentials & Documents",
    description: "Licenses and certification dates needed before deployment.",
    fields: [
      { key: "scfhsNumber", label: "SCFHS Number", type: "text" },
      { key: "scfhsExpiry", label: "SCFHS Expiry Date", type: "date" },
      { key: "scfhsAttachment", label: "SCFHS Attachment", type: "file" },
      { key: "blsNumber", label: "BLS Certificate Number", type: "text" },
      { key: "blsExpiry", label: "BLS Expiry Date", type: "date" },
      { key: "blsAttachment", label: "BLS Attachment", type: "file" },
      { key: "aclsNumber", label: "ACLS Certificate Number", type: "text" },
      { key: "aclsExpiry", label: "ACLS Expiry Date", type: "date" },
      { key: "aclsAttachment", label: "ACLS Attachment", type: "file" },
      {
        key: "phtlsItlsType",
        label: "Trauma Certification Type",
        type: "select",
        options: ["PHTLS", "ITLS"],
      },
      { key: "phtlsItlsNumber", label: "PHTLS / ITLS Certificate Number", type: "text" },
      { key: "phtlsItlsExpiry", label: "PHTLS / ITLS Expiry Date", type: "date" },
      { key: "phtlsItlsAttachment", label: "PHTLS / ITLS Attachment", type: "file" },
      { key: "palsNumber", label: "PALS Certificate Number", type: "text" },
      { key: "palsExpiry", label: "PALS Expiry Date", type: "date" },
      { key: "palsAttachment", label: "PALS Attachment", type: "file" },
      { key: "atlsNumber", label: "ATLS Certificate Number", type: "text" },
      { key: "atlsExpiry", label: "ATLS Expiry Date", type: "date" },
      { key: "atlsAttachment", label: "ATLS Attachment", type: "file" },
      { key: "driverLicenseNumber", label: "Driver License Number", type: "text" },
      { key: "driverLicenseClass", label: "Driver License Class", type: "text" },
      { key: "driverLicenseExpiry", label: "Driver License Expiry", type: "date" },
      { key: "driverLicenseAttachment", label: "Driver License Attachment", type: "file" },
      {
        key: "evocEvosType",
        label: "Emergency Vehicle Course Type",
        type: "select",
        options: ["EVOC", "EVOS"],
      },
      { key: "evocEvosNumber", label: "EVOC / EVOS Certificate Number", type: "text" },
      { key: "evocEvosExpiry", label: "EVOC / EVOS Expiry Date", type: "date" },
      { key: "evocEvosAttachment", label: "EVOC / EVOS Attachment", type: "file" },
      { key: "passportNumber", label: "Passport Number", type: "text" },
      { key: "passportExpiry", label: "Passport Expiry Date", type: "date" },
      { key: "passportAttachment", label: "Passport Attachment", type: "file" },
      { key: "medicalDegreeAttachment", label: "Medical Degree Attachment", type: "file" },
    {
  key: "malpracticeInsuranceCertificateNumber",
  label: "Malpractice Insurance Certificate Number",
  type: "text",
},
{
  key: "malpracticeInsuranceExpiry",
  label: "Malpractice Insurance Expiry Date",
  type: "date",
},
{
  key: "malpracticeInsuranceAttachment",
  label: "Malpractice Insurance Attachment",
  type: "file",
},
    ],
  },
  {
    key: "bank",
    title: "Bank Details",
    description: "Payroll payment information. Saudi IBANs are stored without spaces.",
    fields: [
      { key: "bankName", label: "Bank Name", type: "select" },
      { key: "otherBankName", label: "Other Bank Name", type: "text" },
      {
        key: "accountNumber",
        label: "Account Number",
        type: "text",
        placeholder: "18-digit account number",
      },
      { key: "iban", label: "IBAN", type: "text", placeholder: "SA0000000000000000000000" },
      { key: "ibanAttachment", label: "IBAN Certificate Attachment", type: "file" },
      { key: "alternativeBankName", label: "Alternative Bank Name", type: "select" },
      {
        key: "otherAlternativeBankName",
        label: "Other Alternative Bank Name",
        type: "text",
      },
      {
        key: "alternativeAccountNumber",
        label: "Alternative Account Number",
        type: "text",
        placeholder: "18-digit account number",
      },
      {
        key: "alternativeIban",
        label: "Alternative IBAN",
        type: "text",
        placeholder: "SA0000000000000000000000",
      },
      {
        key: "alternativeIbanAttachment",
        label: "Alternative IBAN Certificate Attachment",
        type: "file",
      },
    ],
  },
  {
    key: "collaborator",
    title: "Collaborator Availability",
    description: "Availability questions for collaborator or on-call crew planning.",
    fields: [
      {
        key: "availableWeekDays",
        label: "Usually Available Days During the Week",
        type: "textarea",
        placeholder: "Example: Sunday, Tuesday, Thursday",
      },
      {
        key: "availableShifts",
        label: "Usually Available Periods",
        type: "select",
        options: ["Morning", "Evening", "Night", "24 Hours", "Flexible", "By Agreement"],
      },
      {
        key: "monthlyAvailabilityLimit",
        label: "Maximum Availability Monthly",
        type: "text",
        placeholder: "Example: 8 days/month or 2 days/week",
      },
      {
        key: "coverageCitiesWithin48h",
        label: "Cities You Can Cover Within 48 Hours",
        type: "textarea",
      },
      {
        key: "outsideCityMaxDuration",
        label: "Maximum Work Duration Outside Your City",
        type: "select",
        options: ["1 Day", "3 Days", "1 Week", "1 Month", "By Agreement", "Other"],
      },
      {
        key: "outsideCityMaxDurationOther",
        label: "Other Duration (Days)",
        type: "text",
      },
    ],
  },
];

export const CREW_PROFILE_FIELDS = CREW_PROFILE_SECTIONS.flatMap(
  (section) => section.fields
);

export type CrewProfileValues = Record<string, string>;

export type CrewProfileRequirementMode = "temporary" | "full";

export function getCrewProfileRequirementMode(user: any): CrewProfileRequirementMode {
  return user?.crewProfileRequirementMode === "full" ? "full" : "temporary";
}

export type CrewAttachmentStatus = "uploaded" | "verified" | "rejected";
export type CrewComplianceStatus =
  | "compliant"
  | "incomplete"
  | "pending_verification"
  | "expiring_soon"
  | "expired"
  | "rejected";

export type CrewProfileAttachment = {
  name?: string;
  url?: string;
  path?: string;
  contentType?: string;
  size?: number;
  uploadedAt?: string;
  uploadedById?: string;
  uploadedByName?: string;
  status?: CrewAttachmentStatus;
  reviewedAt?: string;
  reviewerId?: string;
  reviewerName?: string;
  reviewerEmail?: string;
  rejectionReason?: string;
  verificationHistory?: Array<{
    action: CrewAttachmentStatus;
    at: string;
    actorId?: string;
    actorName?: string;
    actorEmail?: string;
    reason?: string;
  }>;
};

export type CrewProfileAttachments = Record<string, CrewProfileAttachment>;

export function getCrewAttachmentStatus(
  attachment?: CrewProfileAttachment | null
): CrewAttachmentStatus {
  if (attachment?.status === "verified" || attachment?.status === "rejected") {
    return attachment.status;
  }

  return "uploaded";
}

export type CrewJobTitleGroup =
  | "physician"
  | "registered_nurse"
  | "paramedic"
  | "emt"
  | "ambulance_driver"
  | "ccc_admin"
  | "other";

export type CrewCredentialRequirement = {
  key: string;
  label: string;
  planned?: boolean;
};

export const CREW_PROFILE_BASE_REQUIRED_KEYS = [
  "firstNameEn",
  "secondNameEn",
  "thirdNameEn",
  "familyNameEn",
  "firstNameAr",
  "secondNameAr",
  "thirdNameAr",
  "familyNameAr",
  "nationalId",
  "identityType",
  "dateOfBirth",
  "nationality",
  "gender",
  "bloodType",
  "nationalAddressRNumber",
  "nationalIdAttachment",
  "mobileCountryCode",
  "mobile",
  "email",
  "city",
  "roleCategory",
  "jobTitle",
  "department",
  "employmentType",
  "joiningDate",
  "workLocation",
  "primaryProjectId",
  "bankName",
  "accountNumber",
  "iban",
  "ibanAttachment",
] as const;

export const CREW_PROFILE_TEMPORARY_VISIBLE_KEYS = new Set([
  "firstNameEn",
  "secondNameEn",
  "thirdNameEn",
  "familyNameEn",
  "firstNameAr",
  "secondNameAr",
  "thirdNameAr",
  "familyNameAr",
  "nationalId",
  "dateOfBirth",
  "nationality",
  "otherNationality",
  "identityType",
  "iqamaExpiry",
  "gender",
  "bloodType",
  "nationalIdAttachment",
  "mobileCountryCode",
  "mobile",
  "mobileHasWhatsapp",
  "roleCategory",
  "jobTitle",
  "department",
  "employmentType",
  "bankName",
  "otherBankName",
  "accountNumber",
  "iban",
  "ibanAttachment",
]);

export const CREW_PROFILE_TEMPORARY_REQUIRED_KEYS = [
  "firstNameEn",
  "secondNameEn",
  "thirdNameEn",
  "familyNameEn",
  "firstNameAr",
  "secondNameAr",
  "thirdNameAr",
  "familyNameAr",
  "nationalId",
  "dateOfBirth",
  "nationality",
  "identityType",
  "gender",
  "bloodType",
  "nationalIdAttachment",
  "mobileCountryCode",
  "mobile",
  "roleCategory",
  "jobTitle",
  "department",
  "employmentType",
  "bankName",
  "accountNumber",
  "iban",
  "ibanAttachment",
] as const;

const credential = (
  key: string,
  label: string,
  planned = false
): CrewCredentialRequirement => ({ key, label, planned });

const scfhs = [
  credential("scfhsNumber", "SCFHS Number"),
  credential("scfhsExpiry", "SCFHS Expiry Date"),
  credential("scfhsAttachment", "SCFHS Attachment"),
];
const bls = [
  credential("blsNumber", "BLS Certificate Number", true),
  credential("blsExpiry", "BLS Expiry Date"),
  credential("blsAttachment", "BLS Attachment"),
];
const acls = [
  credential("aclsNumber", "ACLS Certificate Number", true),
  credential("aclsExpiry", "ACLS Expiry Date"),
  credential("aclsAttachment", "ACLS Attachment"),
];
const trauma = [
  credential("phtlsItlsType", "Trauma Certification Type"),
  credential("phtlsItlsNumber", "PHTLS / ITLS Certificate Number", true),
  credential("phtlsItlsExpiry", "PHTLS / ITLS Expiry Date", true),
  credential("phtlsItlsAttachment", "PHTLS / ITLS Attachment", true),
];
const driverLicense = [
  credential("driverLicenseNumber", "Driver License Number"),
  credential("driverLicenseClass", "Driver License Class"),
  credential("driverLicenseExpiry", "Driver License Expiry"),
  credential("driverLicenseAttachment", "Driver License Attachment"),
];
const evoc = [
  credential("evocEvosType", "Emergency Vehicle Course Type"),
  credential("evocEvosNumber", "EVOC / EVOS Certificate Number", true),
  credential("evocEvosExpiry", "EVOC / EVOS Expiry Date", true),
  credential("evocEvosAttachment", "EVOC / EVOS Attachment", true),
];

export const CREW_CREDENTIAL_REQUIREMENTS: Record<
  CrewJobTitleGroup,
  CrewCredentialRequirement[]
> = {
  physician: [
    ...scfhs,
    ...bls,
    ...acls,
  ],
  registered_nurse: [...scfhs, ...bls, ...acls],
  paramedic: [...scfhs, ...bls, ...acls, ...trauma],
  emt: [...scfhs, ...bls, ...trauma],
  ambulance_driver: [...driverLicense, ...evoc, ...bls],
  ccc_admin: [],
  other: [],
};

const passportRequirements = [
  credential("passportNumber", "Passport Number"),
  credential("passportExpiry", "Passport Expiry Date"),
  credential("passportAttachment", "Passport Attachment"),
];

const plannedBaseRequirements: CrewCredentialRequirement[] = [];

const plannedNonSaudiRequirements = [
  credential("iqamaExpiry", "Iqama Expiry Date", true),
];

const atlsRequirements = [
  credential("atlsNumber", "ATLS Certificate Number"),
  credential("atlsExpiry", "ATLS Expiry Date"),
  credential("atlsAttachment", "ATLS Attachment"),
];

const palsRequirements = [
  credential("palsNumber", "PALS Certificate Number"),
  credential("palsExpiry", "PALS Expiry Date"),
  credential("palsAttachment", "PALS Attachment"),
];

export function normalizeCrewJobTitle(value: string): CrewJobTitleGroup {
  const title = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");

  if (/physician|doctor|medical officer/.test(title)) return "physician";
  if (/registered nurse|\brn\b|nurse/.test(title)) return "registered_nurse";
  if (/paramedic/.test(title)) return "paramedic";
  if (/\bemt\b|emergency medical technician/.test(title)) return "emt";
  if (/ambulance driver|\bdriver\b/.test(title)) return "ambulance_driver";
  if (
    /ccc|control center|control centre|operator|dispatcher|dispatch|admin|manager|supervisor|coordinator/.test(
      title
    )
  ) {
    return "ccc_admin";
  }
  return "other";
}

export function isSaudiNationality(value: string) {
  const nationality = String(value || "").trim().toLowerCase();
  return nationality === "saudi" || nationality === "saudi arabia";
}

export function getCrewProfileRequirements(
  values: CrewProfileValues,
  mode: CrewProfileRequirementMode = "temporary"
) {
  const titleGroup = normalizeCrewJobTitle(values.jobTitle);
  const availableFieldKeys = new Set(CREW_PROFILE_FIELDS.map((field) => field.key));
  if (mode === "temporary") {
    const temporaryRequirements = CREW_PROFILE_TEMPORARY_REQUIRED_KEYS.map((key) => {
      const field = CREW_PROFILE_FIELDS.find((item) => item.key === key);
      return credential(key, field?.label || key);
    });
    if (values.nationality === "Other") {
      temporaryRequirements.push(credential("otherNationality", "Other Nationality"));
    }
    if (values.nationality && !isSaudiNationality(values.nationality)) {
      temporaryRequirements.push(credential("iqamaExpiry", "Iqama Expiry Date"));
    }
    if (values.bankName === "Other") {
      temporaryRequirements.push(credential("otherBankName", "Other Bank Name"));
    }
    return {
      titleGroup,
      requirements: temporaryRequirements,
      plannedRequirements: [],
    };
  }
  const baseRequirements = CREW_PROFILE_BASE_REQUIRED_KEYS.map((key) => {
    const field = CREW_PROFILE_FIELDS.find((item) => item.key === key);
    return credential(key, field?.label || key);
  });
  const titleRequirements = CREW_CREDENTIAL_REQUIREMENTS[titleGroup];
  const nationalityRequirements =
    values.nationality && !isSaudiNationality(values.nationality)
      ? [...passportRequirements, ...plannedNonSaudiRequirements]
      : [];
  const drivingRequirements =
    titleGroup === "paramedic" && values.drivesAmbulance === "Yes"
      ? [...driverLicense, ...evoc]
      : [];
  const workflowRequirements = [
    ...(titleGroup === "paramedic"
      ? [
          credential(
            "drivesAmbulance",
            "Will This Employee Drive an Ambulance?"
          ),
        ]
      : []),
  ];
  const conditionalRequirements = [
    ...(values.nationality === "Other"
      ? [credential("otherNationality", "Other Nationality")]
      : []),
    ...(values.bankName === "Other"
      ? [credential("otherBankName", "Other Bank Name")]
      : []),
    ...(values.alternativeBankName === "Other"
      ? [credential("otherAlternativeBankName", "Other Alternative Bank Name")]
      : []),
    ...(values.outsideCityMaxDuration === "Other"
      ? [credential("outsideCityMaxDurationOther", "Other Duration (Days)")]
      : []),
  ];

  const allRequirements = [
    ...baseRequirements,
    ...plannedBaseRequirements,
    ...titleRequirements,
    ...nationalityRequirements,
    ...drivingRequirements,
    ...workflowRequirements,
    ...conditionalRequirements,
  ];
  const uniqueRequirements = Array.from(
    new Map(allRequirements.map((item) => [item.key, item])).values()
  );

  return {
    titleGroup,
    requirements: uniqueRequirements.filter((item) => availableFieldKeys.has(item.key)),
    plannedRequirements: uniqueRequirements.filter(
      (item) => item.planned && !availableFieldKeys.has(item.key)
    ),
  };
}

const requirementKeys = (items: CrewCredentialRequirement[]) =>
  new Set(items.map((item) => item.key));

const scfhsKeys = requirementKeys(scfhs);
const blsKeys = requirementKeys(bls);
const aclsKeys = requirementKeys(acls);
const traumaKeys = requirementKeys(trauma);
const driverLicenseKeys = requirementKeys(driverLicense);
const evocKeys = requirementKeys(evoc);
const passportKeys = requirementKeys(passportRequirements);
const atlsKeys = requirementKeys(atlsRequirements);
const palsKeys = requirementKeys(palsRequirements);
const medicalOptionalDocumentKeys = new Set([
  "medicalDegreeAttachment",
  "malpracticeInsuranceCertificateNumber",
  "malpracticeInsuranceExpiry",
  "malpracticeInsuranceAttachment",
]);
const credentialFieldKeys = new Set(
  CREW_PROFILE_SECTIONS.find((section) => section.key === "credentials")?.fields.map(
    (field) => field.key
  ) || []
);

export function isCrewProfileFieldVisible(
  fieldKey: string,
  values: CrewProfileValues,
  mode: CrewProfileRequirementMode = "temporary"
) {
  const titleGroup = normalizeCrewJobTitle(values.jobTitle);
  const hasJobTitle = Boolean(String(values.jobTitle || "").trim());
  const isNonSaudi = Boolean(values.nationality) && !isSaudiNationality(values.nationality);
  const clinicalTitle = [
    "physician",
    "registered_nurse",
    "paramedic",
    "emt",
  ].includes(titleGroup);

  if (mode === "temporary" && !CREW_PROFILE_TEMPORARY_VISIBLE_KEYS.has(fieldKey)) {
    return false;
  }
  if (fieldKey === "iqamaExpiry") return isNonSaudi;
  if (fieldKey === "otherNationality") return values.nationality === "Other";
  if (fieldKey === "otherBankName") return values.bankName === "Other";
  if (fieldKey === "otherAlternativeBankName") {
    return values.alternativeBankName === "Other";
  }
  if (fieldKey === "outsideCityMaxDurationOther") {
    return values.outsideCityMaxDuration === "Other";
  }
  if (fieldKey === "drivesAmbulance") return titleGroup === "paramedic";
  if (!credentialFieldKeys.has(fieldKey)) return true;
  if (!hasJobTitle) return false;

  if (passportKeys.has(fieldKey)) return isNonSaudi;
  // Unknown/custom titles remain visible for safe manual capture until mapped.
  if (titleGroup === "other") return true;
  if (medicalOptionalDocumentKeys.has(fieldKey)) return clinicalTitle;
  if (scfhsKeys.has(fieldKey)) return clinicalTitle;
  if (blsKeys.has(fieldKey)) return titleGroup !== "ccc_admin";
  if (aclsKeys.has(fieldKey)) return clinicalTitle;
  if (traumaKeys.has(fieldKey)) {
    return ["registered_nurse", "paramedic", "emt"].includes(titleGroup);
  }
  if (driverLicenseKeys.has(fieldKey) || evocKeys.has(fieldKey)) {
    return (
      titleGroup === "ambulance_driver" ||
      (titleGroup === "paramedic" && values.drivesAmbulance === "Yes")
    );
  }
  if (palsKeys.has(fieldKey)) {
    const scope = String(values.coverageScope || "").toLowerCase();
    return clinicalTitle && (scope.includes("pediatric") || scope.includes("event"));
  }
  if (atlsKeys.has(fieldKey)) {
    const scope = String(values.coverageScope || "").toLowerCase();
    return titleGroup === "physician" && scope === "adult";
  }

  return false;
}

export function normalizeIban(value: string) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

export function formatIban(value: string) {
  return normalizeIban(value);
}

export function sanitizeSaudiIban(value: string) {
  const compact = normalizeIban(value);
  if (!compact) return "";
  const digits = compact.replace(/^SA/, "").replace(/\D/g, "").slice(0, 22);
  return `SA${digits}`;
}

export function isValidSaudiIban(value: string) {
  return /^SA\d{22}$/.test(normalizeIban(value));
}

export function getCrewProfileValues(user: any): CrewProfileValues {
  const profile = user?.crewProfile || {};
  const attachments = user?.crewProfileAttachments || {};
  const values: CrewProfileValues = {};

  CREW_PROFILE_FIELDS.forEach((field) => {
    const fallback = user?.[field.key];
    values[field.key] = String(
      profile?.[field.key] ?? attachments?.[field.key]?.url ?? fallback ?? ""
    );
  });

  if (!values.email && user?.email) {
    values.email = String(user.email);
  }

  if (!values.mobileCountryCode) {
    values.mobileCountryCode = "+966";
  }

  if (!values.alternateCountryCode) {
    values.alternateCountryCode = "+966";
  }

  if (values.iban) {
    values.iban = formatIban(values.iban);
  }

  if (values.alternativeIban) {
    values.alternativeIban = formatIban(values.alternativeIban);
  }

  if (!values.identityType && values.nationality) {
    values.identityType = isSaudiNationality(values.nationality)
      ? "National ID"
      : "Iqama";
  }

  return values;
}

export function getCrewProfileCompletion(
  values: CrewProfileValues,
  attachments: CrewProfileAttachments = {},
  mode: CrewProfileRequirementMode = "temporary"
) {
  const { titleGroup, requirements, plannedRequirements } =
    getCrewProfileRequirements(values, mode);
  const requiredFields = requirements.map((requirement) => {
    const field = CREW_PROFILE_FIELDS.find((item) => item.key === requirement.key);
    return field || ({ key: requirement.key, label: requirement.label, type: "text" } as CrewProfileField);
  });
  const hasFieldValue = (field: CrewProfileField) =>
    field.type === "file"
      ? Boolean(attachments[field.key]?.url || String(values[field.key] || "").trim())
      : Boolean(String(values[field.key] || "").trim());
  const missing = requiredFields.filter((field) => !hasFieldValue(field));
  const pendingVerification = requiredFields.filter(
    (field) =>
      field.type === "file" &&
      hasFieldValue(field) &&
      getCrewAttachmentStatus(attachments[field.key]) === "uploaded"
  );
  const rejected = requiredFields.filter(
    (field) =>
      field.type === "file" &&
      hasFieldValue(field) &&
      getCrewAttachmentStatus(attachments[field.key]) === "rejected"
  );
  const incompleteKeys = new Set([
    ...missing.map((field) => field.key),
    ...pendingVerification.map((field) => field.key),
    ...rejected.map((field) => field.key),
  ]);
  const complete = requiredFields.filter(
    (field) => !incompleteKeys.has(field.key)
  ).length;
  const percent = requiredFields.length
    ? Math.round((complete / requiredFields.length) * 100)
    : 100;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isExpiryField = (field: CrewProfileField) =>
    field.type === "date" &&
    (field.key.toLowerCase().includes("expiry") ||
      field.key === "contractEndDate");
  const expired = requiredFields.filter((field) => {
    if (!isExpiryField(field)) return false;
    const rawValue = String(values[field.key] || "").trim();
    if (!rawValue) return false;
    const date = new Date(`${rawValue}T00:00:00`);
    return !Number.isNaN(date.getTime()) && date < today;
  });
  const expiringSoon = requiredFields.filter((field) => {
    if (!isExpiryField(field)) return false;
    const rawValue = String(values[field.key] || "").trim();
    if (!rawValue) return false;
    const date = new Date(`${rawValue}T00:00:00`);
    if (Number.isNaN(date.getTime()) || date < today) return false;
    const daysRemaining = Math.ceil(
      (date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
    );
    return daysRemaining <= 90;
  });
  const isMappedJobTitle = Boolean(
    String(values.jobTitle || "").trim() &&
      (titleGroup !== "other" || findCrewOrganizationRole(values.jobTitle))
  );
  const isComplete =
    missing.length === 0 &&
    pendingVerification.length === 0 &&
    rejected.length === 0 &&
    isMappedJobTitle;
  const isCompliant = isComplete && expired.length === 0;
  const complianceStatus: CrewComplianceStatus = rejected.length
    ? "rejected"
    : expired.length
    ? "expired"
    : pendingVerification.length
    ? "pending_verification"
    : missing.length || !isMappedJobTitle
    ? "incomplete"
    : expiringSoon.length
    ? "expiring_soon"
    : "compliant";

  return {
    complete,
    total: requiredFields.length,
    missing,
    pendingVerification,
    rejected,
    percent,
    expired,
    expiringSoon,
    isComplete,
    isCompliant,
    status: isCompliant ? "compliant" : isComplete ? "complete" : "draft",
    complianceStatus,
    requiredKeys: requiredFields.map((field) => field.key),
    titleGroup,
    isMappedJobTitle,
    plannedRequirements,
  };
}

export function isCrewComplianceSubject(user: Record<string, any>) {
  const values = getCrewProfileValues(user);
  if (String(values.jobTitle || "").trim()) return true;
  if (Object.keys(user?.crewProfileAttachments || {}).length > 0) return true;
  if (
    Object.values(user?.crewProfile || {}).some((value) =>
      String(value || "").trim()
    )
  ) {
    return true;
  }

  const role = String(user?.role || "").trim().toLowerCase();
  return /crew|paramedic|emt|nurse|physician|doctor|ambulance|driver|dispatcher|ccc|medical[_ ]team/.test(
    role
  );
}

export function getCrewDeploymentReadiness(user: Record<string, any>) {
  const values = getCrewProfileValues(user);
  const attachments = (user?.crewProfileAttachments || {}) as CrewProfileAttachments;
  const completion = getCrewProfileCompletion(
    values,
    attachments,
    getCrewProfileRequirementMode(user)
  );
  const blockers = [
    ...completion.missing.map((field) => `Missing: ${field.label}`),
    ...completion.pendingVerification.map(
      (field) => `Pending verification: ${field.label}`
    ),
    ...completion.rejected.map((field) => `Rejected: ${field.label}`),
    ...completion.expired.map((field) => `Expired: ${field.label}`),
    ...(!completion.isMappedJobTitle ? ["Job title is not mapped"] : []),
    ...(user?.active === false ? ["User account is inactive"] : []),
  ];

  return {
    ready: blockers.length === 0 && completion.isCompliant,
    blockers: Array.from(new Set(blockers)),
    complianceStatus: completion.complianceStatus,
    completionPercent: completion.percent,
    expiringSoon: completion.expiringSoon,
  };
}
