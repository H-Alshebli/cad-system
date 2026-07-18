import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PermissionsMap, normalizePermissions } from "@/lib/permissionsMatrix";
import { hasPermission } from "@/lib/usePermissions";

export type ChecklistItemStatus =
  | "unchecked"
  | "checked"
  | "some"
  | "missing"
  | "not_available"
  | "not_applicable";

export type ChecklistStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "returned_for_correction";

export type ChecklistResult = "Ready" | "Ready with Warnings" | "Not Ready";
export type ChecklistPhase = "opening" | "closing";
export type ChecklistStepKey =
  | "opening"
  | "closing"
  | "vehicle"
  | "clinic"
  | "walking_team"
  | "vest"
  | "oxygen"
  | "red_bag"
  | "medications";
export type ServiceType = "BLS" | "BLS+" | "ALS" | "ALS+" | "ACLS";
export type DeploymentType =
  | "Clinic"
  | "Ambulance"
  | "Ambulance + Clinic"
  | "Walking Team"
  | "With Ambulance"
  | "Medical Team Standby";
export type InputType = "check" | "quantity" | "fuel" | "psi" | "seal";
export type VehicleSeverity = "red" | "yellow" | "green";

export type ReadinessChecklistItem = {
  id: string;
  step: ChecklistStepKey;
  section: string;
  group: string;
  label: string;
  source?: string;
  critical?: boolean;
  vehicleSeverity?: VehicleSeverity;
  manualVerify?: boolean;
  minQty?: number;
  actualQty?: number;
  unit?: string;
  inputType?: InputType;
  serviceLevels?: ServiceType[];
  deploymentTypes?: DeploymentType[];
  status: ChecklistItemStatus;
  note?: string;
};

export type ReadinessChecklistPayload = {
  projectId: string;
  projectName?: string;
  missionId: string;
  missionLabel?: string;
  unitId: string;
  unitCode?: string;
  inspectorUserId: string;
  inspectorName?: string;
  inspectorEmployeeId?: string;
  shiftKey: string;
  serviceType?: ServiceType | string;
  deploymentType?: DeploymentType | string;
  checklistCategory?: DeploymentType | string;
  checklistPhase?: ChecklistPhase;
  sourceChecklistId?: string;
  dateKey: string;
  notes?: string;
  startedAtMs?: number;
  submittedAtMs?: number;
  durationSeconds?: number;
  manualProjectName?: string;
  manualMissionLabel?: string;
  allowDuplicate?: boolean;
  items: ReadinessChecklistItem[];
};

export const CHECKLIST_COLLECTION = "projectChecklists";
export const FUTURE_EXPIRY_COLLECTION = "projectExpiryItems";
export const READINESS_TEMPLATE_VERSION = 3;

export const WIZARD_STEPS = [
  "Info",
  "Service",
  "Deploy",
  "Opening",
  "Vehicle",
  "Red Bag",
  "Meds",
  "Submit",
];

export const SHIFT_OPTIONS = ["Day", "Night", "Morning", "Evening", "Custom"];
export const SERVICE_TYPES: ServiceType[] = ["BLS", "BLS+", "ALS", "ALS+"];
export const DEPLOYMENT_TYPES: DeploymentType[] = [
  "Clinic",
  "Ambulance",
  "Ambulance + Clinic",
  "Walking Team",
];

function item(
  id: string,
  step: ChecklistStepKey,
  section: string,
  group: string,
  label: string,
  options: Partial<ReadinessChecklistItem> = {}
): ReadinessChecklistItem {
  return {
    id,
    step,
    section,
    group,
    label,
    status: "unchecked",
    inputType: options.minQty ? "quantity" : "check",
    deploymentTypes:
      step === "vehicle" ? ["With Ambulance"] : DEPLOYMENT_TYPES,
    source: options.source || "Official medical readiness checklist",
    ...options,
  };
}

