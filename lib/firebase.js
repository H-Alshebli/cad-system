import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDrQQXCJ0rYiB2HteqhNoLqmmvEUZopj3A",
  authDomain: "lazem-dispatch.firebaseapp.com",
  projectId: "lazem-dispatch",
  storageBucket: "lazem-dispatch.firebasestorage.app",
  messagingSenderId: "963830088162",
  appId: "1:963830088162:web:e0ad2e728b1e0a94d5f9bb",
  measurementId: "G-0P71Y4Z5FK"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
