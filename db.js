// db.js — IndexedDB access layer for Scoreyard.
// Two object stores: "profile" (single keyed record) and "scores" (run history).
// Self-contained; the connection promise is memoized for the page lifetime.
import { DB_NAME, DB_VERSION } from "./config.js";

let dbPromise;

export function openDb() {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("profile")) {
        db.createObjectStore("profile", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("scores")) {
        const scoreStore = db.createObjectStore("scores", { keyPath: "id" });
        scoreStore.createIndex("createdAt", "createdAt");
        scoreStore.createIndex("playerEmail", "playerEmail");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export async function getStore(storeName, mode, callback) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = callback(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

export function makeId() {
  if (crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