export const OFFICIAL_READINESS_ITEMS: ReadinessChecklistItem[] = [
  item("vehicle_external_body_clean", "vehicle", "Vehicle Readiness", "External Vehicle", "External body clean"),
  item("vehicle_frontal_lights", "vehicle", "Vehicle Readiness", "External Vehicle", "Frontal lights working"),
  item("vehicle_tires_spare", "vehicle", "Vehicle Readiness", "External Vehicle", "Tires air, condition, and spare tire checked", { manualVerify: true }),
  item("vehicle_windshield_wiper", "vehicle", "Vehicle Readiness", "External Vehicle", "Windshield wiper working"),
  item("vehicle_radiator_water", "vehicle", "Vehicle Readiness", "External Vehicle", "Radiator water/coolant level checked", { manualVerify: true }),
  item("vehicle_battery", "vehicle", "Vehicle Readiness", "External Vehicle", "Battery checked"),
  item("vehicle_oil_level", "vehicle", "Vehicle Readiness", "External Vehicle", "Oil level checked", { manualVerify: true }),
  item("vehicle_extinguisher_triangle", "vehicle", "Vehicle Readiness", "Safety", "Extinguisher and safety triangle available"),
  item("vehicle_mirrors", "vehicle", "Vehicle Readiness", "External Vehicle", "Mirrors checked"),
  item("vehicle_brake_light", "vehicle", "Vehicle Readiness", "Safety", "Vehicle brake and light checked", { critical: true, manualVerify: true }),
  item("vehicle_warning_light", "vehicle", "Vehicle Readiness", "Safety", "Warning light working", { critical: true, manualVerify: true }),
  item("vehicle_siren", "vehicle", "Vehicle Readiness", "Safety", "Siren working", { critical: true, manualVerify: true }),
  item("vehicle_driver_ac", "vehicle", "Vehicle Readiness", "Driver Cab", "Driver A/C working"),
  item("vehicle_internal_cab_clean", "vehicle", "Vehicle Readiness", "Driver Cab", "Internal cab clean"),
  item("vehicle_fuel_75", "vehicle", "Vehicle Readiness", "Driver Cab", "Fuel level is more than 3/4 (75%)", { critical: true, manualVerify: true, inputType: "fuel", minQty: 75, unit: "%" }),
  item("vehicle_radio_fixed", "vehicle", "Communication & Technology", "Communication", "Radio device fixed and working", { critical: true, manualVerify: true }),
  item("cabinet_decontaminated", "vehicle", "Cabinet Readiness", "Patient Cabinet", "Patient cabinet decontaminated"),
  item("cabinet_clean_tidy", "vehicle", "Cabinet Readiness", "Patient Cabinet", "Patient cabinet clean and tidy"),
  item("cabinet_sharp_container", "vehicle", "Cabinet Readiness", "Patient Cabinet", "Sharp container more than 1/3 empty", { manualVerify: true }),
  item("cabinet_garbage_empty", "vehicle", "Cabinet Readiness", "Patient Cabinet", "Garbage is empty"),
  item("cabinet_ac_working", "vehicle", "Cabinet Readiness", "Patient Cabinet", "Patient compartment A/C working"),
  item("cabinet_lights_working", "vehicle", "Cabinet Readiness", "Patient Cabinet", "Compartment lights working"),
  item("cabinet_suction_device", "vehicle", "Cabinet Readiness", "Patient Cabinet", "Suction device available and working", { critical: true, manualVerify: true }),
  item("cabinet_stair_chair", "vehicle", "Cabinet Readiness", "Patient Cabinet", "Stair chair available"),
  item("cabinet_aed", "vehicle", "Cabinet Readiness", "Patient Cabinet", "AED available and checked", { critical: true, manualVerify: true }),
  item("cabinet_monitor", "vehicle", "Cabinet Readiness", "Patient Cabinet", "Monitor device available and checked", { critical: true, manualVerify: true }),
  item("storage_folding_stretcher", "vehicle", "Storage & Immobilization", "Under Bench", "Folding stretcher", { minQty: 1 }),
  item("storage_ked_adult", "vehicle", "Storage & Immobilization", "Under Bench", "K.E.D Adult", { minQty: 1 }),
  item("storage_ked_pedia", "vehicle", "Storage & Immobilization", "Under Bench", "K.E.D Pediatric", { minQty: 1 }),
  item("storage_traction_adult", "vehicle", "Storage & Immobilization", "Under Bench", "Traction splint Adult", { minQty: 1 }),
  item("storage_traction_pedia", "vehicle", "Storage & Immobilization", "Under Bench", "Traction splint Pediatric", { minQty: 1 }),
  item("storage_frac_pack", "vehicle", "Storage & Immobilization", "Under Bench", "Frac pack splint set", { minQty: 1 }),
  item("storage_pelvic_device", "vehicle", "Storage & Immobilization", "Under Bench", "Pelvic immobilization device", { minQty: 1 }),
  item("main_o2", "vehicle", "Main Area Supplies", "Oxygen", "Main Oxygen more than 700 PSI", { critical: true, manualVerify: true, inputType: "psi", minQty: 700, unit: "PSI" }),
  item("portable_o2", "vehicle", "Main Area Supplies", "Oxygen", "Portable Oxygen more than 1000 PSI", { critical: true, manualVerify: true, inputType: "psi", minQty: 1000, unit: "PSI" }),
  item("main_gloves", "vehicle", "Main Area Supplies", "PPE", "Gloves S/M/L boxes", { minQty: 3 }),
  item("main_face_mask", "vehicle", "Main Area Supplies", "PPE", "Face mask pack", { minQty: 1 }),
  item("main_vomit_bag", "vehicle", "Main Area Supplies", "Patient Care", "Vomit bags", { minQty: 5 }),
  item("main_medication_cups", "vehicle", "Main Area Supplies", "Patient Care", "Medication cups", { minQty: 5 }),
  item("main_hand_sanitizer", "vehicle", "Main Area Supplies", "Infection Control", "Hand sanitizer", { minQty: 1 }),
  item("main_disinfectant", "vehicle", "Main Area Supplies", "Infection Control", "Disinfectant solution", { minQty: 1 }),
  item("main_alcohol_wipes", "vehicle", "Main Area Supplies", "Infection Control", "Alcohol disinfection wipes", { minQty: 1 }),
  item("main_non_alcohol_wipes", "vehicle", "Main Area Supplies", "Infection Control", "Non-alcohol disinfection wipes", { minQty: 1 }),
  item("main_blue_pen", "vehicle", "Main Area Supplies", "Administration", "Blue pen", { minQty: 1 }),
  item("main_stretcher_straps", "vehicle", "Main Area Supplies", "Patient Movement", "Stretcher with two straps", { critical: true, manualVerify: true, minQty: 1 }),
  item("main_spinal_board", "vehicle", "Main Area Supplies", "Patient Movement", "Adult spinal board with straps", { minQty: 1 }),
  item("main_head_blocks", "vehicle", "Main Area Supplies", "Patient Movement", "Head blocks", { minQty: 1 }),
  item("main_scoop_board", "vehicle", "Main Area Supplies", "Patient Movement", "Scoop board", { minQty: 1 }),
  item("main_medium_bin", "vehicle", "Main Area Supplies", "Patient Care", "Medium bin", { minQty: 1 }),
  item("bls_face_shield", "vehicle", "Medical Supplies", "PPE & General Supplies", "Face shield", { minQty: 2 }),
  item("bls_goggles", "vehicle", "Medical Supplies", "PPE & General Supplies", "Goggles", { minQty: 2 }),
  item("bls_n95", "vehicle", "Medical Supplies", "PPE & General Supplies", "N95 mask", { minQty: 4 }),
  item("bls_yellow_gown", "vehicle", "Medical Supplies", "PPE & General Supplies", "Yellow gown", { minQty: 4 }),
  item("bls_property_bag", "vehicle", "Medical Supplies", "PPE & General Supplies", "Property bag", { minQty: 10 }),
  item("bls_razor", "vehicle", "Medical Supplies", "PPE & General Supplies", "Razor", { minQty: 2 }),
  item("airway_magill", "vehicle", "Medical Supplies", "Airway Basic", "Magill forceps Adult/Pediatric", { minQty: 1 }),
  item("airway_opa_set", "vehicle", "Medical Supplies", "Airway Basic", "OPA 6.0-10.0 mm set", { critical: true, manualVerify: true, minQty: 1 }),
  item("airway_npa_set", "vehicle", "Medical Supplies", "Airway Basic", "NPA 4.0-8.0 mm set", { minQty: 1 }),
  item("airway_lubrication", "vehicle", "Medical Supplies", "Airway Basic", "Lubrication", { minQty: 3 }),
  item("airway_yankauer", "vehicle", "Medical Supplies", "Airway Basic", "Tube Yankauer rigid", { minQty: 3 }),
  item("airway_suction_tip", "vehicle", "Medical Supplies", "Airway Basic", "Suction tip sizes 14/16/20", { minQty: 3 }),
  item("breathing_bvm", "vehicle", "Medical Supplies", "Breathing", "BVM Adult/Pediatric/Infant set", { critical: true, manualVerify: true, minQty: 1 }),
  item("breathing_nc_adult", "vehicle", "Medical Supplies", "Breathing", "Nasal cannula Adult", { minQty: 5 }),
  item("breathing_mask_adult", "vehicle", "Medical Supplies", "Breathing", "Oxygen mask Adult", { minQty: 5 }),
  item("breathing_neb_adult", "vehicle", "Medical Supplies", "Breathing", "Nebulizer mask Adult", { minQty: 5 }),
  item("breathing_nrb_adult", "vehicle", "Medical Supplies", "Breathing", "Non-rebreather NRB Adult", { minQty: 5 }),
  item("breathing_nc_pedia", "vehicle", "Medical Supplies", "Breathing", "Nasal cannula Pediatric", { minQty: 3 }),
  item("breathing_mask_pedia", "vehicle", "Medical Supplies", "Breathing", "Oxygen mask Pediatric", { minQty: 3 }),
  item("breathing_neb_pedia", "vehicle", "Medical Supplies", "Breathing", "Nebulizer mask Pediatric", { minQty: 3 }),
  item("breathing_nrb_pedia", "vehicle", "Medical Supplies", "Breathing", "Non-rebreather NRB Pediatric", { minQty: 3 }),
  item("wound_surgical_tape", "vehicle", "Medical Supplies", "Circulation / Wound Care", "Surgical tape Small/Medium", { minQty: 1 }),
  item("wound_gauze", "vehicle", "Medical Supplies", "Circulation / Wound Care", "Gauze 7x7 and 10x10 non-sterile", { minQty: 2 }),
  item("wound_roll_5", "vehicle", "Medical Supplies", "Circulation / Wound Care", "Roll gauze 5 cm", { minQty: 2 }),
  item("wound_roll_10", "vehicle", "Medical Supplies", "Circulation / Wound Care", "Roll gauze 10 cm", { minQty: 4 }),
  item("wound_bandage_box", "vehicle", "Medical Supplies", "Circulation / Wound Care", "Plastic bandage box", { minQty: 1 }),
  item("wound_surgical_scissor", "vehicle", "Medical Supplies", "Circulation / Wound Care", "Surgical scissor", { minQty: 1 }),
  item("wound_ring_cutters", "vehicle", "Medical Supplies", "Circulation / Wound Care", "Ring cutters", { minQty: 1 }),
  item("wound_iodine_wipes", "vehicle", "Medical Supplies", "Circulation / Wound Care", "Iodine wipes", { minQty: 5 }),
  item("wound_sam_splint", "vehicle", "Medical Supplies", "Circulation / Wound Care", "Sam splint Medium/Large", { minQty: 1 }),
  item("wound_cold_packs", "vehicle", "Medical Supplies", "Circulation / Wound Care", "Cold packs", { minQty: 3 }),
  item("wound_triangular", "vehicle", "Medical Supplies", "Circulation / Wound Care", "Triangular bandages", { minQty: 2 }),
  item("wound_elastic", "vehicle", "Medical Supplies", "Circulation / Wound Care", "Elastic bandage 5 cm and 10 cm", { minQty: 3 }),
  item("wound_adhesive", "vehicle", "Medical Supplies", "Circulation / Wound Care", "Adhesive bandage 7.5 cm and 10 cm", { minQty: 2 }),
  item("wound_soft_collar", "vehicle", "Medical Supplies", "Circulation / Wound Care", "Soft C-collar Adult", { minQty: 1 }),
  item("wound_c_collar", "vehicle", "Medical Supplies", "Circulation / Wound Care", "C-collar Adult/Pediatric", { minQty: 1 }),
  item("wound_emergency_blanket", "vehicle", "Medical Supplies", "Circulation / Wound Care", "Emergency blanket", { minQty: 2 }),
  item("wound_tongue_depressor", "vehicle", "Medical Supplies", "Circulation / Wound Care", "Tongue depressor sticks", { minQty: 5 }),
  item("wound_eye_pads", "vehicle", "Medical Supplies", "Circulation / Wound Care", "Eye pads", { minQty: 4 }),
  item("wound_occlusive", "vehicle", "Medical Supplies", "Circulation / Wound Care", "Occlusive dressing", { minQty: 1 }),
  item("wound_multi_trauma", "vehicle", "Medical Supplies", "Circulation / Wound Care", "Multi trauma dressings", { minQty: 4 }),
  item("wound_tourniquet", "vehicle", "Medical Supplies", "Circulation / Wound Care", "Arterial tourniquet", { critical: true, manualVerify: true, minQty: 1 }),
  item("care_female_urine_bag", "vehicle", "Medical Supplies", "General & Patient Care", "Urine drainage bag Female", { minQty: 1 }),
  item("care_male_urine_bag", "vehicle", "Medical Supplies", "General & Patient Care", "Urine drainage bag Male", { minQty: 1 }),
  item("care_broselow", "vehicle", "Medical Supplies", "General & Patient Care", "Broselow tape", { minQty: 1 }),
  item("care_portable_sharp_box", "vehicle", "Medical Supplies", "General & Patient Care", "Portable sharp box", { minQty: 1 }),
  item("care_triage_tags", "vehicle", "Medical Supplies", "General & Patient Care", "Disaster triage tags", { minQty: 20 }),
  item("care_humidifier", "vehicle", "Medical Supplies", "General & Patient Care", "Humidifier bottle", { minQty: 1 }),
  item("care_o2_regulator", "vehicle", "Medical Supplies", "General & Patient Care", "Oxygen cylinder regulator", { critical: true, manualVerify: true, minQty: 1 }),
  item("care_cord_clamp", "vehicle", "Medical Supplies", "General & Patient Care", "Cord clamp", { minQty: 2 }),
  item("care_ob_kit", "vehicle", "Medical Supplies", "General & Patient Care", "OB kit", { minQty: 1 }),
  item("care_biohazard_bag", "vehicle", "Medical Supplies", "General & Patient Care", "Biohazard small bag", { minQty: 1 }),
  item("care_blanket", "vehicle", "Medical Supplies", "General & Patient Care", "Blanket", { minQty: 1 }),
  item("care_pillow", "vehicle", "Medical Supplies", "General & Patient Care", "Pillow", { minQty: 1 }),
  item("care_underpads", "vehicle", "Medical Supplies", "General & Patient Care", "Disposable underpads", { minQty: 1 }),
  item("als_ringer_lactate", "vehicle", "ALS Clinical Readiness", "IV Fluids & Cannulation", "Ringer Lactate", { minQty: 2, serviceLevels: ["ACLS"] }),
  item("als_normal_saline", "vehicle", "ALS Clinical Readiness", "IV Fluids & Cannulation", "Normal Saline", { minQty: 2, serviceLevels: ["ACLS"] }),
  item("als_dextrose_5", "vehicle", "ALS Clinical Readiness", "IV Fluids & Cannulation", "Dextrose 5%", { minQty: 2, serviceLevels: ["ACLS"] }),
  item("als_cannula_14_18", "vehicle", "ALS Clinical Readiness", "IV Fluids & Cannulation", "IV cannula 14/16/18", { minQty: 5, serviceLevels: ["ACLS"] }),
  item("als_cannula_20_24", "vehicle", "ALS Clinical Readiness", "IV Fluids & Cannulation", "IV cannula 20/22/24", { minQty: 5, serviceLevels: ["ACLS"] }),
  item("als_iv_set", "vehicle", "ALS Clinical Readiness", "IV Fluids & Cannulation", "IV set", { minQty: 5, serviceLevels: ["ACLS"] }),
  item("als_stopcock", "vehicle", "ALS Clinical Readiness", "IV Fluids & Cannulation", "3-way stopcock", { minQty: 5, serviceLevels: ["ACLS"] }),
  item("als_tourniquet", "vehicle", "ALS Clinical Readiness", "IV Fluids & Cannulation", "Tourniquet", { minQty: 1, serviceLevels: ["ACLS"] }),
  item("als_iv_dressings", "vehicle", "ALS Clinical Readiness", "IV Fluids & Cannulation", "IV dressings", { minQty: 5, serviceLevels: ["ACLS"] }),
  item("als_flush_syringes", "vehicle", "ALS Clinical Readiness", "IV Fluids & Cannulation", "Filter needle / IV flush syringes 10 cc", { minQty: 5, serviceLevels: ["ACLS"] }),
  item("als_syringes_small", "vehicle", "ALS Clinical Readiness", "IV Fluids & Cannulation", "Syringes 1/3/5/10 cc", { minQty: 5, serviceLevels: ["ACLS"] }),
  item("als_syringes_20", "vehicle", "ALS Clinical Readiness", "IV Fluids & Cannulation", "Syringes 20 cc", { minQty: 5, serviceLevels: ["ACLS"] }),
  item("als_syringes_50", "vehicle", "ALS Clinical Readiness", "IV Fluids & Cannulation", "Syringes 50 cc", { minQty: 2, serviceLevels: ["ACLS"] }),
  item("als_pressure_infuser", "vehicle", "ALS Clinical Readiness", "IV Fluids & Cannulation", "Reusable pressure infuser", { minQty: 1, serviceLevels: ["ACLS"] }),
  item("als_ett_set", "vehicle", "ALS Clinical Readiness", "Advanced Airway / Intubation", "ETT 2.5-8.5 set", { critical: true, manualVerify: true, minQty: 1, serviceLevels: ["ACLS"] }),
  item("als_lma_set", "vehicle", "ALS Clinical Readiness", "Advanced Airway / Intubation", "LMA 2/3/4/5 set", { minQty: 1, serviceLevels: ["ACLS"] }),
  item("als_ett_stylet", "vehicle", "ALS Clinical Readiness", "Advanced Airway / Intubation", "ETT stylet", { minQty: 1, serviceLevels: ["ACLS"] }),
  item("als_bougie", "vehicle", "ALS Clinical Readiness", "Advanced Airway / Intubation", "Bougie 10FR", { minQty: 1, serviceLevels: ["ACLS"] }),
  item("als_io_kit", "vehicle", "ALS Clinical Readiness", "Vascular Access Advanced", "Intraosseous kit", { critical: true, manualVerify: true, minQty: 1, serviceLevels: ["ACLS"] }),
  item("rb_bag_available", "red_bag", "Red Bag", "Bag Control", "Red bag is available", { critical: true, manualVerify: true }),
  item("rb_bag_sealed", "red_bag", "Red Bag", "Bag Control", "Red bag is sealed / seal number verified", { manualVerify: true, inputType: "seal" }),
  item("rb_upper_gloves", "red_bag", "Red Bag", "Upper Compartment", "Gloves Medium", { minQty: 1 }),
  item("rb_upper_face_mask", "red_bag", "Red Bag", "Upper Compartment", "Face mask", { minQty: 1 }),
  item("rb_upper_manual_bp", "red_bag", "Red Bag", "Upper Compartment", "Manual blood pressure cuff", { critical: true, manualVerify: true, minQty: 1 }),
  item("rb_upper_opa", "red_bag", "Red Bag", "Upper Compartment", "OPA 6.0-10.0 mm, one for each size", { critical: true, manualVerify: true, minQty: 1 }),
  item("rb_upper_npa", "red_bag", "Red Bag", "Upper Compartment", "NPA 4.0-8.0 mm, one for each size", { minQty: 1 }),
  item("rb_upper_thermometer", "red_bag", "Red Bag", "Upper Compartment", "Thermometer", { minQty: 1 }),
  item("rb_upper_plastic_bandage", "red_bag", "Red Bag", "Upper Compartment", "Plastic bandage", { minQty: 1 }),
  item("rb_upper_syringe_5", "red_bag", "Red Bag", "Upper Compartment", "5 cc syringe", { minQty: 3 }),
  item("rb_upper_syringe_10", "red_bag", "Red Bag", "Upper Compartment", "10 cc syringe", { minQty: 3 }),
  item("rb_front_filter_needle", "red_bag", "Red Bag", "Frontal Compartment", "Filter needle", { minQty: 3 }),
  item("rb_front_alcohol_swab", "red_bag", "Red Bag", "Frontal Compartment", "Alcohol swab 100 pcs box", { minQty: 1 }),
  item("rb_front_syringe_20", "red_bag", "Red Bag", "Frontal Compartment", "20 cc syringe", { minQty: 3 }),
  item("rb_main_bvm", "red_bag", "Red Bag", "Main Compartment", "Bag valve mask BVM Adult", { critical: true, manualVerify: true, minQty: 1 }),
  item("rb_main_stethoscope", "red_bag", "Red Bag", "Main Compartment", "Stethoscope", { minQty: 1 }),
  item("rb_main_magill", "red_bag", "Red Bag", "Main Compartment", "Magill forceps", { minQty: 1 }),
  item("rb_main_penlight", "red_bag", "Red Bag", "Main Compartment", "Penlight", { minQty: 1 }),
  item("rb_main_scissors", "red_bag", "Red Bag", "Main Compartment", "Scissors", { minQty: 1 }),
  item("rb_main_medium_tape", "red_bag", "Red Bag", "Main Compartment", "Medium tape", { minQty: 1 }),
  item("rb_main_vomiting_bag", "red_bag", "Red Bag", "Main Compartment", "Vomiting bag", { minQty: 3 }),
  item("rb_main_sharp_box", "red_bag", "Red Bag", "Main Compartment", "Portable sharp box", { minQty: 1 }),
  item("rb_main_sodium_chloride", "red_bag", "Red Bag", "Main Compartment", "Sodium Chloride 0.9% 500 ml", { minQty: 1 }),
  item("rb_main_ringer_lactate", "red_bag", "Red Bag", "Main Compartment", "Ringer Lactate 500 ml", { minQty: 1 }),
  item("rb_main_dextrose_5", "red_bag", "Red Bag", "Main Compartment", "Dextrose 5% 500 ml", { minQty: 1, serviceLevels: ["ACLS"] }),
  item("rb_main_glucometer", "red_bag", "Red Bag", "Main Compartment", "Glucometer", { critical: true, manualVerify: true, minQty: 1 }),
  item("rb_main_strips", "red_bag", "Red Bag", "Main Compartment", "Glucometer strips", { minQty: 1 }),
  item("rb_main_lancets", "red_bag", "Red Bag", "Main Compartment", "Lancets", { minQty: 1 }),
  item("rb_main_pulse_ox", "red_bag", "Red Bag", "Main Compartment", "Portable pulse oximeter", { critical: true, manualVerify: true, minQty: 1 }),
  item("rb_main_ice_spray", "red_bag", "Red Bag", "Main Compartment", "Ice spray", { minQty: 1 }),
  item("rb_main_gauze_75", "red_bag", "Red Bag", "Main Compartment", "Non-sterile gauze 7.5x7.5 cm", { minQty: 1 }),
  item("rb_main_gauze_2", "red_bag", "Red Bag", "Main Compartment", "Non-sterile gauze 2x2 cm", { minQty: 1 }),
  item("rb_main_elastic_5", "red_bag", "Red Bag", "Main Compartment", "Elastic bandage 5 cm", { minQty: 2 }),
  item("rb_main_elastic_10", "red_bag", "Red Bag", "Main Compartment", "Elastic bandage 10 cm", { minQty: 2 }),
  item("rb_main_adhesive_75", "red_bag", "Red Bag", "Main Compartment", "Adhesive bandage 7.5 cm", { minQty: 2 }),
  item("rb_main_adhesive_10", "red_bag", "Red Bag", "Main Compartment", "Adhesive bandage 10 cm", { minQty: 2 }),
  item("rb_main_iv_set", "red_bag", "Red Bag", "Main Compartment", "IV set", { minQty: 3, serviceLevels: ["ACLS"] }),
  item("rb_main_tourniquet", "red_bag", "Red Bag", "Main Compartment", "Tourniquet", { minQty: 1, serviceLevels: ["ACLS"] }),
  item("rb_main_iv_dressing", "red_bag", "Red Bag", "Main Compartment", "IV dressing", { minQty: 3, serviceLevels: ["ACLS"] }),
  item("rb_main_stopcock", "red_bag", "Red Bag", "Main Compartment", "3-way stopcock", { minQty: 3, serviceLevels: ["ACLS"] }),
  item("rb_main_cannula_14", "red_bag", "Red Bag", "Main Compartment", "IV cannula G14", { minQty: 2, serviceLevels: ["ACLS"] }),
  item("rb_main_cannula_16", "red_bag", "Red Bag", "Main Compartment", "IV cannula G16", { minQty: 2, serviceLevels: ["ACLS"] }),
  item("rb_main_cannula_18", "red_bag", "Red Bag", "Main Compartment", "IV cannula G18", { minQty: 3, serviceLevels: ["ACLS"] }),
  item("rb_main_cannula_20", "red_bag", "Red Bag", "Main Compartment", "IV cannula G20", { minQty: 3, serviceLevels: ["ACLS"] }),
  item("rb_main_cannula_22", "red_bag", "Red Bag", "Main Compartment", "IV cannula G22", { minQty: 3, serviceLevels: ["ACLS"] }),
  item("rb_main_cannula_24", "red_bag", "Red Bag", "Main Compartment", "IV cannula G24", { minQty: 3, serviceLevels: ["ACLS"] }),
  item("rb_main_syringe_3", "red_bag", "Red Bag", "Main Compartment", "3 cc syringe", { minQty: 3 }),
  item("rb_right_paraffin", "red_bag", "Red Bag", "Right Compartment", "Paraffin cotton gauze", { minQty: 4 }),
  item("rb_right_triangular", "red_bag", "Red Bag", "Right Compartment", "Triangular bandage", { minQty: 2 }),
  item("rb_right_roll_5", "red_bag", "Red Bag", "Right Compartment", "Roll gauze 5x4 cm", { minQty: 2 }),
  item("rb_right_roll_7", "red_bag", "Red Bag", "Right Compartment", "Roll gauze 7x4 cm", { minQty: 2 }),
  item("rb_right_roll_10", "red_bag", "Red Bag", "Right Compartment", "Roll gauze 10x4 cm", { minQty: 2 }),
  item("rb_left_icepack", "red_bag", "Red Bag", "Left Compartment", "Icepack", { minQty: 2 }),
  item("rb_left_tongue_depressor", "red_bag", "Red Bag", "Left Compartment", "Tongue depressor", { minQty: 5 }),
  item("rb_left_iodine", "red_bag", "Red Bag", "Left Compartment", "Iodine swab", { minQty: 5 }),
  item("rb_left_blanket", "red_bag", "Red Bag", "Left Compartment", "Emergency blanket", { minQty: 1 }),
  item("med_adenosine", "medications", "Medication Bag", "ACLS Medications", "Adenosine 3 mg/ml ampoule", { minQty: 3, serviceLevels: ["ACLS"] }),
  item("med_amiodarone", "medications", "Medication Bag", "ACLS Medications", "Amiodarone ampoule", { minQty: 3, serviceLevels: ["ACLS"] }),
  item("med_acetab", "medications", "Medication Bag", "General Medications", "Acetab 25 mg tablet", { minQty: 1 }),
  item("med_atropine", "medications", "Medication Bag", "ACLS Medications", "Atropine Sulphate ampoule", { critical: true, manualVerify: true, minQty: 5, serviceLevels: ["ACLS"] }),
  item("med_aspirin", "medications", "Medication Bag", "General Medications", "Aspirin Protect 100 mg tablet", { critical: true, minQty: 1 }),
  item("med_atrovent", "medications", "Medication Bag", "Respiratory", "Atrovent 250 mcg 2 ml", { minQty: 2 }),
  item("med_buscopan_tab", "medications", "Medication Bag", "General Medications", "Buscopan 10 mg tablet", { minQty: 1 }),
  item("med_buscopan_amp", "medications", "Medication Bag", "General Medications", "Buscopan 20 mg/ml ampoule", { minQty: 3 }),
  item("med_chlorpheniramine", "medications", "Medication Bag", "General Medications", "Chlorpheniramine Maleate 10 mg ampoule", { minQty: 3 }),
  item("med_diclofenac", "medications", "Medication Bag", "General Medications", "Diclofenac Sodium 75 mg ampoule", { minQty: 3 }),
  item("med_dexamethasone", "medications", "Medication Bag", "General Medications", "Dexamethasone 4 mg/ml ampoule", { minQty: 2 }),
  item("med_dextrose_50", "medications", "Medication Bag", "Critical Medications", "Dextrose 50%", { critical: true, manualVerify: true, minQty: 3 }),
  item("med_epinephrine", "medications", "Medication Bag", "Critical Medications", "Epinephrine 1:1000", { critical: true, manualVerify: true, minQty: 3 }),
  item("med_furosemide", "medications", "Medication Bag", "ACLS Medications", "Furosemide 40 mg ampoule", { minQty: 3, serviceLevels: ["ACLS"] }),
  item("med_glucagon", "medications", "Medication Bag", "Critical Medications", "Glucagon emergency kit", { critical: true, manualVerify: true, minQty: 1 }),
  item("med_hydrocortisone", "medications", "Medication Bag", "General Medications", "Hydrocortisone 100 mg vial", { minQty: 3 }),
  item("med_ibuprofen", "medications", "Medication Bag", "General Medications", "Ibuprofen 400 mg tablet", { minQty: 3 }),
  item("med_magnesium", "medications", "Medication Bag", "ACLS Medications", "Magnesium Sulphate 500 mg/ml", { minQty: 1, serviceLevels: ["ACLS"] }),
  item("med_mebo", "medications", "Medication Bag", "General Medications", "Mebo cream", { minQty: 2 }),
  item("med_metoclopramide", "medications", "Medication Bag", "General Medications", "Metoclopramide 5 mg/ml ampoule", { minQty: 2 }),
  item("med_naloxone", "medications", "Medication Bag", "Critical Medications", "Naloxone Hydrochloride 0.4 mg/ml", { critical: true, manualVerify: true, minQty: 2 }),
  item("med_isosorbide", "medications", "Medication Bag", "ACLS Medications", "Isosorbide Dinitrate 5 mg tablet", { minQty: 1, serviceLevels: ["ACLS"] }),
  item("med_ondansetron", "medications", "Medication Bag", "General Medications", "Ondansetron 4 mg ampoule", { minQty: 1 }),
  item("med_paracetamol_tab", "medications", "Medication Bag", "General Medications", "Paracetamol 500 mg tablet", { minQty: 4 }),
  item("med_paracetamol_iv", "medications", "Medication Bag", "General Medications", "Paracetamol 1 g IV", { minQty: 4 }),
  item("med_pantomax", "medications", "Medication Bag", "General Medications", "Pantomax 40 mg tablet", { minQty: 1 }),
  item("med_risek", "medications", "Medication Bag", "General Medications", "Risek 40 mg vial", { minQty: 3 }),
  item("med_salbutamol", "medications", "Medication Bag", "Respiratory", "Salbutamol inhalation solution", { critical: true, manualVerify: true, minQty: 3 }),
  item("med_sodium_bicarbonate", "medications", "Medication Bag", "ACLS Medications", "Sodium Bicarbonate 8.4% 50 ml", { minQty: 1, serviceLevels: ["ACLS"] }),
  item("med_telfast", "medications", "Medication Bag", "General Medications", "Telfast 180 mg tablet", { minQty: 3 }),
  item("med_xefo", "medications", "Medication Bag", "General Medications", "Xefo 8 mg vial", { minQty: 4 }),
  item("med_saline_10", "medications", "Medication Bag", "Medication Supplies", "Saline 10 ml", { minQty: 3 }),
  item("med_saline_5", "medications", "Medication Bag", "Medication Supplies", "Saline 5 ml", { minQty: 3 }),
];

