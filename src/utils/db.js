import { openDB } from 'idb';

const DB_NAME = 'lucidlens-db';
const STORE_NAME = 'dreams';
const DB_VERSION = 1;

// Initialize the database
async function initDB() {
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create a "store" (like a table) for our dream images
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
  return db;
}

// Function to save an image to the database
export async function saveImage(key, value) {
  const db = await initDB();
  return db.put(STORE_NAME, value, key);
}

// Function to get an image from the database
export async function getImage(key) {
  const db = await initDB();
  return db.get(STORE_NAME, key);
}
