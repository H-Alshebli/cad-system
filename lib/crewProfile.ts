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
          "Philippines",
          "Other",
        ],
      },
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
      { key: "email", label: "HCAD Email", type: "email" },
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
      { key: "district", label: "District", type: "text" },
      { key: "address", label: "Address", type: "textarea" },
    ],
  },
  {
    key: "employment",
    title: "Employment Details",
    description: "Operational profile data used for assignments and supervisor follow-up.",
    fields: [
      { key: "employeeId", label: "Employee ID", type: "text" },
      { key: "jobTitle", label: "Job Title", type: "select", optionsSource: "roles" },
      {
        key: "clinicalRank",
        label: "Clinical Rank",
        type: "select",
        options: ["EMT", "Paramedic", "Nurse", "Doctor", "Supervisor", "Dispatcher"],
      },
      { key: "department", label: "Department", type: "text" },
      {
        key: "employmentType",
        label: "Employment Type",
        type: "select",
        options: ["Full Time", "Part Time", "Contract", "Volunteer", "Collaborator"],
      },
      { key: "joiningDate", label: "Joining Date", type: "date" },
      { key: "supervisorName", label: "Supervisor Name", type: "text" },
      {
        key: "workLocation",
        label: "Work Location",
        type: "select",
        options: ["Lazem HQ", "Project", "Not assigned yet"],
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
      { key: "blsExpiry", label: "BLS Expiry Date", type: "date" },
      { key: "blsAttachment", label: "BLS Attachment", type: "file" },
      { key: "aclsExpiry", label: "ACLS Expiry Date", type: "date" },
      { key: "aclsAttachment", label: "ACLS Attachment", type: "file" },
      { key: "driverLicenseNumber", label: "Driver License Number", type: "text" },
      { key: "driverLicenseExpiry", label: "Driver License Expiry", type: "date" },
      { key: "driverLicenseAttachment", label: "Driver License Attachment", type: "file" },
      { key: "passportNumber", label: "Passport Number", type: "text" },
      { key: "passportExpiry", label: "Passport Expiry Date", type: "date" },
      { key: "passportAttachment", label: "Passport Attachment", type: "file" },
    ],
  },
  {
    key: "bank",
    title: "Bank Details",
    description: "Payroll payment information. IBAN spacing is cleaned automatically.",
    fields: [
      { key: "bankName", label: "Bank Name", type: "text" },
      { key: "iban", label: "IBAN", type: "text", placeholder: "SA00 0000 0000 0000 0000 0000" },
      { key: "ibanAttachment", label: "IBAN Certificate Attachment", type: "file" },
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
        options: ["1 Day", "3 Days", "1 Week", "1 Month", "By Agreement"],
      },
    ],
  },
];

export const CREW_PROFILE_FIELDS = CREW_PROFILE_SECTIONS.flatMap(
  (section) => section.fields
);

export type CrewProfileValues = Record<string, string>;

export function normalizeIban(value: string) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

export function formatIban(value: string) {
  const compact = normalizeIban(value);
  return compact.replace(/(.{4})/g, "$1 ").trim();
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

  return values;
}

export function getCrewProfileCompletion(values: CrewProfileValues) {
  const explicitlyRequired = CREW_PROFILE_FIELDS.filter((field) => field.required);
  const requiredFields = explicitlyRequired.length
    ? explicitlyRequired
    : CREW_PROFILE_FIELDS.filter((field) => field.type !== "file");
  const missing = requiredFields.filter((field) => !String(values[field.key] || "").trim());
  const complete = requiredFields.length - missing.length;
  const percent = requiredFields.length
    ? Math.round((complete / requiredFields.length) * 100)
    : 100;

  return {
    complete,
    total: requiredFields.length,
    missing,
    percent,
  };
}
