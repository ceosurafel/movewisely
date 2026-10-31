import { CheckupAnalysis } from '../types/chess';

export interface SavedCheckup {
  id: string;
  savedAt: string;
  analysis: CheckupAnalysis;
}
const DB_NAME = 'movewisely-history';
const STORE = 'checkups';
const openDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
export async function saveCheckup(analysis: CheckupAnalysis): Promise<void> {
  if (typeof indexedDB === 'undefined') throw new Error('Browser storage is unavailable');
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ id: [analysis.platform, analysis.timeControl, analysis.username.toLowerCase(), analysis.analyzedAt].join(':'), savedAt: new Date().toISOString(), analysis } satisfies SavedCheckup);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}
export async function loadCheckups(): Promise<SavedCheckup[]> {
  if (typeof indexedDB === 'undefined') return [];
  const db = await openDb();
  const rows = await new Promise<SavedCheckup[]>((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as SavedCheckup[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows.sort((a,b) => b.savedAt.localeCompare(a.savedAt));
}
export async function deleteCheckup(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve,reject) => {
    const tx=db.transaction(STORE,'readwrite'); tx.objectStore(STORE).delete(id);
    tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error);
  });
  db.close();
}
