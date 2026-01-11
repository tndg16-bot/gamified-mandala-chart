import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let adminDb: ReturnType<typeof getFirestore> | null = null;

export function getAdminDb() {
  if (adminDb) return adminDb;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");
  }
  const serviceAccount = JSON.parse(serviceAccountJson);
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount)
      });
  adminDb = getFirestore(app);
  return adminDb;
}
