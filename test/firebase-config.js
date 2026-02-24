// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAwcSXBzanQt4v_vOaFJ_0srcExJhd2grk",
  authDomain: "okias-events.firebaseapp.com",
  projectId: "okias-events",
  storageBucket: "okias-events.firebasestorage.app",
  messagingSenderId: "35652122565",
  appId: "1:35652122565:web:af16d44360ed066baebdac"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
import { initializeApp }              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }               from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app  = initializeApp(firebaseConfig);

export const auth     = getAuth(app);
export const db       = getFirestore(app);
export const provider = new GoogleAuthProvider();
