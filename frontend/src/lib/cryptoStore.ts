const DB_NAME = 'hac-gradebook';
const STORE = 'keys';
const KEY_ID = 'aes-gcm';
const STORAGE_KEY = 'hac.savedLogin.v1';

export type SavedLogin = {
  portalUrl: string;
  username: string;
  password: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadOrCreateKey(): Promise<CryptoKey> {
  const db = await openDb();
  const existing = await idbRequest<CryptoKey | undefined>(
    db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY_ID),
  );
  if (existing) return existing;

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  await idbRequest(db.transaction(STORE, 'readwrite').objectStore(STORE).put(key, KEY_ID));
  return key;
}

let keyPromise: Promise<CryptoKey> | null = null;

function getKey() {
  keyPromise ??= loadOrCreateKey();
  return keyPromise;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function saveLogin(login: SavedLogin): Promise<void> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(login));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(cipher)),
  }));
}

export async function loadLogin(): Promise<SavedLogin | null> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as { iv: string; ciphertext: string };
    const key = await getKey();
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(stored.iv) },
      key,
      base64ToBytes(stored.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(plain)) as SavedLogin;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearLogin(): void {
  localStorage.removeItem(STORAGE_KEY);
}