const SERVICE_LEVELS_BY_MINIMUM: Record<ServiceType, ServiceType[]> = {
  BLS: ["BLS", "BLS+", "ALS", "ALS+"],
  "BLS+": ["BLS+", "ALS", "ALS+"],
  ALS: ["ALS", "ALS+"],
  "ALS+": ["ALS+"],
  ACLS: ["ALS", "ALS+"],
};

const SERVICE_COPY: Record<ServiceType, string> = {
  BLS: "Basic life support readiness.",
  "BLS+": "BLS readiness with IV fluids and cannulation.",
  ALS: "BLS+ readiness with advanced airway, defibrillator, and emergency kit checks.",
  "ALS+": "ALS readiness with narcotics / controlled substances checks.",
  ACLS: "BLS+ readiness with advanced airway, defibrillator, and emergency kit checks.",
};

export function getServiceDescription(serviceType: ServiceType | string) {
  return SERVICE_COPY[normalizeServiceType(serviceType)];
}

export function normalizeServiceType(value: ServiceType | string = "BLS"): ServiceType {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "ACLS") return "ALS";
  if (normalized === "BLS+" || normalized === "ALS+" || normalized === "ALS") {
    return normalized as ServiceType;
  }
  return "BLS";
}

export function normalizeDeploymentType(
  value: DeploymentType | string = "Ambulance"
): Extract<DeploymentType, "Clinic" | "Ambulance" | "Ambulance + Clinic" | "Walking Team"> {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized.includes("ambulance + clinic") ||
    normalized.includes("ambulance+clinic") ||
    normalized.includes("ambulanc + clinical") ||
    normalized.includes("ambulance + clinical") ||
    (normalized.includes("ambulance") && normalized.includes("clinic"))
  ) {
    return "Ambulance + Clinic";
  }
  if (normalized.includes("clinic")) return "Clinic";
  if (normalized.includes("walking") || normalized.includes("standby")) return "Walking Team";
  return "Ambulance";
}

