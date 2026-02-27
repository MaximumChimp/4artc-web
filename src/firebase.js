import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database"; // 1. Import RTDB module

const firebaseConfig = {
  apiKey: "AIzaSyCxOi-Hgi9acrBVyK_AgJ44uXcpNI9PsoE",
  authDomain: "hexdb-34588.firebaseapp.com",
  projectId: "hexdb-34588",
  storageBucket: "hexdb-34588.firebasestorage.app",
  messagingSenderId: "489457312003",
  appId: "1:489457312003:web:0a770e8824242414170936",
  // 2. Add your RTDB URL here
  databaseURL: "https://hexdb-34588-default-rtdb.asia-southeast1.firebasedatabase.app/" 
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app); // 3. Initialize and export RTDB