/**
 * firebase-config.js
 * Firebase SDK initialization.
 * IMPORTANT: Replace the firebaseConfig object below with YOUR project's config
 * from the Firebase Console (Project Settings → Your Apps → SDK setup).
 */

// ── PASTE YOUR FIREBASE CONFIG HERE ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAwcSXBzanQt4v_vOaFJ_0srcExJhd2grk",
  authDomain: "okias-events.firebaseapp.com",
  projectId: "okias-events",
  storageBucket: "okias-events.firebasestorage.app",
  messagingSenderId: "35652122565",
  appId: "1:35652122565:web:af16d44360ed066baebdac"
};
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp }              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }               from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app  = initializeApp(firebaseConfig);

export const auth     = getAuth(app);
export const db       = getFirestore(app);
export const provider = new GoogleAuthProvider();