function servicesFrom(minimum: ServiceType): ServiceType[] {
  return SERVICE_LEVELS_BY_MINIMUM[minimum];
}

function qtyValue(value?: string | number) {
  if (typeof value === "number") return value;
  const first = String(value || "").match(/\d+/)?.[0];
  return first ? Number(first) : undefined;
}

function normalizeChecklistText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.%+/-]+/g, " ").replace(/\s+/g, " ").trim();
}

function isVedCriticalLabel(label: string) {
  const value = normalizeChecklistText(label);
  return (
    value.includes("adenosine") ||
    value.includes("amiodarone") ||
    value.includes("dextrose 50") ||
    value.includes("epinephrine") ||
    value.includes("opa") ||
    value.includes("oropharyngeal") ||
    value.includes("npa") ||
    value.includes("nasopharyngeal") ||
    value.includes("yankauer") ||
    value.includes("suction tip") ||
    value.includes("suction catheter") ||
    value.includes("rigid suction") ||
    value.includes("flexible suction") ||
    value.includes("nasogastric") ||
    value.includes("ett") ||
    /\bet\b/.test(value) ||
    value.includes("endotracheal") ||
    value.includes("macintosh") ||
    value.includes("laryngoscope") ||
    value.includes("lma") ||
    value.includes("laryngeal mask") ||
    value.includes("co2 detector") ||
    value.includes("bvm") ||
    value.includes("bag valve mask") ||
    value.includes("nebulizer mask") ||
    value.includes("non-rebreather") ||
    value.includes("nrb") ||
    value.includes("sodium chloride") ||
    value.includes("normal saline") ||
    value.includes("ringer") ||
    value.includes("dextrose 5") ||
    value.includes("arterial tourniquet") ||
    value.includes("emergency blanket") ||
    value.includes("occlusive") ||
    value.includes("hydrogel") ||
    value.includes("iv cannula") ||
    value.includes("iv infusion") ||
    value.includes("iv set") ||
    value.includes("syringe") ||
    value.includes("3-way") ||
    value.includes("3 ways") ||
    value.includes("stopcock") ||
    value.includes("iv dressing") ||
    value.includes("kidney tray") ||
    value.includes("nitrile gloves") ||
    value.includes("gloves s/m/l") ||
    value.includes("surgical face mask") ||
    value.includes("face mask pack") ||
    value.includes("ob kit") ||
    value.includes("disaster triage") ||
    value.includes("biohazard") ||
    value.includes("cord clamp") ||
    value.includes("oxygen regulator") ||
    value.includes("intraosseous") ||
    value.includes("io kit") ||
    value.includes("pelvic immobilization") ||
    value.includes("defibrillator pads") ||
    value.includes("pads adult") ||
    value.includes("sam chest seal") ||
    value.includes("dry burn") ||
    value.includes("adhesive plaster")
  );
}

function vehicleSeverityForItem(step: ChecklistStepKey, section: string, label: string): VehicleSeverity | undefined {
  if (step !== "vehicle") return undefined;

  const value = normalizeChecklistText(`${section} ${label}`);
  if (
    value.includes("tire") ||
    value.includes("vehicle brake") ||
    value.includes("brake and light") ||
    value.includes("fuel level") ||
    value.includes("radiator") ||
    value.includes("battery") ||
    value.includes("oil level") ||
    value.includes("stretcher with two straps")
  ) {
    return "red";
  }

  if (
    value.includes("frontal light") ||
    value.includes("windshield") ||
    value.includes("mirror") ||
    value.includes("warning light") ||
    value.includes("siren") ||
    value.includes("driver a/c") ||
    value.includes("compartment a/c") ||
    value.includes("compartment lights") ||
    value.includes("radio") ||
    value.includes("suction device") ||
    value.includes("stair chair") ||
    value.includes("aed") ||
    value.includes("monitor") ||
    value.includes("main oxygen") ||
    value.includes("portable oxygen")
  ) {
    return "yellow";
  }

  if (
    value.includes("external body") ||
    value.includes("internal cab") ||
    value.includes("clean") ||
    value.includes("decontaminated") ||
    value.includes("sharp container") ||
    value.includes("garbage") ||
    value.includes("extinguisher") ||
    value.includes("safety triangle")
  ) {
    return "green";
  }

  return undefined;
}

export function classifyReadinessItem(item: ReadinessChecklistItem): ReadinessChecklistItem {
  const critical = isVedCriticalLabel(item.label);
  const vehicleSeverity = item.vehicleSeverity || vehicleSeverityForItem(item.step, item.section, item.label);
  return {
    ...item,
    critical,
    vehicleSeverity,
    manualVerify: Boolean(item.manualVerify || critical || vehicleSeverity === "red"),
  };
}

