export function timelineStats(filtered: any[], ambulanceCount: number) {
    const status = (item: any) => String(item.status || item.dispatchStatus || "").trim().toLowerCase();
    const cancelled = (item: any) => ["cancelled", "canceled"].includes(status(item));
    const closed = (item: any) => ["closed", "completed"].includes(status(item));
    const active = (item: any) => !closed(item) && !cancelled(item);
    const count = (predicate: (item: any) => boolean) => filtered.filter(predicate).length;
    const stats = {
      totalCases: count(item => !cancelled(item)), activeCases: count(active), closedCases: count(closed),
      unreceivedCases: count(item => ["Received", "Assigned"].includes(item.status)),
      enRouteCases: count(item => item.status === "EnRoute"), onSceneCases: count(item => item.status === "OnScene"),
      transportingCases: count(item => ["Transporting", "Hospital"].includes(item.status)), returningCases: count(item => item.status === "Returning"),
      closedHospitalCases: count(item => closed(item) && item.transportingToType === "hospital"),
      closedClinicCases: count(item => closed(item) && item.transportingToType === "clinic"),
      transportingHospitalCases: count(item => ["Transporting", "Hospital"].includes(item.status) && item.transportingToType === "hospital"),
      transportingClinicCases: count(item => ["Transporting", "Hospital"].includes(item.status) && item.transportingToType === "clinic"),
      totalAmbulances: ambulanceCount,
    };
    return stats;
}
