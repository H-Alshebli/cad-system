"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
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
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { db } from "@/lib/firebase";
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
  return field.type === "textarea" ? "md:col-span-2" : "";
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
  const [roles, setRoles] = useState<string[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<CrewProfileAttachments>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [expiryNotifications, setExpiryNotifications] = useState<
    CrewExpiryNotification[]
  >([]);

  useEffect(() => {
    if (!user) return;
    setValues(getCrewProfileValues(user));
    setAttachments(user.crewProfileAttachments || {});
  }, [user]);

  const completion = useMemo(
    () => getCrewProfileCompletion(values, attachments),
    [values, attachments]
  );
  const requiredFieldKeys = useMemo(
    () => new Set(completion.requiredKeys),
    [completion.requiredKeys.join("|")]
  );

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "roles"), (snap) => {
      setRoles(snap.docs.map((item) => item.id).sort((a, b) => a.localeCompare(b)));
    });

    return () => unsub();
  }, []);

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
      const nextCompletion = getCrewProfileCompletion(
        nextValues,
        nextAttachments
      );

      setAttachments(nextAttachments);
      setValues(nextValues);

      await updateDoc(doc(db, "users", user.uid), {
        crewProfileAttachments: nextAttachments,
        crewProfileCompletion: nextCompletion.percent,
        crewProfileMissingFields: nextCompletion.missing.map(
          (item) => item.key
        ),
        crewProfilePendingVerificationFields:
          nextCompletion.pendingVerification.map((item) => item.key),
        crewProfileRejectedFields: nextCompletion.rejected.map(
          (item) => item.key
        ),
        crewProfileExpiredFields: nextCompletion.expired.map(
          (item) => item.key
        ),
        crewProfileExpiringSoonFields: nextCompletion.expiringSoon.map(
          (item) => item.key
        ),
        crewProfileStatus: nextCompletion.status,
        crewProfileComplianceStatus: nextCompletion.complianceStatus,
        crewProfileIsComplete: nextCompletion.isComplete,
        crewProfileIsCompliant: nextCompletion.isCompliant,
        profileUpdatedAt: serverTimestamp(),
      });

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
      return roles.map((role) => ({ value: role, label: role }));
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

    return (field.options || []).map((option) => ({ value: option, label: option }));
  }

  async function saveProfile() {
    if (!user?.uid) return;

    if (!isValidSaudiIban(values.iban || "")) {
      setError("IBAN must start with SA followed by exactly 22 digits (24 characters total).");
      return;
    }
    if (!/^\d{18}$/.test(values.accountNumber || "")) {
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

      await updateDoc(doc(db, "users", user.uid), {
        crewProfile,
        crewProfileAttachments: attachments,
        crewProfileCompletion: completion.percent,
        crewProfileMissingFields: completion.missing.map((field) => field.key),
        crewProfilePendingVerificationFields: completion.pendingVerification.map(
          (field) => field.key
        ),
        crewProfileRejectedFields: completion.rejected.map((field) => field.key),
        crewProfileExpiredFields: completion.expired.map((field) => field.key),
        crewProfileExpiringSoonFields: completion.expiringSoon.map(
          (field) => field.key
        ),
        crewProfileStatus: completion.status,
        crewProfileComplianceStatus: completion.complianceStatus,
        crewProfileIsComplete: completion.isComplete,
        crewProfileIsCompliant: completion.isCompliant,
        profileUpdatedAt: serverTimestamp(),
        name:
          fullNameEn ||
          fullNameAr ||
          user.name ||
          user.displayName ||
          user.email ||
          "",
        fullNameEn,
        fullNameAr,
        employeeId: crewProfile.employeeId || user.employeeId || "",
        mobile: mobileWithCode || user.mobile || "",
        iban: crewProfile.iban || "",
      });

      setValues((current) => ({
        ...current,
        iban: formatIban(current.iban || ""),
        alternativeIban: formatIban(current.alternativeIban || ""),
      }));
      setMessage(
        completion.isCompliant
          ? "Crew profile saved and marked compliant."
          : "Crew profile saved as a draft. Complete the required fields to become compliant."
      );
    } catch (err) {
      console.error("Failed to save crew profile", err);
      setError("Could not save the profile. Please try again.");
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

        <button onClick={saveProfile} disabled={saving} className="btn-primary gap-2">
          <Save size={16} />
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </div>

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

              <div className="grid gap-4 md:grid-cols-2">
                {visibleFields.map((field) => (
                  <label key={field.key} className={fieldSpan(field)}>
                    <span className="field-label">
                      {field.label}
                      {requiredFieldKeys.has(field.key) && (
                        <span className="text-red-500"> *</span>
                      )}
                    </span>

                    {field.type === "select" ? (
                      <select
                        className="select"
                        value={values[field.key] || ""}
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
                        placeholder={field.placeholder || ""}
                        onChange={(event) => updateField(field, event.target.value)}
                      />
                    ) : (
                      <input
                        className="input"
                        type={field.type}
                        value={values[field.key] || ""}
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

          <div className="sticky bottom-4 flex justify-end">
            <button onClick={saveProfile} disabled={saving} className="btn-primary gap-2">
              <Save size={16} />
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
