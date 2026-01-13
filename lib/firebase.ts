import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyCbskxKb3UskTJq6azhLucOMxKoclonl6M",
  authDomain: "pad-buddy--rice.firebaseapp.com",
  projectId: "pad-buddy--rice",
  storageBucket: "pad-buddy--rice.firebasestorage.app",
  messagingSenderId: "980749556603",
  appId: "1:980749556603:web:4f69268837bd195b72fbde",
  measurementId: "G-ZX90D3HN6D"
};

// Initialize Firebase (avoid duplicate initialization)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);
const database = getDatabase(app);
const functions = getFunctions(app);

// Set auth persistence to LOCAL for PWA support
// This ensures auth state persists even when app is closed
if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("Auth persistence error:", error);
  });
}

// Analytics is only available in the browser
let analytics: Analytics | null = null;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

// Messaging (FCM) is only available in the browser
let messaging: Messaging | null = null;
if (typeof window !== "undefined" && 'serviceWorker' in navigator) {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.warn('Firebase Messaging initialization failed:', error);
  }
}

export { app, auth, db, database, functions, analytics, messaging };
// Alias for compatibility with code expecting 'firestore' export
export const firestore = db;
