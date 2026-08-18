export type CrewRoleCategory = "medical" | "non_medical";

export type CrewOrganizationRole = {
  title: string;
  category: CrewRoleCategory;
  department: string;
  team: string;
  supervisorName: string;
  managerName: string;
};

const MEDICAL_SERVICES = "Medical Services Delivery";
const SUPPLY_CHAIN = "Service Prep & Supply Chain";
const COMMAND_CENTRE = "Control Command Centre";

export const CREW_ORGANIZATION_ROLES: CrewOrganizationRole[] = [
  ...["Physician", "Doctor", "Registered Nurse", "Paramedic", "EMT", "Emergency Medical Technician"].map(
    (title) => ({
      title,
      category: "medical" as const,
      department: MEDICAL_SERVICES,
      team: "Field Operations",
      supervisorName: "Najla Alzanaan (EMS Lead)",
      managerName: "Abdulrahman Alrubayia (Medical Services Delivery Manager)",
    })
  ),
  {
    title: "Project Management Senior Supervisor",
    category: "non_medical",
    department: MEDICAL_SERVICES,
    team: "Project Management",
    supervisorName: "Abdulrahman Alrubayia (Medical Services Delivery Manager)",
    managerName: "Abdulrahman Alrubayia (Medical Services Delivery Manager)",
  },
  {
    title: "Project Management Supervisor",
    category: "non_medical",
    department: MEDICAL_SERVICES,
    team: "Project Management",
    supervisorName: "Abdulrahman Alrubayia (Medical Services Delivery Manager)",
    managerName: "Abdulrahman Alrubayia (Medical Services Delivery Manager)",
  },
  {
    title: "Project Management Specialist",
    category: "non_medical",
    department: MEDICAL_SERVICES,
    team: "Project Management",
    supervisorName: "Abdulaziz Alhuzaim (Senior Supervisor)",
    managerName: "Abdulrahman Alrubayia (Medical Services Delivery Manager)",
  },
  {
    title: "Field Operations Senior Supervisor",
    category: "non_medical",
    department: MEDICAL_SERVICES,
    team: "Field Operations",
    supervisorName: "Abdulrahman Alrubayia (Medical Services Delivery Manager)",
    managerName: "Abdulrahman Alrubayia (Medical Services Delivery Manager)",
  },
  {
    title: "Field Operations Supervisor",
    category: "non_medical",
    department: MEDICAL_SERVICES,
    team: "Field Operations",
    supervisorName: "Ahmad Alsafadi (Senior Supervisor)",
    managerName: "Abdulrahman Alrubayia (Medical Services Delivery Manager)",
  },
  {
    title: "EMS Lead",
    category: "medical",
    department: MEDICAL_SERVICES,
    team: "Field Operations",
    supervisorName: "Husain Alshammari (Supervisor)",
    managerName: "Abdulrahman Alrubayia (Medical Services Delivery Manager)",
  },
  {
    title: "Workforce Officer",
    category: "non_medical",
    department: MEDICAL_SERVICES,
    team: "Field Operations",
    supervisorName: "Ahmad Alsafadi (Senior Supervisor)",
    managerName: "Abdulrahman Alrubayia (Medical Services Delivery Manager)",
  },
  {
    title: "Inventory Senior Officer",
    category: "non_medical",
    department: SUPPLY_CHAIN,
    team: "Inventory Team",
    supervisorName: "Abdullah Alqarawi (Service Prep & Supply Chain Manager)",
    managerName: "Abdullah Alqarawi (Service Prep & Supply Chain Manager)",
  },
  {
    title: "Inventory Officer",
    category: "non_medical",
    department: SUPPLY_CHAIN,
    team: "Inventory Team",
    supervisorName: "Mubarak Abkar (Senior Officer)",
    managerName: "Abdullah Alqarawi (Service Prep & Supply Chain Manager)",
  },
  {
    title: "Fleet Senior Officer",
    category: "non_medical",
    department: SUPPLY_CHAIN,
    team: "Fleet Team",
    supervisorName: "Abdullah Alqarawi (Service Prep & Supply Chain Manager)",
    managerName: "Abdullah Alqarawi (Service Prep & Supply Chain Manager)",
  },
  {
    title: "Logistics Officer",
    category: "non_medical",
    department: SUPPLY_CHAIN,
    team: "Fleet Team",
    supervisorName: "Zubair Almubarak (Senior Officer)",
    managerName: "Abdullah Alqarawi (Service Prep & Supply Chain Manager)",
  },
  {
    title: "Dispatch Supervisor",
    category: "non_medical",
    department: COMMAND_CENTRE,
    team: "Dispatch Team",
    supervisorName: "Abdulrahman Alrubayia (Acting Control Command Centre Manager)",
    managerName: "Abdulrahman Alrubayia (Acting Control Command Centre Manager)",
  },
  {
    title: "Emergency Medical Dispatcher",
    category: "non_medical",
    department: COMMAND_CENTRE,
    team: "Dispatch Team",
    supervisorName: "Raed Alharbi (Supervisor)",
    managerName: "Abdulrahman Alrubayia (Acting Control Command Centre Manager)",
  },
];

export function findCrewOrganizationRole(title: string) {
  const normalized = String(title || "").trim().toLowerCase();
  return CREW_ORGANIZATION_ROLES.find(
    (role) => role.title.toLowerCase() === normalized
  );
}

export const SAUDI_BANKS = [
  "Saudi National Bank (SNB)",
  "Al Rajhi Bank",
  "Riyad Bank",
  "Saudi Awwal Bank (SAB)",
  "Arab National Bank (ANB)",
  "Banque Saudi Fransi",
  "Bank Albilad",
  "Alinma Bank",
  "Bank AlJazira",
  "Gulf International Bank Saudi Arabia (GIB)",
  "The Saudi Investment Bank (SAIB)",
  "Other",
];

export const SAUDI_COVERAGE_CITIES = [
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
];

export const WEEK_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
