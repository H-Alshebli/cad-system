export function getOpsEmails() {
  return (process.env.NEXT_PUBLIC_OPS_EMAILS || "").split(",").map(s => s.trim()).filter(Boolean);
}
export function getSalesEmails() {
  return (process.env.NEXT_PUBLIC_SALES_EMAILS || "").split(",").map(s => s.trim()).filter(Boolean);
}
