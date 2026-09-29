import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
const inFlight = new Map<string, Promise<{ id: string }>>();
export function checklistLifecycle(id: string | null, body: Record<string, any>) {
  const identity = JSON.stringify([auth.currentUser?.uid, id, body.action, id ? body.notes : [body.payload?.projectId, body.payload?.unitId, body.payload?.dateKey, body.payload?.shiftId || body.payload?.shiftKey, body.payload?.checklistPhase]]);
  const pending = inFlight.get(identity);
  if (pending) return pending;
  const operation = sendChecklistLifecycle(id, body).finally(() => inFlight.delete(identity));
  inFlight.set(identity, operation);
  return operation;
}
async function sendChecklistLifecycle(id: string | null, body: Record<string, any>) {
  const user = auth.currentUser;
  if (!user) throw Error('Sign in before saving the checklist.');
  // Store only a digest and opaque IDs; no checklist contents in browser storage.
  const identity = id ? [id, body] : ['create', body.payload?.projectId, body.payload?.unitId, body.payload?.dateKey, body.payload?.shiftId || body.payload?.shiftKey, body.payload?.deploymentType, body.payload?.checklistPhase || 'opening'];
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(identity)));
  const key = `hcad-checklist-request:${user.uid}:${Array.from(new Uint8Array(bytes)).map(v => v.toString(16).padStart(2,'0')).join('')}`;
  let request = JSON.parse(sessionStorage.getItem(key) || 'null');
  if (!request) {
    const snapshot = id ? await getDoc(doc(db, 'projectChecklists', id)) : null;
    request = { id: id || crypto.randomUUID(), requestId: crypto.randomUUID(), baseVersion: body.baseVersion ?? String(snapshot?.data()?.updatedAt?.toMillis?.() || 0) };
    sessionStorage.setItem(key, JSON.stringify(request));
  }
  const response = await fetch(`/api/checklists/${encodeURIComponent(request.id)}/lifecycle`, {
    method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, requestId: request.requestId, baseVersion: request.baseVersion }),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Checklist could not be saved.');
  sessionStorage.removeItem(key);
  return { id: request.id as string };
}
