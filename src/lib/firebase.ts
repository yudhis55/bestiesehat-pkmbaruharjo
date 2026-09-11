import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// We'll try to import the config, but handle the case where it doesn't exist yet
let firebaseConfig: any;
try {
  // @ts-ignore
  import config from '../../firebase-applet-config.json';
  firebaseConfig = config;
} catch (e) {
  console.warn('Firebase config not found. Please set up Firebase in the UI.');
  // Placeholder for development
  firebaseConfig = {
    apiKey: "placeholder",
    authDomain: "placeholder",
    projectId: "placeholder",
    storageBucket: "placeholder",
    messagingSenderId: "placeholder",
    appId: "placeholder"
  };
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
