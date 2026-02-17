// ===============================
// app/(protected)/transport/types.ts
// ===============================
export type TransportStatus =
  | "new"
  | "ops_available"
  | "rejected"
  | "client_approved"
  | "assigned";

export type CityScope = "inside" | "outside";

// ✅ NEW: Project + Service enums (optional but helpful)
export type ProjectType = "coverage" | "transporting";
export type ServiceType = "ALS" | "BLS";

// ✅ NEW: Team composition enum
export type TeamComposition =
  | "none"
  | "doctor_emt"
  | "paramedic"
  | "emt_paramedic"
  | "driver_paramedic"
  | "nurse_doctor";

// ✅ NEW: Team row for multi-team requests
export type TeamRow = {
  composition: Exclude<TeamComposition, "none">;
  qty: number;
};

export type TransportRequest = {
  id?: string;

  // =========================
  // Form (Sales)
  // =========================

  // ✅ NEW
  projectType?: ProjectType;

  /**
   * ⚠️ NOTE:
   * - You are using `serviceType` now as ALS/BLS dropdown.
   * - Keep it as ServiceType | string for backward compatibility.
   */
  serviceType: ServiceType | string;

  /**
   * ✅ LEGACY:
   * Used by list/details pages. You store START here.
   */
  serviceTime: string; // ISO string: "2026-02-15T15:00"

  // ✅ NEW (start/end range)
  serviceStartTime?: string; // ISO
  serviceEndTime?: string; // ISO

  requirements: string; // متطلبات الخدمة

  // =========================
  // Resources
  // =========================

  /**
   * ✅ NEW:
   * Multiple team rows (composition + qty).
   */
  teams?: TeamRow[];

  /**
   * ✅ LEGACY:
   * Keep these because old screens / logic may still use them.
   */
  teamNeeded: boolean; // هل يطلب فريق؟
  teamCount: number; // العدد (can be sum of teams)
  teamType: ServiceType | string; // legacy field (you set it = ALS/BLS now)
  teamComposition?: TeamComposition; // legacy single composition snapshot

  ambulanceNeeded: boolean; // هل يطلب إسعاف؟
  ambulanceCount: number; // العدد

  // ✅ NEW: roaming like ambulance
  roamingNeeded?: boolean;
  roamingCount?: number;

  daysCount: number; // عدد الأيام
  hoursCount: number; // عدد الساعات

  // =========================
  // Location
  // =========================
  cityScope: CityScope; // داخل/خارج المدينة
  cityName: string; // أي مدينة

  // =========================
  // Workflow
  // =========================
  status: TransportStatus;

  // =========================
  // Ops decision fields
  // =========================
  opsDecisionNote?: string; // سبب الرفض أو ملاحظة التشغيل
  opsDecidedAt?: any;
  opsDecidedBy?: string;

  // =========================
  // Sales rejection fields (NEW)
  // =========================
  salesRejectNote?: string;
  salesRejectedAt?: any;
  salesRejectedBy?: string;

  // =========================
  // Sales client approval
  // =========================
  clientApprovedAt?: any;
  clientApprovedBy?: string;

  // =========================
  // Assignment (Ops)
  // =========================
  assignedAt?: any;
  assignedBy?: string;
  assignedAmbulanceId?: string;
  assignedTeamName?: string; // اسم/كود الفرقة
  assignedCrew?: string[]; // أسماء أو معرفات

  // =========================
  // Meta
  // =========================
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
};
