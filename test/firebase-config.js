/**
 * firebase-config.js
 * Firebase SDK initialization.
 * IMPORTANT: Replace the firebaseConfig object below with YOUR project's config
 * from the Firebase Console (Project Settings → Your Apps → SDK setup).
 */

// ── PASTE YOUR FIREBASE CONFIG HERE ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "motortown-routes.firebaseapp.com",
  projectId: "motortown-routes",
  storageBucket: "motortown-routes.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp }              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }               from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app  = initializeApp(firebaseConfig);

export const auth     = getAuth(app);
export const db       = getFirestore(app);
export const provider = new GoogleAuthProvider();
