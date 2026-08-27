"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ClientLanguage = "en" | "ar";

const STORAGE_KEY = "hcad-client-language";

const ar: Record<string, string> = {
  "Dashboards": "لوحات المعلومات",
  "Case monitoring and clinical analytics for your assigned projects.": "متابعة الحالات والتحليلات السريرية للمشاريع المسندة إليك.",
  "Timeline Dashboard": "لوحة المسار الزمني",
  "Cases Dashboard": "لوحة الحالات",
  "Loading dashboards...": "جارٍ تحميل لوحات المعلومات...",
  "Client Portal": "بوابة العميل",
  "My Cases": "بلاغاتي",
  "Logout": "تسجيل الخروج",
  "Active account": "نشط",
  "Close menu": "إغلاق القائمة",
  "Client Operations": "عمليات العميل",
  "Live operational view of cases across your assigned projects.": "عرض تشغيلي مباشر للحالات في مشاريعك المسندة.",
  "Filters": "عوامل التصفية",
  "Filter dashboard by project and case date.": "صفِّ اللوحة حسب المشروع وتاريخ الحالة.",
  "Project": "المشروع",
  "All Projects": "كل المشاريع",
  "Start Date": "تاريخ البداية",
  "End Date": "تاريخ النهاية",
  "Clear Filters": "مسح التصفية",
  "Total Cases": "إجمالي الحالات",
  "Active": "النشطة",
  "Request Received": "تم استلام الطلب",
  "Team Assigned": "تم إسناد الفريق",
  "EnRoute": "في الطريق",
  "OnScene": "في الموقع",
  "Transporting": "نقل المريض",
  "Hospital": "المستشفى",
  "Clinic": "العيادة",
  "Returning": "العودة",
  "Completed": "المكتملة",
  "Cases Timeline": "المسار الزمني للحالات",
  "Show All Cases": "عرض كل الحالات",
  "Hide Closed Cases": "إخفاء الحالات المغلقة",
  "No cases found.": "لم يتم العثور على حالات.",
  "Date & Time": "التاريخ والوقت",
  "Caller": "المتصل",
  "Patient": "المريض",
  "Complaint": "الشكوى",
  "Timeline": "المسار الزمني",
  "Received": "مستلمة",
  "Assigned": "مسندة",
  "Hospital stage": "المستشفى",
  "Closed": "مغلقة",
  "Request received": "تم استلام الطلب",
  "Team assigned": "تم إسناد الفريق",
  "Team on the way": "الفريق في الطريق",
  "Team arrived": "وصل الفريق",
  "Transporting patient": "جارٍ نقل المريض",
  "Arrived at destination": "تم الوصول للوجهة",
  "Team returning": "الفريق في طريق العودة",
  "Loading timeline dashboard…": "جارٍ تحميل لوحة المسار الزمني...",
  "Client Analytics": "تحليلات العميل",
  "Client-safe analytical view of ePCR activity, project distribution, triage trends, health classifications, complaints, and operational indicators.": "عرض تحليلي آمن لنشاط التقارير الطبية وتوزيع المشاريع واتجاهات الفرز والتصنيفات الصحية والشكاوى والمؤشرات التشغيلية.",
  "Sensitive patient details are hidden from this dashboard.": "تفاصيل المرضى الحساسة مخفية من هذه اللوحة.",
  "Filter by project": "التصفية حسب المشروع",
  "Total ePCR": "إجمالي التقارير الطبية",
  "Total recorded ePCR cases": "إجمالي تقارير الحالات المسجلة",
  "Male Patients": "المرضى الذكور",
  "Female Patients": "المرضى الإناث",
  "of total cases": "من إجمالي الحالات",
  "Avg Response Time": "متوسط زمن الاستجابة",
  "Average response duration": "متوسط مدة الاستجابة",
  "Top Project": "أعلى مشروع",
  "Highest ePCR volume": "أعلى عدد من التقارير الطبية",
  "Top Complaint": "أكثر شكوى",
  "Most frequent complaint": "الشكوى الأكثر تكرارًا",
  "Top Triage": "أكثر مستوى فرز",
  "Most frequent triage level": "مستوى الفرز الأكثر تكرارًا",
  "Projects Count": "عدد المشاريع",
  "Assigned projects in dashboard": "المشاريع المسندة في اللوحة",
  "Gender Distribution": "توزيع الجنس",
  "Top Projects by ePCR Volume": "أعلى المشاريع حسب التقارير الطبية",
  "Triage Level Analysis": "تحليل مستويات الفرز",
  "Health Classification Analysis": "تحليل التصنيف الصحي",
  "Chief Complaints Analysis": "تحليل الشكاوى الرئيسية",
  "Loading ePCR dashboard...": "جارٍ تحميل لوحة الحالات...",
  "Male": "ذكر",
  "Female": "أنثى",
  "male": "ذكر",
  "female": "أنثى",
  "unknown": "غير محدد",
  "Unspecified": "غير محدد",
  "Unknown Project": "مشروع غير معروف",
  "Occupational": "مهني",
  "Non-Occupational": "غير مهني",
  "General Health Illnesses": "أمراض صحية عامة",
  "Unspecified Medical Conditions": "حالات طبية غير محددة",
  "other": "أخرى",
  "Other": "أخرى",
  "Level 1 (Resuscitation)": "المستوى 1 (إنعاش)",
  "Level 2 (Emergent)": "المستوى 2 (طارئ)",
  "Level 3 (Urgent)": "المستوى 3 (عاجل)",
  "Level 4 (Less Urgent)": "المستوى 4 (أقل إلحاحًا)",
  "Level 5 (non-urgent)": "المستوى 5 (غير عاجل)",
  "Level 5 (Non-Urgent)": "المستوى 5 (غير عاجل)",
  "death": "وفاة",
  "Death": "وفاة",
  "Cardiac complaints": "شكاوى قلبية",
  "Respiratory complaints": "شكاوى تنفسية",
  "Musculoskeletal complaints": "شكاوى عضلية هيكلية",
  "Digestive complaints": "شكاوى هضمية",
  "Metabolic and endocrine complaints": "شكاوى الأيض والغدد الصماء",
  "General medical complaints": "شكاوى طبية عامة",
  "Environmental and toxicological complaints": "شكاوى بيئية وسمّية",
  "Obstetric and gynecology complaints": "شكاوى النساء والولادة",
  "Gastrointestinal complaints": "شكاوى الجهاز الهضمي",
  "Behavioral and psychological complaints": "شكاوى سلوكية ونفسية",
  "Infectious disease complaints": "شكاوى أمراض معدية",
  "Other critical complaints": "شكاوى حرجة أخرى",
  "Client Case": "بلاغ العميل",
  "New Case (Project)": "إنشاء بلاغ جديد",
  "Create a case request linked to one of your assigned projects.": "أنشئ طلب بلاغ مرتبطًا بأحد مشاريعك المسندة.",
  "No assigned projects found. Please contact Lazem team.": "لا توجد مشاريع مسندة. يرجى التواصل مع فريق لازم.",
  "Project *": "المشروع *",
  "Select project": "اختر المشروع",
  "Caller Name": "اسم المتصل",
  "Contact Number": "رقم التواصل",
  "Prehospital Chief Complaints *": "الشكوى الرئيسية قبل الوصول للمستشفى *",
  "Select complaint": "اختر الشكوى",
  "Specify other complaint": "حدد الشكوى الأخرى",
  "Prehospital Triage Color-Coded Scale *": "مستوى الفرز الطبي قبل الوصول للمستشفى *",
  "Select triage level": "اختر مستوى الفرز",
  "Patient Name": "اسم المريض",
  "Location": "الموقع",
  "Search Location": "البحث عن موقع",
  "Location Description *": "وصف الموقع *",
  "Google Maps Link (Auto-Pin)": "رابط خرائط Google (تحديد تلقائي)",
  "Latitude": "خط العرض",
  "Longitude": "خط الطول",
  "Open in Google Maps": "فتح في خرائط Google",
  "Assign Unit": "إسناد الوحدة",
  "ambulance": "إسعاف",
  "clinic": "عيادة",
  "roaming": "فريق راجل",
  "Busy": "مشغولة",
  "Available": "متاحة",
  "No location": "لا يوجد موقع",
  "Warning: this ambulance is currently busy, but you can still assign it.": "تنبيه: سيارة الإسعاف مشغولة حاليًا، ولكن لا يزال بإمكانك إسنادها.",
  "Select unit": "اختر الوحدة",
  "No units found for this project/type.": "لا توجد وحدات لهذا المشروع أو النوع.",
  "Creating...": "جارٍ الإنشاء...",
  "Create Case": "إنشاء بلاغ",
  "Back to location": "العودة إلى الموقع",
  "Loading...": "جارٍ التحميل...",
  "User is missing.": "بيانات المستخدم غير متوفرة.",
  "Please select a project.": "يرجى اختيار مشروع.",
  "Please complete chief complaint, triage, location, and unit.": "يرجى استكمال الشكوى الرئيسية والفرز والموقع والوحدة.",
  "The selected unit is not assigned to this project.": "الوحدة المختارة غير مسندة لهذا المشروع.",
  "Case submitted successfully.": "تم إرسال البلاغ بنجاح.",
  "Failed to submit case.": "تعذر إرسال البلاغ.",
  "Select project factory / site *": "اختر مصنع أو موقع المشروع *",
  "The location and map pin will be filled automatically.": "سيتم تعبئة الموقع ونقطة الخريطة تلقائيًا.",
  "Choose a factory or site": "اختر مصنعًا أو موقعًا",
  "sites": "مواقع",
  "Site": "الموقع",
  "Search by factory name or site number": "ابحث باسم المصنع أو رقم الموقع",
  "No matching location.": "لا يوجد موقع مطابق.",
  "Location not listed — enter manually": "الموقع غير موجود — أدخله يدويًا",
  "Search for a place or address in Saudi Arabia": "ابحث عن مكان أو عنوان في المملكة العربية السعودية",
  "Search": "بحث",
  "Enter at least 3 characters.": "أدخل ثلاثة أحرف على الأقل.",
  "Your session has expired. Please sign in again.": "انتهت جلستك. يرجى تسجيل الدخول مرة أخرى.",
  "No matching places found. You can still enter the coordinates manually.": "لم يتم العثور على أماكن مطابقة. يمكنك إدخال الإحداثيات يدويًا.",
  "Location search failed.": "تعذر البحث عن الموقع.",
  "Search runs only when you press Search. Results ©": "يبدأ البحث عند الضغط على زر بحث فقط. النتائج ©",
  "Export Excel": "تصدير Excel",
  "Export PDF": "تصدير PDF",
  "No cases are available to export.": "لا توجد حالات متاحة للتصدير.",
  "Client Cases": "حالات العميل",
  "Track your submitted cases and requests.": "تابع البلاغات والطلبات التي أرسلتها.",
  "Create New Case": "إنشاء بلاغ جديد",
  "Status": "الحالة",
  "All cases": "كل الحالات",
  "Active only": "النشطة فقط",
  "Completed only": "المكتملة فقط",
  "Open Location": "فتح الموقع",
  "Loading cases...": "جارٍ تحميل الحالات...",
  "Case Number": "رقم البلاغ",
  "Unit": "الوحدة",
  "Generated At": "تاريخ الإنشاء",
  "Client Timeline Report": "تقرير المسار الزمني للعميل",
  "Client Cases Report": "تقرير حالات العميل",
  "Timeline Details": "تفاصيل المسار الزمني",
};

type ClientI18nValue = {
  language: ClientLanguage;
  dir: "ltr" | "rtl";
  locale: string;
  setLanguage: (language: ClientLanguage) => void;
  toggleLanguage: () => void;
  t: (text: string) => string;
  translateValue: (value: string) => string;
};

const ClientI18nContext = createContext<ClientI18nValue | null>(null);

export function ClientI18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<ClientLanguage>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "ar" || saved === "en") setLanguageState(saved);
  }, []);

  const setLanguage = (next: ClientLanguage) => {
    setLanguageState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo<ClientI18nValue>(() => ({
    language,
    dir: language === "ar" ? "rtl" : "ltr",
    locale: language === "ar" ? "ar-SA" : "en-GB",
    setLanguage,
    toggleLanguage: () => setLanguage(language === "ar" ? "en" : "ar"),
    t: (text) => language === "ar" ? ar[text] || text : text,
    translateValue: (value) => language === "ar" ? ar[value] || value : value,
  }), [language]);

  return <ClientI18nContext.Provider value={value}>{children}</ClientI18nContext.Provider>;
}

export function useClientI18n() {
  const context = useContext(ClientI18nContext);
  if (!context) throw new Error("useClientI18n must be used inside ClientI18nProvider");
  return context;
}