function standardItem(
  id: string,
  step: ChecklistStepKey,
  section: string,
  group: string,
  label: string,
  options: Partial<ReadinessChecklistItem> & {
    minService?: ServiceType;
    deployments?: Array<Extract<DeploymentType, "Clinic" | "Ambulance" | "Ambulance + Clinic" | "Walking Team">>;
    qty?: string | number;
  } = {}
): ReadinessChecklistItem {
  const minQty = options.minQty ?? qtyValue(options.qty);
  return classifyReadinessItem({
    id,
    step,
    section,
    group,
    label,
    source: options.source || "Official Lazem readiness checklist",
    status: "unchecked",
    inputType: options.inputType || (minQty ? "quantity" : "check"),
    minQty,
    unit: options.unit,
    actualQty: options.actualQty,
    vehicleSeverity: options.vehicleSeverity,
    manualVerify: options.manualVerify,
    serviceLevels: options.minService ? servicesFrom(options.minService) : options.serviceLevels,
    deploymentTypes: options.deployments || options.deploymentTypes,
  });
}

function itemsFromLabels(
  prefix: string,
  step: ChecklistStepKey,
  section: string,
  group: string,
  labels: string[],
  options: Partial<ReadinessChecklistItem> & {
    minService?: ServiceType;
    deployments?: Array<Extract<DeploymentType, "Clinic" | "Ambulance" | "Ambulance + Clinic" | "Walking Team">>;
  } = {}
) {
  return labels.map((label, index) =>
    standardItem(`${prefix}_${index + 1}`, step, section, group, label, options)
  );
}

function qtyItems(
  prefix: string,
  step: ChecklistStepKey,
  section: string,
  group: string,
  rows: Array<[
    string,
    string | number,
    (Partial<ReadinessChecklistItem> & { minService?: ServiceType })?
  ]>,
  options: Partial<ReadinessChecklistItem> & {
    minService?: ServiceType;
    deployments?: Array<Extract<DeploymentType, "Clinic" | "Ambulance" | "Ambulance + Clinic" | "Walking Team">>;
  } = {}
) {
  return rows.map(([label, qty, rowOptions], index) =>
    standardItem(`${prefix}_${index + 1}`, step, section, group, label, {
      ...options,
      ...(rowOptions || {}),
      qty,
    })
  );
}

const AMBULANCE_OPENING_ITEMS: ReadinessChecklistItem[] = itemsFromLabels(
  "amb_open",
  "opening",
  "Opening Checklist",
  "Ambulance Opening",
  [
    "Attendance",
    "Ambulance key / ambulance code number",
    "Ambulance checklist",
    "Medication bag and bag code number",
    "Ambulance red bag and bag code number",
    "Radio device and device code number",
  ],
  { deployments: ["Ambulance", "Ambulance + Clinic"], source: "LZM-QC-CL-AMB-OPEN" }
);

const CLINIC_OPENING_ITEMS: ReadinessChecklistItem[] = itemsFromLabels(
  "cln_open",
  "opening",
  "Opening Shift Checklist",
  "Clinic Opening",
  [
    "Clinic key",
    "Ambulance key",
    "Radio device",
    "Radio charged",
    "Clinic sterilization",
    "Radio attendance",
    "Ambulance checklist (inside-outside)",
    "Medication checklist",
    "Clinic checklist",
  ],
  { deployments: ["Clinic", "Ambulance + Clinic"], source: "LZM-QC-CL-CLN-OPN" }
);

const AMBULANCE_VEHICLE_ITEMS: ReadinessChecklistItem[] = [
  ...itemsFromLabels(
    "amb_vehicle",
    "vehicle",
    "Vehicle Readiness",
    "Vehicle",
    [
      "External body clean",
      "Frontal lights",
      "Tires air, condition, and spare tire checked",
      "Windshield wiper",
      "Radiator water",
      "Battery",
      "Oil level",
      "Extinguisher and safety triangle",
      "Mirrors",
      "Vehicle brake and light",
      "Warning light",
      "Siren",
      "Driver A/C working",
      "Internal cab clean",
    ],
    { deployments: ["Ambulance", "Ambulance + Clinic"], source: "LZM-QC-CL-AMB-BLS/BLS+/ALS/ALS+" }
  ),
  standardItem("amb_vehicle_fuel", "vehicle", "Vehicle Readiness", "Vehicle", "Fuel level is more than 3/4 (75%)", {
    deployments: ["Ambulance", "Ambulance + Clinic"],
    source: "LZM-QC-CL-AMB-BLS/BLS+/ALS/ALS+",
    inputType: "fuel",
    minQty: 75,
    unit: "%",
    critical: true,
    manualVerify: true,
  }),
  ...itemsFromLabels(
    "amb_cabinet",
    "vehicle",
    "Cabinet Readiness",
    "Patient Cabinet",
    [
      "Radio device fixed and working",
      "Patient cabinet decontaminated",
      "Patient cabinet clean and tidy",
      "Sharp container more than 1/3 empty",
      "Garbage is empty",
      "Patient compartment A/C working",
      "Compartment lights working",
      "Suction device",
      "Stair chair",
      "AED",
      "Monitor device",
    ],
    { deployments: ["Ambulance", "Ambulance + Clinic"], source: "LZM-QC-CL-AMB-BLS/BLS+/ALS/ALS+" }
  ),
  ...qtyItems(
    "amb_storage",
    "vehicle",
    "Storage & Immobilization Equipment",
    "Under Bench",
    [
      ["Folding stretcher", 1],
      ["K.E.D adult", 1],
      ["K.E.D pediatric", 1],
      ["Traction splint adult", 1],
      ["Traction splint pediatric", 1],
      ["Frac pack splint set", 1],
      ["Pelvic immobilization device", 1],
    ],
    { deployments: ["Ambulance", "Ambulance + Clinic"], source: "LZM-QC-CL-AMB-BLS/BLS+/ALS/ALS+" }
  ),
  ...qtyItems(
    "amb_main",
    "vehicle",
    "Main Area Supplies",
    "Supplies",
    [
      ["Main oxygen more than 700 PSI", 2, { inputType: "psi", unit: "PSI", critical: true, manualVerify: true }],
      ["Portable oxygen more than 1000 PSI", 1, { inputType: "psi", unit: "PSI", critical: true, manualVerify: true }],
      ["Gloves S/M/L boxes", 3],
      ["Face mask pack", 1],
      ["Vomit bags", 5],
      ["Medication cups", 5],
      ["Hand sanitizer", 1],
      ["Disinfectant solution", 1],
      ["Alcohol disinfection wipes", 1],
      ["Non-alcohol disinfection wipes", 1],
      ["Blue pen", 1],
      ["Stretcher with two straps", 1, { critical: true, manualVerify: true }],
      ["Spinal board adult with straps", 1],
      ["Head-blocks", 1],
      ["Scoop board", 1],
      ["Medium bin", 1],
    ],
    { deployments: ["Ambulance", "Ambulance + Clinic"], source: "LZM-QC-CL-AMB-BLS/BLS+/ALS/ALS+" }
  ),
];

const AMBULANCE_MEDICAL_SUPPLY_ITEMS: ReadinessChecklistItem[] = [
  ...qtyItems(
    "amb_basic_supply",
    "vehicle",
    "Medical Supplies",
    "BLS Supplies",
    [
      ["Face shield", 2],
      ["Goggles", 2],
      ["N95 mask", 4],
      ["Yellow gown", 4],
      ["Property bag", 10],
      ["Razor", 2],
      ["Magill forceps adult-pediatric", 1],
      ["OPA 6.0-10.0 mm set", 1, { critical: true, manualVerify: true }],
      ["NPA 4.0-8.0 mm set", 1],
      ["Lubrication", 3],
      ["Tube Yankauer rigid", 3],
      ["Suction tip sizes 14/16/20", 3],
      ["BVM adult-pediatric-infant set", 1, { critical: true, manualVerify: true }],
      ["Nasal cannula adult", 5],
      ["Oxygen mask adult", 5],
      ["Nebulizer mask adult", 5],
      ["Non-rebreather NRB adult", 5],
      ["Nasal cannula pediatric", 3],
      ["Oxygen mask pediatric", 3],
      ["Nebulizer mask pediatric", 3],
      ["Non-rebreather NRB pediatric", 3],
      ["Surgical tape small-medium", 1],
      ["Gauze 7x7 and 10x10 non-sterile", 2],
      ["Roll gauze 5 cm", 2],
      ["Roll gauze 10 cm", 4],
      ["Plastic bandage box", 1],
      ["Surgical scissor", 1],
      ["Ring cutters", 1],
      ["Iodine wipes", 5],
      ["Sam splint medium-large", 1],
      ["Cold packs", 3],
      ["Triangular bandages", 2],
      ["Elastic bandage 5 cm and 10 cm", 3],
      ["Adhesive bandage 7.5 cm and 10 cm", 2],
      ["Soft C-collar adult", 1],
      ["C-collar adult-pediatric", 1],
      ["Emergency blanket", 2],
      ["Tongue depressor sticks", 5],
      ["Eye pads", 4],
      ["Occlusive dressing", 1],
      ["Multi trauma dressings", 4],
      ["Arterial tourniquet", 1, { critical: true, manualVerify: true }],
      ["Urine drainage bag female", 1],
      ["Urine drainage bag male", 1],
      ["Broselow tape", 1],
      ["Portable sharp box", 1],
      ["Disaster triage tags", 20],
      ["Humidifier bottle", 1],
      ["Oxygen cylinder regulator", 1, { critical: true, manualVerify: true }],
      ["Cord clamp", 2],
      ["OB kit", 1],
      ["Biohazard small bag", 1],
      ["Blanket", 1],
      ["Pillow", 1],
      ["Disposable underpads", 1],
    ],
    { deployments: ["Ambulance", "Ambulance + Clinic"], source: "LZM-QC-CL-AMB-BLS" }
  ),
  ...qtyItems(
    "amb_iv",
    "vehicle",
    "Medical Supplies",
    "IV Fluids & Cannulation",
    [
      ["Ringer lactate", 2],
      ["Normal saline", 2],
      ["Dextrose 5%", 2],
      ["IV cannula 14/16/18", 5],
      ["IV cannula 20/22/24", 5],
      ["Kidney tray", 3],
      ["IV set", 5],
      ["3-way stop-cock", 5],
      ["Alcohol swab pack", 1],
      ["Tourniquet", 1],
      ["IV dressings", 5],
      ["Filter needle / IV flush syringes 10 cc", 5],
      ["Syringes 1/3/5/10 cc", 5],
      ["Syringes 20 cc", 5],
      ["Syringes 50 cc", 2],
      ["Reusable pressure infuser", 1],
    ],
    { deployments: ["Ambulance", "Ambulance + Clinic"], minService: "BLS+", source: "LZM-QC-CL-AMB-BLS+" }
  ),
  ...qtyItems(
    "amb_airway_advanced",
    "vehicle",
    "Medical Supplies",
    "Advanced Airway / Intubation",
    [
      ["ETT 2.5-8.5 set", 1, { critical: true, manualVerify: true }],
      ["LMA 2/3/4/5 set", 1],
      ["ETT stylet", 1],
      ["Bougie 10FR", 1],
      ["CO2 detector colorimetric and ET holder", 1],
      ["Intraosseous kit", 1, { critical: true, manualVerify: true }],
    ],
    { deployments: ["Ambulance", "Ambulance + Clinic"], minService: "ALS", source: "LZM-QC-CL-AMB-ALS/ALS+" }
  ),
  ...itemsFromLabels(
    "amb_defib",
    "vehicle",
    "Defibrillator",
    "ALS Defibrillator",
    [
      "2 batteries",
      "BP cuff adult and pediatric",
      "SpO2 sensor adult and pediatric",
      "Extra roll of ECG paper",
      "Pads adult and pediatric",
      "ECG electrodes adult and pediatric",
      "12 leads ECG cable",
      "Pediatric paddles",
      "Razor",
    ],
    { deployments: ["Ambulance", "Ambulance + Clinic"], minService: "ALS", source: "LZM-QC-CL-AMB-ALS/ALS+" }
  ),
  ...itemsFromLabels(
    "amb_kits",
    "vehicle",
    "Medication & Controlled Kits",
    "Kit Control",
    [
      "Medication bag is available",
      "Medication bag is sealed",
      "Medication bag seal number verified",
      "Emergency medication kit complete and sealed per approved list",
    ],
    { deployments: ["Ambulance", "Ambulance + Clinic"], minService: "ALS", source: "LZM-QC-CL-AMB-ALS/ALS+" }
  ),
  ...itemsFromLabels(
    "amb_narc_control",
    "vehicle",
    "Medication & Controlled Kits",
    "Narcotics Control",
    ["Narcotics box sealed and log verified", "Narcotics count matches custody log"],
    { deployments: ["Ambulance", "Ambulance + Clinic"], minService: "ALS+", source: "LZM-QC-CL-AMB-ALS+" }
  ),
];

