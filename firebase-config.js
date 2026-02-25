import { initializeApp }               from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }                from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyAwcSXBzanQt4v_vOaFJ_0srcExJhd2grk",
  authDomain:        "okias-events.firebaseapp.com",
  projectId:         "okias-events",
  storageBucket:     "okias-events.firebasestorage.app",
  messagingSenderId: "35652122565",
  appId:             "1:35652122565:web:af16d44360ed066baebdac"
};

const app = initializeApp(firebaseConfig);

export const auth     = getAuth(app);
export const db       = getFirestore(app);
export const provider = new GoogleAuthProvider();