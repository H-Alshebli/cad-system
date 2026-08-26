import { auth } from "@/lib/firebase";

export type OperationalNumberKind = "case" | "epcr";

export type OperationalNumber = {
  sequence: number;
  number: string;
};

export async function reserveOperationalNumber(
  kind: OperationalNumberKind
): Promise<OperationalNumber> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be signed in to create an operational record.");
  }

  const token = await user.getIdToken();
  const response = await fetch("/api/operational-numbers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ kind }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Could not reserve an operational number.");
  }

  return {
    sequence: Number(payload.sequence),
    number: String(payload.number),
  };
}