const RED_BAG_ITEMS: ReadinessChecklistItem[] = [
  ...itemsFromLabels(
    "red_bag_control",
    "red_bag",
    "Red Bag",
    "Bag Control",
    ["Bag is available", "Bag is sealed", "Seal number verified"],
    { deployments: ["Ambulance", "Clinic", "Ambulance + Clinic", "Walking Team"], source: "LZM-QC-CL-AMB-RB-001 / LZM-QC-CL-CLN-BLS/BLS+/ALS/ALS+" }
  ),
  ...qtyItems(
    "red_bag_items",
    "red_bag",
    "Ambulance Red Bag Checklist",
    "Bag Contents",
    [
      ["Gloves medium", 1],
      ["Face mask", 1],
      ["Manual blood pressure", 1, { critical: true, manualVerify: true }],
      ["OPA 6.0-10.0 mm set", 1, { critical: true, manualVerify: true }],
      ["NPA 4.0-8.0 mm set", 1],
      ["Thermometer", 1],
      ["Plastic bandage", 1],
      ["5 cc syringe", 3],
      ["10 cc syringe", 3],
      ["Filter needle", 3],
      ["Alcohol swab 100 pcs box", 1],
      ["20 cc syringe", 3],
      ["Bag valve mask BVM adult", 1, { critical: true, manualVerify: true }],
      ["Stethoscope", 1],
      ["Magill forceps", 1],
      ["Penlight", 1],
      ["Scissors", 1],
      ["Medium tape", 1],
      ["Vomiting bag", 3],
      ["Portable sharp box", 1],
      ["Sodium chloride 0.9% 500 ml", 1],
      ["Ringer lactate 500 ml", 1],
      ["Dextrose 5% 500 ml", 1],
      ["Glucometer", 1, { critical: true, manualVerify: true }],
      ["Glucometer strips", 1],
      ["Lancets", 1],
      ["Portable pulse oximeter", 1, { critical: true, manualVerify: true }],
      ["Ice spray", 1],
      ["Non-sterile gauze 7.5x7.5 cm", 1],
      ["Non-sterile gauze 2x2 cm", 1],
      ["Elastic bandage 5 cm", 2],
      ["Elastic bandage 10 cm", 2],
      ["Adhesive bandage 7.5 cm", 2],
      ["Adhesive bandage 10 cm", 2],
      ["IV set", 3],
      ["Tourniquet", 1],
      ["IV dressing", 3],
      ["3-way stopcock", 3],
      ["IV cannula G14", 2],
      ["IV cannula G16", 2],
      ["IV cannula G18", 3],
      ["IV cannula G20", 3],
      ["IV cannula G22", 3],
      ["IV cannula G24", 3],
      ["3 cc syringe", 3],
      ["Paraffin cotton gauze", 4],
      ["Triangular bandage", 2],
      ["Roll gauze 5x4 cm", 2],
      ["Roll gauze 7x4 cm", 2],
      ["Roll gauze 10x4 cm", 2],
      ["Icepack", 2],
      ["Tongue depressor", 5],
      ["Iodine swab", 5],
      ["Emergency blanket", 1],
    ],
    { deployments: ["Ambulance", "Ambulance + Clinic", "Walking Team"], source: "LZM-QC-CL-AMB-RB-001 / LZM-QC-CL-AMB-RB-002" }
  ),
];

const MEDICATION_ITEMS: ReadinessChecklistItem[] = [
  ...qtyItems(
    "med_standard",
    "medications",
    "Medication Checklist",
    "Medication Bag",
    [
      ["Adenosine 3 mg/ml ampoule", 3, { minService: "ALS" }],
      ["Amiodarone ampoule", 3, { minService: "ALS" }],
      ["Acetab 25 mg tablet", 1],
      ["Atropine sulphate ampoule", 5, { minService: "ALS", critical: true, manualVerify: true }],
      ["Aspirin protect 100 mg tablet", 1, { critical: true }],
      ["Atrovent 250 mcg 2 ml", 2],
      ["Buscopan 10 mg tablet", 1],
      ["Buscopan 20 mg/ml ampoule", 3],
      ["Chlorpheniramine maleate 10 mg ampoule", 3],
      ["Diclofenac sodium 75 mg ampoule", 3],
      ["Dexamethasone 4 mg/ml ampoule", 2],
      ["Dextrose 50%", 3, { critical: true, manualVerify: true }],
      ["Epinephrine 1:1000", 3, { critical: true, manualVerify: true }],
      ["Furosemide 40 mg ampoule", 3, { minService: "ALS" }],
      ["Glucagon emergency kit", 1, { critical: true, manualVerify: true }],
      ["Hydrocortisone 100 mg vial", 3],
      ["Ibuprofen 400 mg tablet", 3],
      ["Magnesium sulphate 500 mg/ml", 1, { minService: "ALS" }],
      ["Mebo cream", 2],
      ["Metoclopramide 5 mg/ml ampoule", 2],
      ["Naloxone hydrochloride 0.4 mg/ml", 2, { critical: true, manualVerify: true }],
      ["Isosorbide dinitrate 5 mg tablet", 1, { minService: "ALS" }],
      ["Ondansetron 4 mg ampoule", 1],
      ["Paracetamol 500 mg tablet", 4],
      ["Paracetamol 1 g IV", 4],
      ["Pantomax 40 mg tablet", 1],
      ["Risek 40 mg vial", 3],
      ["Salbutamol inhalation solution", 3, { critical: true, manualVerify: true }],
      ["Sodium bicarbonate 8.4% 50 ml", 1, { minService: "ALS" }],
      ["Telfast 180 mg tablet", 3],
      ["Xefo 8 mg vial", 4],
      ["Saline 10 ml", 3],
      ["Saline 5 ml", 3],
    ],
    { deployments: ["Ambulance", "Clinic", "Ambulance + Clinic", "Walking Team"], source: "LZM-QC-CL-AMB-MED" }
  ),
  ...qtyItems(
    "med_narcotics",
    "medications",
    "Narcotics Medication Checklist",
    "Controlled Substances",
    [
      ["Diazepam", 2],
      ["Morphine", 2],
      ["Lorazepam", 2],
      ["Midazolam", 2],
      ["Pethidine", 2],
      ["Tramadol", 2],
    ],
    { deployments: ["Ambulance", "Clinic", "Ambulance + Clinic", "Walking Team"], minService: "ALS+", source: "LZM-QC-CL-AMB-NARC" }
  ),
];

