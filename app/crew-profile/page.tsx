"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import {
  AlertCircle,
  BadgeCheck,
  Bell,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  IdCard,
  Mail,
  Save,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { auth, db } from "@/lib/firebase";
import { uploadStorageFile } from "@/lib/storageUploads";
import { useCurrentUser } from "@/lib/useCurrentUser";
import {
  CREW_PROFILE_SECTIONS,
  CrewProfileAttachments,
  CrewProfileField,
  CrewProfileValues,
  formatIban,
  getCrewAttachmentStatus,
  getCrewProfileCompletion,
  getCrewProfileValues,
  isCrewProfileFieldVisible,
  isValidSaudiIban,
  normalizeIban,
  sanitizeSaudiIban,
} from "@/lib/crewProfile";
import { getProjectDisplayName } from "@/lib/displayLabels";
import {
  CREW_ORGANIZATION_ROLES,
  SAUDI_BANKS,
  SAUDI_COVERAGE_CITIES,
  WEEK_DAYS,
  findCrewOrganizationRole,
} from "@/lib/crewOrganization";

const sectionIcons: Record<string, React.ReactNode> = {
  personal: <IdCard size={18} />,
  contact: <Mail size={18} />,
  employment: <Building2 size={18} />,
  credentials: <ShieldCheck size={18} />,
  bank: <CreditCard size={18} />,
};

type CrewExpiryNotification = {
  id: string;
  title?: string;
  message?: string;
  expiryDate?: string;
  daysRemaining?: number;
  threshold?: number;
  createdAt?: any;
};

function fieldSpan(field: CrewProfileField) {
  if (field.key === "roleCategory") return "md:col-span-3";
  return field.type === "textarea" ? "md:col-span-2" : "";
}

function parseStringList(value: string) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function parseAvailability(value: string) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function cleanValue(field: CrewProfileField, value: string) {
  if (field.key === "iban" || field.key === "alternativeIban") {
    return sanitizeSaudiIban(value);
  }

  if (
    field.key === "accountNumber" ||
    field.key === "alternativeAccountNumber"
  ) {
    return value.replace(/\D/g, "").slice(0, 18);
  }

  if (field.type === "tel") {
    return value.replace(/\s+/g, "");
  }

  if (field.key === "nationalAddressRNumber") {
    return value.replace(/\s+/g, "").toUpperCase();
  }

  return value;
}

function toStoredProfile(values: CrewProfileValues) {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([key]) => !key.endsWith("Attachment"))
      .map(([key, value]) => [
        key,
        key === "iban" || key === "alternativeIban"
          ? normalizeIban(value)
          : String(value || "").trim(),
      ])
  );
}

