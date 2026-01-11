import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

let adminDb: ReturnType<typeof getFirestore> | null = null;
let adminMessaging: ReturnType<typeof getMessaging> | null = null;

function getAdminApp() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");
  }
  const serviceAccount = JSON.parse(serviceAccountJson);
  return getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount)
      });
}

export function getAdminDb() {
  if (adminDb) return adminDb;
  const app = getAdminApp();
  adminDb = getFirestore(app);
  return adminDb;
}

export function getAdminMessaging() {
  if (adminMessaging) return adminMessaging;
  const app = getAdminApp();
  adminMessaging = getMessaging(app);
  return adminMessaging;
}
