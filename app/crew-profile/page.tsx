"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  AlertCircle,
  BadgeCheck,
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
import { storage } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import {
  CREW_PROFILE_SECTIONS,
  CrewProfileField,
  CrewProfileValues,
  formatIban,
  getCrewProfileCompletion,
  getCrewProfileValues,
  normalizeIban,
} from "@/lib/crewProfile";
import { getProjectDisplayName } from "@/lib/displayLabels";

const sectionIcons: Record<string, React.ReactNode> = {
  personal: <IdCard size={18} />,
  contact: <Mail size={18} />,
  employment: <Building2 size={18} />,
  credentials: <ShieldCheck size={18} />,
  bank: <CreditCard size={18} />,
};

function fieldSpan(field: CrewProfileField) {
  return field.type === "textarea" ? "md:col-span-2" : "";
}

function cleanValue(field: CrewProfileField, value: string) {
  if (field.key === "iban") {
    return formatIban(value);
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
        key === "iban" ? normalizeIban(value) : String(value || "").trim(),
      ])
  );
}

function safeFileName(fileName: string) {
  return String(fileName || "file")
    .replace(/\s+/g, "_")
    .replace(/[^\w.\-]/g, "");
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
  const [attachments, setAttachments] = useState<Record<string, any>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    setValues(getCrewProfileValues(user));
    setAttachments(user.crewProfileAttachments || {});
  }, [user]);

  const completion = useMemo(() => getCrewProfileCompletion(values), [values]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "roles"), (snap) => {
      setRoles(snap.docs.map((item) => item.id).sort((a, b) => a.localeCompare(b)));
    });

    return () => unsub();
  }, []);

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
    setValues((current) => ({
      ...current,
      [field.key]: cleanValue(field, value),
    }));
  }

  async function uploadAttachment(field: CrewProfileField, file?: File | null) {
    if (!user?.uid || !file) return;

    setUploadingField(field.key);
    setMessage("");
    setError("");

    try {
      const fileName = `${Date.now()}_${safeFileName(file.name)}`;
      const path = `crew-profiles/${user.uid}/${field.key}/${fileName}`;
      const fileRef = ref(storage, path);

      await uploadBytes(fileRef, file, {
        contentType: file.type || "application/octet-stream",
      });

      const url = await getDownloadURL(fileRef);
      const fileData = {
        name: file.name,
        url,
        path,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };

      const nextAttachments = {
        ...attachments,
        [field.key]: fileData,
      };

      setAttachments(nextAttachments);
      setValues((current) => ({
        ...current,
        [field.key]: url,
      }));

      await updateDoc(doc(db, "users", user.uid), {
        crewProfileAttachments: nextAttachments,
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
      }));
      setMessage("Crew profile saved successfully.");
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
            </div>
          </div>

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
        </aside>

        <main className="space-y-4">
          {message && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-700 dark:text-emerald-200">
              {message}
            </div>
          )}

          {error && <div className="notice-danger">{error}</div>}

          {CREW_PROFILE_SECTIONS.map((section) => (
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

              <div className="grid gap-4 md:grid-cols-2">
                {section.fields.map((field) => (
                  <label key={field.key} className={fieldSpan(field)}>
                    <span className="field-label">
                      {field.label}
                      {field.required && <span className="text-red-500"> *</span>}
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
                          <a
                            href={attachments[field.key].url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex text-xs font-black text-blue-600 hover:underline dark:text-blue-300"
                          >
                            {attachments[field.key].name || "View uploaded file"}
                          </a>
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
                        onChange={(event) => updateField(field, event.target.value)}
                        onBlur={() =>
                          field.key === "iban"
                            ? updateField(field, values[field.key] || "")
                            : undefined
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
            </section>
          ))}

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
