// Encrypted browser-local recovery store. The non-exportable key is scoped to
// this origin + Firebase project + account. It is not protection against XSS
// or another person with control of the device/browser profile.
type CipherRecord = { id: string; scope: string; iv: Uint8Array; cipher: ArrayBuffer };
export type LocalDraft = {
  record: Record<string, any>; baseVersion: string; mutationId: string;
  savedAt: number;
};
function openVault(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("hcad-epcr-recovery-v1", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("keys");
      request.result.createObjectStore("drafts", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("LOCAL_STORAGE_UNAVAILABLE"));
    request.onblocked = () => reject(new Error("LOCAL_STORAGE_BLOCKED"));
  });
}
async function request<T>(store: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openVault();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = operation(tx.objectStore(store));
    tx.oncomplete = () => { db.close(); resolve(req.result as T); };
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error("LOCAL_STORAGE_UNAVAILABLE")); };
  });
}
async function keyFor(scope: string): Promise<CryptoKey> {
  const existing = await request<CryptoKey | undefined>("keys", "readonly", store => store.get(scope));
  if (existing) return existing;
  const generated = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  // add (not put) prevents another tab's key from being overwritten.
  try { await request("keys", "readwrite", store => store.add(generated, scope)); return generated; }
  catch { const winner = await request<CryptoKey>("keys", "readonly", store => store.get(scope)); if (!winner) throw new Error("LOCAL_KEY_UNAVAILABLE"); return winner; }
}
export async function storeDraft(scope: string, id: string, draft: LocalDraft) {
  const key = await keyFor(scope);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(id) }, key, new TextEncoder().encode(JSON.stringify(draft)));
  await request("drafts", "readwrite", store => store.put({ id, scope, iv, cipher }));
}
export async function restoreDrafts(scope: string, prefix: string): Promise<Array<{ id: string; draft: LocalDraft }>> {
  const entries = await request<CipherRecord[]>("drafts", "readonly", store => store.getAll());
  const selected = entries.filter(entry => entry.scope === scope && entry.id.startsWith(prefix));
  if (!selected.length) return [];
  const key = await keyFor(scope);
  return Promise.all(selected.map(async entry => {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: entry.iv, additionalData: new TextEncoder().encode(entry.id) }, key, entry.cipher);
    return { id: entry.id, draft: JSON.parse(new TextDecoder().decode(plain)) as LocalDraft };
  }));
}
export async function removeDraft(id: string) { await request("drafts", "readwrite", store => store.delete(id)); }
