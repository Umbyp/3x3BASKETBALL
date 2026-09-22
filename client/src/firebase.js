import { initializeApp } from "firebase/app";
import { getDatabase }   from "firebase/database";
const cfg = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Missing/invalid VITE_FIREBASE_* env vars must not crash pages that don't
// need Firebase (TV, scoreboard core, monitor) — only Tournament sync does.
let app = null, db = null;
try {
  app = initializeApp(cfg);
  db  = getDatabase(app);
} catch (err) {
  console.warn("[firebase] disabled — missing/invalid VITE_FIREBASE_* env vars:", err.message);
}
export { db };
export default app;