function buildFullName(profile: Record<string, string>, language: "en" | "ar") {
  const suffix = language === "en" ? "En" : "Ar";
  return [
    profile[`firstName${suffix}`],
    profile[`secondName${suffix}`],
    profile[`thirdName${suffix}`],
    profile[`familyName${suffix}`],
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export default function CrewProfilePage() {
  const { user, loading } = useCurrentUser();
  const [values, setValues] = useState<CrewProfileValues>({});
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<CrewProfileAttachments>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reviewStatus, setReviewStatus] = useState("draft");
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false);
  const [expiryNotifications, setExpiryNotifications] = useState<
    CrewExpiryNotification[]
  >([]);

  useEffect(() => {
    if (!user) return;
    setValues(getCrewProfileValues(user));
    setAttachments(user.crewProfileAttachments || {});
    setReviewStatus(user.crewProfileReviewStatus || "draft");
  }, [user]);

  const isEditable = ["draft", "changes_required", "reopened", ""].includes(
    reviewStatus
  );

  const completion = useMemo(
    () => getCrewProfileCompletion(values, attachments),
    [values, attachments]
  );
  const requiredFieldKeys = useMemo(
    () => new Set(completion.requiredKeys),
    [completion.requiredKeys.join("|")]
  );

  useEffect(() => {
    if (!user?.uid) {
      setExpiryNotifications([]);
      return;
    }

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("recipientUserIds", "array-contains", user.uid)
    );

    return onSnapshot(
      notificationsQuery,
      (snap) => {
        setExpiryNotifications(
          snap.docs
            .map((item) => ({ id: item.id, ...(item.data() as any) }))
            .filter((item: any) => item.type === "crew_expiry")
            .sort((a: any, b: any) => {
              const aTime = a.createdAt?.toMillis?.() || 0;
              const bTime = b.createdAt?.toMillis?.() || 0;
              return bTime - aTime;
            })
            .slice(0, 10)
        );
      },
      (notificationError) => {
        console.warn("Failed to load crew expiry notifications", notificationError);
        setExpiryNotifications([]);
      }
    );
  }, [user?.uid]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "projects"), (snap) => {
      const list = snap.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((project: any) => project.isArchived !== true)
        .sort((a: any, b: any) =>
          getProjectDisplayName(a).localeCompare(getProjectDisplayName(b))
        );

      setProjects(list);
    });

    return () => unsub();
  }, []);

  function updateField(field: CrewProfileField, value: string) {
    setMessage("");
    setError("");
    setValues((current) => {
      const next = {
        ...current,
        [field.key]: cleanValue(field, value),
      };

      if (field.key === "nationality" && value) {
        next.identityType = value === "Saudi Arabia" ? "National ID" : "Iqama";
      }

      if (field.key === "roleCategory") {
        next.jobTitle = "";
        next.department = "";
        next.supervisorName = "";
      }

      if (field.key === "jobTitle") {
        const organizationRole = findCrewOrganizationRole(value);
        if (organizationRole) {
          next.department = `${organizationRole.department} / ${organizationRole.team}`;
          next.supervisorName = organizationRole.supervisorName;
        }
      }

      return next;
    });
  }

  async function uploadAttachment(field: CrewProfileField, file?: File | null) {
    if (!user?.uid || !file) return;

    setUploadingField(field.key);
    setMessage("");
    setError("");

    try {
      const uploadedFile = await uploadStorageFile(file, {
        category: "crew-profile",
        fieldKey: field.key,
      });
      const { url, path } = uploadedFile;
      const fileData = {
        name: file.name,
        url,
        path,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        uploadedAt: new Date().toISOString(),
        uploadedById: user.uid,
        uploadedByName: user.name || user.displayName || user.email || "Crew Member",
        status: "uploaded" as const,
        verificationHistory: [
          ...(attachments[field.key]?.verificationHistory || []),
          {
            action: "uploaded" as const,
            at: new Date().toISOString(),
            actorId: user.uid,
            actorName: user.name || user.displayName || user.email || "Crew Member",
            actorEmail: user.email || "",
          },
        ],
      };

      const nextAttachments = {
        ...attachments,
        [field.key]: fileData,
      };
      const nextValues = {
        ...values,
        [field.key]: url,
      };
      setAttachments(nextAttachments);
      setValues(nextValues);

      setMessage(`${field.label} uploaded successfully.`);
    } catch (err) {
      console.error("Failed to upload crew profile attachment", err);
      setError("Could not upload the attachment. Please try again.");
    } finally {
      setUploadingField("");
    }
  }

  function getSelectOptions(field: CrewProfileField) {
    if (field.optionsSource === "roles") {
      const category = values.roleCategory === "Medical Role" ? "medical" : "non_medical";
      const configured = CREW_ORGANIZATION_ROLES.filter(
        (role) => role.category === category
      ).map((role) => role.title);

      return Array.from(new Set(configured))
        .sort((a, b) => a.localeCompare(b))
        .map((role) => ({ value: role, label: role }));
    }

    if (field.optionsSource === "projects") {
      return [
        { value: "none", label: "No assigned project" },
        { value: "lazem_hq", label: "Lazem HQ" },
        ...projects.map((project) => ({
          value: project.id,
          label: getProjectDisplayName(project),
        })),
      ];
    }

    if (field.key === "bankName" || field.key === "alternativeBankName") {
      return SAUDI_BANKS.map((bank) => ({ value: bank, label: bank }));
    }

    return (field.options || []).map((option) => ({ value: option, label: option }));
  }

  async function saveProfile(action: "save_draft" | "submit" = "save_draft") {
    if (!user?.uid) return;

    if (values.iban && !isValidSaudiIban(values.iban || "")) {
      setError("IBAN must start with SA followed by exactly 22 digits (24 characters total).");
      return;
    }
    if (values.accountNumber && !/^\d{18}$/.test(values.accountNumber || "")) {
      setError("Account Number must contain exactly 18 digits.");
      return;
    }
    if (
      values.alternativeIban &&
      !isValidSaudiIban(values.alternativeIban)
    ) {
      setError(
        "Alternative IBAN must start with SA followed by exactly 22 digits (24 characters total)."
      );
      return;
    }
    if (
      values.alternativeAccountNumber &&
      !/^\d{18}$/.test(values.alternativeAccountNumber)
    ) {
      setError("Alternative Account Number must contain exactly 18 digits.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const crewProfile = toStoredProfile(values);
      const fullNameEn = buildFullName(crewProfile, "en");
      const fullNameAr = buildFullName(crewProfile, "ar");
      const mobileWithCode = [crewProfile.mobileCountryCode, crewProfile.mobile]
        .filter(Boolean)
        .join(" ");

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("You must be signed in.");
      const response = await fetch("/api/crew-profile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          crewProfile,
          fullNameEn,
          fullNameAr,
          mobileWithCode,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not save the profile.");

      setValues((current) => ({
        ...current,
        iban: formatIban(current.iban || ""),
        alternativeIban: formatIban(current.alternativeIban || ""),
      }));
      setReviewStatus(result.status || reviewStatus);
      setShowSubmitConfirmation(false);
      setMessage(
        action === "submit"
          ? "Profile submitted successfully and locked for HR review."
          : "Draft saved successfully."
      );
    } catch (err) {
      console.error("Failed to save crew profile", err);
      setError(err instanceof Error ? err.message : "Could not save the profile.");
    } finally {
      setSaving(false);
    }
  }

  async function requestProfileUpdate() {
    const reason = window.prompt("Why do you need HR to reopen this profile?");
    if (!reason?.trim()) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/crew-profile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "request_update", reason }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not send the request.");
      setReviewStatus("update_requested");
      setMessage("Your update request was sent to HR.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the request.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page-shell">
        <div className="card-modern">Loading crew profile...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-shell">
        <div className="notice-danger">Please login to complete your profile.</div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="badge mb-3">HCAD Crew Module</div>
          <h1 className="page-title">Crew Profile</h1>
          <p className="page-subtitle">
            Complete your operational profile so HCAD has the right crew,
            license, contact, availability, and payment information.
          </p>
        </div>

        {isEditable ? (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => saveProfile("save_draft")}
              disabled={saving}
              className="btn-secondary gap-2"
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              onClick={() => setShowSubmitConfirmation(true)}
              disabled={saving}
              className="btn-primary gap-2"
            >
              <Send size={16} />
              Submit
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={requestProfileUpdate}
            disabled={saving || reviewStatus === "update_requested"}
            className="btn-secondary"
          >
            {reviewStatus === "update_requested" ? "Update Requested" : "Request an Update"}
          </button>
        )}
      </div>

      {!isEditable && (
        <div className="notice-warning mb-4">
          <div className="font-black">
            {reviewStatus === "verified"
              ? "Verified - تم التحقق من البيانات"
              : reviewStatus === "update_requested"
              ? "Update request pending HR approval"
              : "Submitted - Your profile is under HR review"}
          </div>
          <p className="mt-1 text-sm">
            This profile is locked. HR approval is required before any data or attachment can be changed.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <div className="card-modern">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-200">
                <UserRound size={22} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-black text-slate-950 dark:text-white">
                {buildFullName(values, "en") || buildFullName(values, "ar") || user.name || "Crew Member"}
                </div>
                <div className="truncate text-sm text-slate-500 dark:text-slate-400">
                  {user.email || values.email || "-"}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-600 dark:text-slate-300">
                  Profile Completion
                </span>
                <span className="font-black text-slate-950 dark:text-white">
                  {completion.percent}%
                </span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${completion.percent}%` }}
                />
              </div>
              <div className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {completion.complete} of {completion.total} required fields completed
              </div>
              <div className="mt-3">
                <span className="badge">
                  {completion.isCompliant
                    ? "Compliant"
                    : completion.isComplete
                    ? "Complete - expired items"
                    : "Draft"}
                </span>
              </div>
            </div>
          </div>

          {completion.expired.length > 0 && (
            <div className="notice-danger">
              <div className="font-black">Expired required items</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {completion.expired.map((field) => (
                  <span key={field.key} className="badge">
                    {field.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {completion.expiringSoon.length > 0 && completion.expired.length === 0 && (
            <div className="notice-warning">
              <div className="font-black">Required items expiring within 90 days</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {completion.expiringSoon.map((field) => (
                  <span key={field.key} className="badge">
                    {field.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {completion.pendingVerification.length > 0 && (
            <div className="notice-warning">
              <div className="font-black">Pending document verification</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {completion.pendingVerification.map((field) => (
                  <span key={field.key} className="badge">
                    {field.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {completion.rejected.length > 0 && (
            <div className="notice-danger">
              <div className="font-black">Rejected documents</div>
              <div className="mt-3 space-y-2">
                {completion.rejected.map((field) => (
                  <div key={field.key} className="rounded-xl border border-red-500/20 p-3">
                    <div className="font-bold">{field.label}</div>
                    {attachments[field.key]?.rejectionReason && (
                      <div className="mt-1 text-xs">
                        Reason: {attachments[field.key]?.rejectionReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card-modern">
            <div className="flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white">
              {completion.missing.length ? (
                <AlertCircle size={17} className="text-amber-500" />
              ) : (
                <CheckCircle2 size={17} className="text-emerald-500" />
              )}
              Profile Fields
            </div>

            {completion.missing.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {completion.missing.map((field) => (
                  <span key={field.key} className="badge">
                    {field.label}
                  </span>
                ))}
              </div>
            ) : !completion.isMappedJobTitle ? (
              <div className="notice-warning mt-4">
                The selected job title must be mapped before this profile can be
                marked complete.
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-700 dark:text-emerald-200">
                All tracked fields are complete.
              </div>
            )}
          </div>

          <div className="card-modern">
            <div className="flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white">
              <FileText size={17} />
              Save Notes
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
              IBAN is cleaned automatically when you paste it. Spaces are removed
              for storage and shown in readable groups on screen.
            </p>
          </div>

          <div className="card-modern">
            <div className="flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white">
              <Bell size={17} />
              Expiry Notifications
            </div>
            {expiryNotifications.length ? (
              <div className="mt-4 space-y-3">
                {expiryNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3"
                  >
                    <div className="text-sm font-black text-amber-800 dark:text-amber-200">
                      {notification.title || "Document expiry reminder"}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-amber-700 dark:text-amber-300">
                      {notification.message || "Review the document expiry date."}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                No expiry notifications.
              </div>
            )}
          </div>
        </aside>

        <main className="space-y-4">
          {message && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-700 dark:text-emerald-200">
              {message}
            </div>
          )}

          {error && <div className="notice-danger">{error}</div>}

          {CREW_PROFILE_SECTIONS.map((section) => {
            const visibleFields = section.fields.filter((field) =>
              isCrewProfileFieldVisible(field.key, values)
            );

            return (
            <section key={section.key} className="card-modern">
              <div className="mb-5 flex items-start gap-3">
                <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-200">
                  {sectionIcons[section.key] || <BadgeCheck size={18} />}
                </div>
                <div>
                  <h2 className="section-title">{section.title}</h2>
                  <p className="section-subtitle">{section.description}</p>
                </div>
              </div>

              {section.key === "personal" && (
                <div className="notice-danger mb-4 font-black">
                  يجب كتابة الاسم بالعربية والإنجليزية مطابقًا تمامًا لجواز السفر.
                  <div className="mt-1">Arabic and English names must match the passport exactly.</div>
                </div>
              )}

              {section.key === "credentials" && !values.jobTitle && (
                <div className="notice-warning mb-4">
                  Select a Job Title in Employment Details to load the applicable
                  credentials and documents.
                </div>
              )}

              {section.key === "credentials" &&
                values.jobTitle &&
                completion.titleGroup === "other" && (
                  <div className="notice-warning mb-4">
                    This custom job title is not mapped yet. All credential fields
                    remain visible for safe manual entry and are optional until the
                    title is mapped.
                  </div>
                )}

              <div
                className={`grid gap-4 ${
                  section.key === "employment" ? "md:grid-cols-3" : "md:grid-cols-2"
                }`}
              >
                {visibleFields.map((field) => (
                  <label key={field.key} className={fieldSpan(field)}>
                    <span className="field-label">
                      {field.label}
                      {requiredFieldKeys.has(field.key) && (
                        <span className="text-red-500"> *</span>
                      )}
                    </span>

                    {field.key === "roleCategory" ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {["Medical Role", "Non-Medical Role"].map((option) => (
                          <span
                            key={option}
                            className="flex items-center gap-2 rounded-2xl border border-slate-200 p-3 dark:border-slate-700"
                          >
                            <input
                              type="radio"
                              name="roleCategory"
                              value={option}
                              checked={values.roleCategory === option}
                              disabled={!isEditable}
                              onChange={() => updateField(field, option)}
                            />
                            <span className="font-bold">{option}</span>
                          </span>
                        ))}
                      </div>
                    ) : field.key === "availableWeekDays" ? (
                      <div className="space-y-2">
                        {WEEK_DAYS.map((day) => {
                          const availability = parseAvailability(values.availableWeekDays || "");
                          const selected = Boolean(availability[day]);
                          const setDay = (nextValue: any) =>
                            updateField(
                              field,
                              JSON.stringify({ ...availability, [day]: nextValue })
                            );
                          return (
                            <div key={day} className="grid items-center gap-2 rounded-xl border border-slate-200 p-2 sm:grid-cols-[130px_1fr_1fr] dark:border-slate-700">
                              <label className="flex items-center gap-2 font-bold">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  disabled={!isEditable}
                                  onChange={(event) => {
                                    const next = { ...availability };
                                    if (event.target.checked) next[day] = { from: "", to: "" };
                                    else delete next[day];
                                    updateField(field, JSON.stringify(next));
                                  }}
                                />
                                {day}
                              </label>
                              <input
                                className="input"
                                type="time"
                                aria-label={`${day} available from`}
                                disabled={!isEditable || !selected}
                                value={availability[day]?.from || ""}
                                onChange={(event) => setDay({ ...availability[day], from: event.target.value })}
                              />
                              <input
                                className="input"
                                type="time"
                                aria-label={`${day} available to`}
                                disabled={!isEditable || !selected}
                                value={availability[day]?.to || ""}
                                onChange={(event) => setDay({ ...availability[day], to: event.target.value })}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : field.key === "coverageCitiesWithin48h" ? (
                      <div className="space-y-2">
                        {parseStringList(values.coverageCitiesWithin48h || "").length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {parseStringList(values.coverageCitiesWithin48h || "").map((city) => (
                              <span
                                key={city}
                                className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-sm font-bold text-cyan-900 dark:bg-cyan-950 dark:text-cyan-100"
                              >
                                {city}
                                {isEditable && (
                                  <button
                                    type="button"
                                    aria-label={`Remove ${city}`}
                                    className="text-lg leading-none text-cyan-700 hover:text-red-600 dark:text-cyan-300"
                                    onClick={() =>
                                      updateField(
                                        field,
                                        JSON.stringify(
                                          parseStringList(values.coverageCitiesWithin48h || "").filter(
                                            (selectedCity) => selectedCity !== city
                                          )
                                        )
                                      )
                                    }
                                  >
                                    &times;
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                        <details className="group rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
                          <summary className="cursor-pointer list-none px-4 py-3 font-bold text-slate-700 dark:text-slate-200">
                            {parseStringList(values.coverageCitiesWithin48h || "").length
                              ? `${parseStringList(values.coverageCitiesWithin48h || "").length} cities selected — click to edit`
                              : "Select cities"}
                          </summary>
                          <div className="max-h-64 space-y-1 overflow-y-auto border-t border-slate-200 p-2 dark:border-slate-700">
                            {SAUDI_COVERAGE_CITIES.map((city) => {
                              const selectedCities = parseStringList(values.coverageCitiesWithin48h || "");
                              const checked = selectedCities.includes(city);
                              return (
                                <label
                                  key={city}
                                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={!isEditable}
                                    onChange={() =>
                                      updateField(
                                        field,
                                        JSON.stringify(
                                          checked
                                            ? selectedCities.filter((selectedCity) => selectedCity !== city)
                                            : [...selectedCities, city]
                                        )
                                      )
                                    }
                                  />
                                  <span>{city}</span>
                                </label>
                              );
                            })}
                          </div>
                        </details>
                      </div>
                    ) : field.key === "bankName" || field.key === "alternativeBankName" ? (
                      <>
                        <input
                          className="input"
                          list={`${field.key}-options`}
                          value={values[field.key] || ""}
                          disabled={!isEditable}
                          placeholder="Search or select a bank"
                          onChange={(event) => updateField(field, event.target.value)}
                        />
                        <datalist id={`${field.key}-options`}>
                          {SAUDI_BANKS.map((bank) => <option key={bank} value={bank} />)}
                        </datalist>
                      </>
                    ) : field.type === "select" ? (
                      <select
                        className="select"
                        value={values[field.key] || ""}
                        disabled={
                          !isEditable ||
                          (field.key === "jobTitle" && !values.roleCategory)
                        }
                        onChange={(event) => updateField(field, event.target.value)}
                      >
                        <option value="">Select</option>
                        {getSelectOptions(field).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "file" ? (
                      <div className="space-y-2">
                        <input
                          className="input"
                          type="file"
                          disabled={!isEditable}
                          onChange={(event) =>
                            uploadAttachment(field, event.target.files?.[0])
                          }
                        />
                        {uploadingField === field.key && (
                          <div className="text-xs font-bold text-blue-600 dark:text-blue-300">
                            Uploading...
                          </div>
                        )}
                        {attachments[field.key]?.url && (
                          <div className="flex flex-wrap items-center gap-2">
                            <a
                              href={attachments[field.key].url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex text-xs font-black text-blue-600 hover:underline dark:text-blue-300"
                            >
                              {attachments[field.key].name || "View uploaded file"}
                            </a>
                            <span className="badge capitalize">
                              {getCrewAttachmentStatus(attachments[field.key])}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : field.type === "textarea" ? (
                      <textarea
                        className="textarea"
                        value={values[field.key] || ""}
                        disabled={!isEditable}
                        placeholder={field.placeholder || ""}
                        onChange={(event) => updateField(field, event.target.value)}
                      />
                    ) : (
                      <input
                        className="input"
                        type={field.type}
                        value={values[field.key] || ""}
                        readOnly={field.key === "department" || field.key === "supervisorName"}
                        disabled={!isEditable}
                        placeholder={field.placeholder || ""}
                        maxLength={
                          field.key === "iban" || field.key === "alternativeIban"
                            ? 24
                            : field.key === "accountNumber" ||
                              field.key === "alternativeAccountNumber"
                            ? 18
                            : undefined
                        }
                        inputMode={
                          field.key === "accountNumber" ||
                          field.key === "alternativeAccountNumber"
                            ? "numeric"
                            : undefined
                        }
                        onChange={(event) => updateField(field, event.target.value)}
                        onBlur={() =>
                          field.key === "iban" || field.key === "alternativeIban"
                            ? updateField(field, values[field.key] || "")
                            : undefined
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
            </section>
            );
          })}

          {isEditable && (
            <div className="sticky bottom-4 flex justify-end gap-2">
              <button
                onClick={() => saveProfile("save_draft")}
                disabled={saving}
                className="btn-secondary gap-2"
              >
                <Save size={16} />
                {saving ? "Saving..." : "Save Draft"}
              </button>
              <button
                onClick={() => setShowSubmitConfirmation(true)}
                disabled={saving}
                className="btn-primary gap-2"
              >
                <Send size={16} /> Submit
              </button>
            </div>
          )}
        </main>
      </div>

      {showSubmitConfirmation && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
          <div className="card-modern w-full max-w-lg">
            <h2 className="text-xl font-black">Confirm Profile Submission</h2>
            <div className="notice-warning mt-4">
              After submission, you will not be able to edit any data or attachment.
              Any later change requires an update request approved by HR.
            </div>
            <p className="mt-4 font-bold">Are you sure all information is complete and correct?</p>
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShowSubmitConfirmation(false)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={saving} onClick={() => saveProfile("submit")}>
                {saving ? "Submitting..." : "Confirm Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
