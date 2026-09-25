/**
 * Firebase Admin SDK — trusted server-side access to Realtime Database.
 * Used for:
 *  - court_live/{courtId}: persisting live game state so a restart doesn't
 *    wipe every in-progress game (see server.js's load/save wiring)
 *  - tournament_data/{division}: structural writes (teams, delayMinutes,
 *    regenerate) that the Firebase Security Rules deny to plain clients
 *
 * Gracefully disabled (db === null) if the 4 required env vars aren't set,
 * same pattern as client/src/firebase.js — the app keeps working with
 * in-memory-only state and no admin API in that case.
 */
import admin from "firebase-admin";

const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_DATABASE_URL } = process.env;

let db = null;
if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY && FIREBASE_DATABASE_URL) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        // Render (and most PaaS env var UIs) turn real newlines into the
        // literal two-character sequence "\n" — undo that here.
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
      databaseURL: FIREBASE_DATABASE_URL,
    });
    db = admin.database();
    console.log("[firebase-admin] connected — court persistence + tournament admin API enabled");
  } catch (err) {
    console.warn("[firebase-admin] init failed, persistence disabled:", err.message);
  }
} else {
  console.warn("[firebase-admin] FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY/FIREBASE_DATABASE_URL not set — court persistence + tournament admin API disabled (in-memory only)");
}

export { db };

export async function loadCourtState(courtId) {
  if (!db) return null;
  try {
    const snap = await db.ref(`court_live/${courtId}`).get();
    return snap.exists() ? snap.val() : null;
  } catch (err) {
    console.warn(`[firebase-admin] load court_live/${courtId} failed:`, err.message);
    return null;
  }
}

export async function saveCourtState(courtId, state) {
  if (!db) return;
  try {
    await db.ref(`court_live/${courtId}`).set(state);
  } catch (err) {
    console.warn(`[firebase-admin] save court_live/${courtId} failed:`, err.message);
  }
}
