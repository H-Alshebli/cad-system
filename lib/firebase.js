// lib/firebase.js
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDrQQXCJQYr8i2BHteqhNoLqmmvEUZopj3A",
  authDomain: "lazem-dispatch.firebaseapp.com",
  projectId: "lazem-dispatch",
  storageBucket: "lazem-dispatch.firebasestorage.app",
  messagingSenderId: "963830880162",
  appId: "1:963830880162:web:e0ad2e728b1e0a94d5f9bb",
  measurementId: "G-07P1Y4Z5FK"
};

// Prevent reinitializing Firebase
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Export Firestore only
export const db = getFirestore(app);