const CLINIC_ITEMS: ReadinessChecklistItem[] = [
  ...itemsFromLabels(
    "clinic_room",
    "clinic",
    "Clinic Readiness",
    "Communication & Patient Room",
    [
      "Radio device fixed and working",
      "Patient room decontaminated",
      "Patient room clean and tidy",
      "Sharp container more than 1/3 empty",
      "Garbage is empty",
      "A/C working",
      "Room lights working",
      "Suction device",
      "Stair chair",
      "AED",
      "Monitor device",
    ],
    { deployments: ["Clinic", "Ambulance + Clinic"], source: "LZM-QC-CL-CLN-BLS/BLS+/ALS/ALS+" }
  ),
  ...qtyItems(
    "clinic_supplies",
    "clinic",
    "Clinic Supplies",
    "General Supplies",
    [
      ["Examination bed", 1],
      ["Trolly", 1],
      ["White screen", 1],
      ["Foot step", 1],
      ["Sharp box 30L", 1],
      ["Pillow", 1],
      ["Blanket", 1],
      ["Band aid", 1],
      ["Roll gauze 10 cm", 5],
      ["Roll gauze 7.5 cm", 5],
      ["Roll gauze 5 cm", 5],
      ["Gauze 10x10 non-sterile", 2],
      ["Gauze 7.5x7.5 non-sterile", 2],
      ["Gauze 5x5 non-sterile", 2],
      ["Elastic bandage 10 cm", 3],
      ["Elastic bandage 7.5 cm", 3],
      ["Elastic bandage 5 cm", 3],
      ["Adhesive bandage 10 cm", 5],
      ["Adhesive bandage 7.5 cm", 5],
      ["Triangular bandages", 3],
      ["Surgical tape 5 cm", 2],
      ["Surgical tape 2.5 cm", 2],
      ["Silk tape 5 cm", 2],
      ["Silk tape 2.5 cm", 2],
      ["Surgical scissor", 1],
      ["Iodine wipes", 10],
      ["Sam splint large", 2],
      ["Sam splint medium", 2],
      ["Cold packs", 5],
      ["Alcohol wipes", 2],
      ["Eye pad", 2],
      ["Roll sheet", 2],
      ["Vomiting bag", 5],
      ["Nitrile gloves large", 1],
      ["Nitrile gloves medium", 1],
      ["Nitrile gloves small", 1],
      ["Face mask", 1],
      ["Hand sanitizer", 1],
      ["Disposable underpads", 1],
      ["Disinfectant solution 750 ml", 1],
      ["Alcohol disinfectant wipes", 1],
      ["Property bag", 10],
      ["Small biohazard bag", 10],
      ["Ice spray", 2],
      ["Deep heat", 2],
      ["Hyoscine 10 mg tablet", 5],
      ["Ibuprofen 400 mg tablet", 5],
      ["Burn cream", 5],
      ["Pantoprazole 40 mg tablet", 2],
      ["Fexofenadine 180 mg tablet", 4],
      ["Paracetamol 500 mg tablet", 10],
      ["Thermometer", 1],
      ["Thermometer cover", 2],
      ["Blood pressure automatic", 1],
      ["Blood pressure manual", 1],
      ["Penlight", 1],
      ["Ring cutter", 1],
      ["Stethoscope", 1],
      ["Glucometer", 1, { critical: true, manualVerify: true }],
      ["Glucometer lancet", 2],
      ["Glucometer strip", 2],
      ["Pulse oximeter", 1, { critical: true, manualVerify: true }],
    ],
    { deployments: ["Clinic", "Ambulance + Clinic"], source: "LZM-QC-CL-CLN-BLS" }
  ),
  ...qtyItems(
    "clinic_plus",
    "clinic",
    "Clinic Supplies",
    "Advanced Clinic Supplies",
    [
      ["IV stand", 1],
      ["OPA 5", 2],
      ["OPA 6", 2],
      ["OPA 7", 2],
      ["OPA 8", 2],
      ["OPA 9", 2],
      ["OPA 10", 2],
      ["OPA 11", 2],
      ["NPA 4", 2],
      ["NPA 5", 2],
      ["NPA 6", 2],
      ["NPA 6.5", 2],
      ["NPA 7", 2],
      ["NPA 8", 2],
      ["Jelly lubricant", 30],
      ["Magill forceps adult", 2],
      ["Magill forceps pediatric", 1],
      ["Suction tube soft 14", 5],
      ["Suction tube soft 16", 5],
      ["Suction tube rigid Yankauer", 5],
      ["BVM adult", 1],
      ["BVM pediatric", 1],
      ["Normal saline 500 ml", 10],
      ["Ringer lactate 500 ml", 5],
      ["Dextrose 5% 500 ml", 5],
      ["IV 14", 10],
      ["IV 16", 10],
      ["IV 18", 20],
      ["IV 20", 20],
      ["IV 22", 20],
      ["IV 24", 20],
      ["IV set", 20],
      ["Syringe 1 ml", 20],
      ["Syringe 3 ml", 20],
      ["Syringe 5 ml", 20],
      ["Syringe 10 ml", 20],
      ["3 ways", 30],
      ["IV dressing", 30],
      ["Kidney tray plastic", 3],
    ],
    { deployments: ["Clinic", "Ambulance + Clinic"], minService: "BLS+", source: "LZM-QC-CL-CLN-BLS+/ALS/ALS+" }
  ),
  ...qtyItems(
    "clinic_als",
    "clinic",
    "Clinic Supplies",
    "ALS Clinic Supplies",
    [
      ["CO2 detector colorimetric", 2],
      ["ET 3.5", 1],
      ["ET 4", 1],
      ["ET 4.5", 1],
      ["ET 5", 1],
      ["ET 5.5", 1],
      ["ET 6", 1],
      ["ET 6.5", 1],
      ["ET 7", 1],
      ["ET 7.5", 1],
      ["ET 8", 1],
      ["ET 8.5", 1],
      ["ET holder", 1],
      ["ET stylet", 1],
      ["Bougie 15 fr", 2],
      ["Laryngoscope mac 2-4", 1],
      ["Laryngeal mask 2", 2],
      ["Laryngeal mask 3", 2],
      ["Laryngeal mask 4", 2],
      ["Laryngeal mask 5", 2],
      ["IO kit", 1, { critical: true, manualVerify: true }],
    ],
    { deployments: ["Clinic", "Ambulance + Clinic"], minService: "ALS", source: "LZM-QC-CL-CLN-ALS/ALS+" }
  ),
];

const WALKING_TEAM_ITEMS: ReadinessChecklistItem[] = qtyItems(
  "walking_team",
  "walking_team",
  "Walking Team Checklist",
  "Team Equipment",
  [
    ["AED", 1, { critical: true, manualVerify: true }],
    ["EMT bag", 1, { critical: true, manualVerify: true }],
    ["Oxygen bag", 1, { critical: true, manualVerify: true }],
    ["Medication bag", 1, { critical: true, manualVerify: true }],
  ],
  { deployments: ["Walking Team"], source: "LZM-QC-CL-AMB-WT" }
);

const VEST_ITEMS: ReadinessChecklistItem[] = qtyItems(
  "vest",
  "vest",
  "Vest Checklist",
  "Vest Supplies",
  [
    ["Gloves", 4],
    ["Face mask", 2],
    ["Vomiting bag", 2],
    ["Gauze", 2],
    ["Plastic bandage", 2],
    ["Alcohol swab", 4],
    ["Paracetamol tablet strips", 2],
  ],
  { deployments: ["Walking Team"], source: "LZM-QC-CL-AMB-VST" }
);

const OXYGEN_BAG_ITEMS: ReadinessChecklistItem[] = qtyItems(
  "oxygen_bag",
  "oxygen",
  "Oxygen Bag Checklist",
  "Oxygen Bag",
  [
    ["BVM adult-pediatric-infant", 1, { critical: true, manualVerify: true }],
    ["Nasal cannula adult", 2],
    ["Oxygen mask adult", 2],
    ["Nebulizer mask adult", 2],
    ["Non-rebreather NRB adult", 2],
    ["Nasal cannula pediatric", 2],
    ["Oxygen mask pediatric", 2],
    ["Nebulizer mask pediatric", 2],
    ["Non-rebreather NRB pediatric", 2],
    ["Oxygen cylinder regulator", 1, { critical: true, manualVerify: true }],
  ],
  { deployments: ["Walking Team"], source: "LZM-QC-CL-AMB-O2" }
);

const CLOSING_ITEMS: ReadinessChecklistItem[] = [
  ...itemsFromLabels(
    "close_general",
    "closing",
    "Closing Checklist",
    "Shift Handover",
    [
      "Unit returned to assigned base / handover location",
      "End-of-shift handover completed with control room",
      "Radio returned / charged and operational",
      "Keys, seals, and assigned assets handed over",
      "Incident, damage, or variance notes recorded",
    ],
    { source: "Official closing readiness checklist" }
  ),
  ...itemsFromLabels(
    "close_ambulance",
    "closing",
    "Ambulance Closing",
    "Ambulance",
    [
      "Vehicle parked safely and locked",
      "Vehicle external and internal damage checked",
      "Fuel, oxygen, and stretcher condition reported",
      "Patient cabinet cleaned and waste disposed",
      "Red bag, medication bag, and narcotics seals verified",
    ],
    {
      deployments: ["Ambulance", "Ambulance + Clinic"],
      source: "Official ambulance closing checklist",
    }
  ),
  ...itemsFromLabels(
    "close_clinic",
    "closing",
    "Clinic Closing",
    "Clinic",
    [
      "Clinic room cleaned and secured",
      "Clinic supplies and consumables shortage recorded",
      "Medication and red bag seals verified",
      "Clinic key and fixed assets handed over",
    ],
    {
      deployments: ["Clinic", "Ambulance + Clinic"],
      source: "Official clinic closing checklist",
    }
  ),
  ...itemsFromLabels(
    "close_wt",
    "closing",
    "Walking Team Closing",
    "Walking Team",
    [
      "Vest and walking team kit returned",
      "Oxygen bag pressure and usage recorded",
      "Red bag and medication bag seals verified",
      "Used or missing walking team items reported",
    ],
    { deployments: ["Walking Team"], source: "Official walking team closing checklist" }
  ),
];

export const STANDARD_READINESS_ITEMS: ReadinessChecklistItem[] = [
  ...AMBULANCE_OPENING_ITEMS,
  ...CLINIC_OPENING_ITEMS,
  ...AMBULANCE_VEHICLE_ITEMS,
  ...AMBULANCE_MEDICAL_SUPPLY_ITEMS,
  ...RED_BAG_ITEMS,
  ...MEDICATION_ITEMS,
  ...CLINIC_ITEMS,
  ...WALKING_TEAM_ITEMS,
  ...VEST_ITEMS,
  ...OXYGEN_BAG_ITEMS,
];

export function getWizardSteps(deploymentType: DeploymentType | string = "Ambulance") {
  const deployment = normalizeDeploymentType(deploymentType);
  if (deployment === "Ambulance + Clinic") {
    return [
      "Info",
      "Service",
      "Deploy",
      "Opening",
      "Vehicle",
      "Clinic",
      "Red Bag",
      "Meds",
      "Submit",
    ];
  }
  if (deployment === "Ambulance") {
    return ["Info", "Service", "Deploy", "Opening", "Vehicle", "Red Bag", "Meds", "Submit"];
  }
  if (deployment === "Clinic") {
    return ["Info", "Service", "Deploy", "Opening", "Clinic", "Red Bag", "Meds", "Submit"];
  }
  return [
    "Info",
    "Service",
    "Deploy",
    "Walking Team",
    "Vest",
    "Oxygen",
    "Red Bag",
    "Meds",
    "Submit",
  ];
}

export function getChecklistWizardSteps(
  deploymentType: DeploymentType | string = "Ambulance",
  checklistPhase: ChecklistPhase = "opening"
) {
  if (checklistPhase === "closing") return ["Info", "Closing", "Submit"];
  return getWizardSteps(deploymentType);
}

export function getStepKeyForWizardLabel(label: string): ChecklistStepKey | "" {
  if (label === "Opening") return "opening";
  if (label === "Closing") return "closing";
  if (label === "Vehicle") return "vehicle";
  if (label === "Clinic") return "clinic";
  if (label === "Walking Team") return "walking_team";
  if (label === "Vest") return "vest";
  if (label === "Oxygen") return "oxygen";
  if (label === "Red Bag") return "red_bag";
  if (label === "Meds") return "medications";
  return "";
}

export function getRiyadhDateKey(value: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "00";
  const day = parts.find((part) => part.type === "day")?.value || "00";
  return `${year}-${month}-${day}`;
}

export function getVisibleChecklistItems(
  serviceType: ServiceType | string = "BLS",
  deploymentType: DeploymentType | string = "Ambulance",
  checklistPhase: ChecklistPhase = "opening"
) {
  const normalizedService = normalizeServiceType(serviceType);
  const normalizedDeployment = normalizeDeploymentType(deploymentType);
  const sourceItems = checklistPhase === "closing" ? CLOSING_ITEMS : STANDARD_READINESS_ITEMS;

  return sourceItems.filter((item) => {
    const serviceOk =
      !item.serviceLevels || item.serviceLevels.includes(normalizedService);
    const deploymentOk =
      !item.deploymentTypes ||
      item.deploymentTypes.includes(normalizedDeployment);
    return serviceOk && deploymentOk;
  }).map((item) => ({ ...item }));
}

export function cloneDefaultChecklistItems(
  serviceType: ServiceType | string = "BLS",
  deploymentType: DeploymentType | string = "Ambulance",
  checklistPhase: ChecklistPhase = "opening"
) {
  return getVisibleChecklistItems(serviceType, deploymentType, checklistPhase);
}

export function checkAllEligibleItems(items: ReadinessChecklistItem[]) {
  return items.map((item) => {
    if (item.critical || item.manualVerify) return item;
    if (item.status === "not_applicable") return item;
    return {
      ...item,
      status: "checked" as ChecklistItemStatus,
      actualQty: item.minQty ? Math.max(Number(item.actualQty || 0), item.minQty) : item.actualQty,
    };
  });
}

export function isInsufficientQuantity(item: ReadinessChecklistItem) {
  if (item.status === "some") return true;
  return (
    item.status === "checked" &&
    Boolean(item.minQty) &&
    Number(item.actualQty || 0) < Number(item.minQty)
  );
}

export function isReadinessIssue(item: ReadinessChecklistItem) {
  return (
    item.status === "unchecked" ||
    item.status === "some" ||
    item.status === "missing" ||
    item.status === "not_available" ||
    isInsufficientQuantity(item)
  );
}

export function calculateReadiness(items: ReadinessChecklistItem[]) {
  const applicable = items
    .filter((item) => item.status !== "not_applicable")
    .map(classifyReadinessItem);
  const missingItems = applicable.filter((item) => item.status === "missing");
  const someItems = applicable.filter((item) => item.status === "some");
  const unavailableItems = applicable.filter((item) => item.status === "not_available");
  const insufficientQuantityItems = applicable.filter(isInsufficientQuantity);
  const unresolvedItems = applicable.filter(isReadinessIssue);
  const checked = applicable.filter(
    (item) => item.status === "checked" && !isInsufficientQuantity(item)
  );
  const criticalIssues = applicable.filter((item) => item.critical && isReadinessIssue(item));
  const vehicleRedIssues = applicable.filter(
    (item) => item.vehicleSeverity === "red" && isReadinessIssue(item)
  );
  const vehicleYellowIssues = applicable.filter(
    (item) => item.vehicleSeverity === "yellow" && isReadinessIssue(item)
  );
  const vehicleGreenIssues = applicable.filter(
    (item) => item.vehicleSeverity === "green" && isReadinessIssue(item)
  );
  const shortageIssues = [...missingItems, ...someItems, ...unavailableItems, ...insufficientQuantityItems].filter(
    (item, index, all) => all.findIndex((entry) => entry.id === item.id) === index
  );
  const controlRoomWarnings = [
    ...vehicleYellowIssues,
    ...shortageIssues,
    ...criticalIssues,
  ].filter((item, index, all) => all.findIndex((entry) => entry.id === item.id) === index);
  const denominator = applicable.length || 1;
  const readinessScore = Math.max(
    0,
    Math.round(((denominator - unresolvedItems.length) / denominator) * 100)
  );
  let result: ChecklistResult = "Ready";
  if (vehicleRedIssues.length > 0) result = "Not Ready";
  else if (readinessScore < 100 || controlRoomWarnings.length > 0 || vehicleGreenIssues.length > 0) {
    result = "Ready with Warnings";
  }
  return {
    readinessScore,
    result,
    missingItems,
    someItems,
    unavailableItems,
    insufficientQuantityItems,
    criticalIssues,
    vehicleRedIssues,
    vehicleYellowIssues,
    vehicleGreenIssues,
    shortageIssues,
    controlRoomWarnings,
    checkedCount: checked.length,
    applicableCount: applicable.length,
  };
}

function removeUndefinedValues<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => removeUndefinedValues(entry)) as T;
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce(
      (acc, [key, entry]) => {
        if (entry !== undefined) {
          acc[key] = removeUndefinedValues(entry);
        }
        return acc;
      },
      {} as Record<string, unknown>
    ) as T;
  }

  return value;
}

export function getUnitIdFromMission(mission: any) {
  return (
    mission?.assignedUnit?.id ||
    mission?.assignedUnit?.unitId ||
    mission?.assignedUnitId ||
    mission?.ambulanceId ||
    mission?.ambulanceCode ||
    mission?.roaming ||
    mission?.clinicId ||
    ""
  );
}

export function getUnitCodeFromMission(mission: any) {
  return (
    mission?.assignedUnit?.code ||
    mission?.assignedUnit?.unitCode ||
    mission?.assignedUnit?.name ||
    mission?.assignedAmbulanceCode ||
    mission?.ambulanceCode ||
    mission?.roaming ||
    mission?.clinicId ||
    getUnitIdFromMission(mission) ||
    ""
  );
}

export function isProjectMission(mission: any) {
  const source = String(mission?.sourceType || mission?.caseType || "").trim().toLowerCase();
  if (source.includes("general")) return false;
  if (source.includes("b2c")) return Boolean(getUnitIdFromMission(mission));
  return Boolean(mission?.projectId);
}

export function isMissionActive(mission: any) {
  const status = String(mission?.status || mission?.dispatchStatus || "").trim().toLowerCase();
  return !["closed", "completed", "cancelled", "canceled"].includes(status);
}

export function getMissionLabel(mission: any) {
  const code =
    mission?.lazemCode ||
    mission?.caseNumber ||
    (mission?.bookingConfirmationNumber ? `B2C-${mission.bookingConfirmationNumber}` : "");
  const context = [
    mission?.projectName || mission?.assignedProjectName,
    mission?.chiefComplaint || mission?.serviceType || mission?.diagnosisOrReason,
    getUnitCodeFromMission(mission),
  ]
    .filter(Boolean)
    .join(" / ");
  if (code && context) return `${code} - ${context}`;
  return code || context || "";
}

export async function findDuplicateChecklist(
  projectId: string,
  unitId: string,
  dateKey: string,
  shiftKey: string,
  checklistPhase: ChecklistPhase = "opening"
) {
  if (!projectId || !unitId || !dateKey || !shiftKey) return null;
  const q = query(
    collection(db, CHECKLIST_COLLECTION),
    where("projectId", "==", projectId),
    where("unitId", "==", unitId),
    where("dateKey", "==", dateKey),
    where("shiftKey", "==", shiftKey),
    limit(20)
  );
  const snap = await getDocs(q);
  const first = snap.docs.find((entry) => {
    const data: any = entry.data();
    return (data.checklistPhase || "opening") === checklistPhase;
  });
  return first ? { id: first.id, ...first.data() } : null;
}

export async function createReadinessChecklist(
  payload: ReadinessChecklistPayload,
  status: "draft" | "submitted"
) {
  if (!payload.allowDuplicate) {
    const duplicate = await findDuplicateChecklist(
      payload.projectId,
      payload.unitId,
      payload.dateKey,
      payload.shiftKey,
      payload.checklistPhase || "opening"
    );
    if (duplicate) {
      throw new Error("A checklist already exists for this unit, date, shift, and phase.");
    }
  }
  const cleanPayload = removeUndefinedValues(payload);
  const readiness = removeUndefinedValues(calculateReadiness(cleanPayload.items));
  return addDoc(collection(db, CHECKLIST_COLLECTION), {
    ...cleanPayload,
    ...readiness,
    checklistPhase: cleanPayload.checklistPhase || "opening",
    templateVersion: READINESS_TEMPLATE_VERSION,
    status,
    submittedAt: status === "submitted" ? serverTimestamp() : null,
    submittedAtMs: status === "submitted" ? cleanPayload.submittedAtMs || Date.now() : null,
    durationSeconds: cleanPayload.durationSeconds || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateReadinessChecklistDraft(
  checklistId: string,
  payload: Pick<ReadinessChecklistPayload, "items" | "notes"> & Partial<Pick<ReadinessChecklistPayload, "durationSeconds">>
) {
  const cleanPayload = removeUndefinedValues(payload);
  const readiness = removeUndefinedValues(calculateReadiness(cleanPayload.items));
  await updateDoc(doc(db, CHECKLIST_COLLECTION, checklistId), {
    ...cleanPayload,
    ...readiness,
    status: "draft",
    durationSeconds: cleanPayload.durationSeconds || null,
    updatedAt: serverTimestamp(),
  });
}

export async function submitReadinessChecklist(
  checklistId: string,
  payload: Pick<ReadinessChecklistPayload, "items" | "notes"> & Partial<Pick<ReadinessChecklistPayload, "durationSeconds" | "submittedAtMs">>
) {
  const cleanPayload = removeUndefinedValues(payload);
  const readiness = removeUndefinedValues(calculateReadiness(cleanPayload.items));
  await updateDoc(doc(db, CHECKLIST_COLLECTION, checklistId), {
    ...cleanPayload,
    ...readiness,
    status: "submitted",
    submittedAt: serverTimestamp(),
    submittedAtMs: cleanPayload.submittedAtMs || Date.now(),
    durationSeconds: cleanPayload.durationSeconds || null,
    updatedAt: serverTimestamp(),
  });
}

export async function reviewReadinessChecklist(
  checklistId: string,
  action: "approved" | "returned_for_correction",
  reviewer: any,
  reviewNotes: string
) {
  await updateDoc(doc(db, CHECKLIST_COLLECTION, checklistId), {
    status: action,
    reviewNotes,
    reviewedAt: serverTimestamp(),
    reviewedBy: reviewer?.uid || "",
    reviewedByName: reviewer?.displayName || reviewer?.name || reviewer?.email || "",
    approvedAt: action === "approved" ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
}

export function canViewChecklist(checklist: any, permissions: PermissionsMap, user: any) {
  const normalized = normalizePermissions(permissions);
  if (hasPermission(normalized, "readiness_checklists", "view_all", user?.role)) return true;
  return (
    (hasPermission(normalized, "readiness_checklists", "view", user?.role) ||
      hasPermission(normalized, "readiness_checklists", "view_own", user?.role)) &&
    checklist?.inspectorUserId === user?.uid
  );
}

export function canEditOwnDraft(checklist: any, permissions: PermissionsMap, user: any) {
  return (
    (checklist?.status === "draft" || checklist?.status === "returned_for_correction") &&
    checklist?.inspectorUserId === user?.uid &&
    hasPermission(permissions, "readiness_checklists", "edit_own_draft", user?.role)
  );
}

export function canSubmitChecklist(checklist: any, permissions: PermissionsMap, user: any) {
  return (
    (checklist?.status === "draft" || checklist?.status === "returned_for_correction") &&
    checklist?.inspectorUserId === user?.uid &&
    hasPermission(permissions, "readiness_checklists", "submit", user?.role)
  );
}

