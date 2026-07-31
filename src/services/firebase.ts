import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  enableIndexedDbPersistence,
  setLogLevel,
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';

// Set Firestore log level to 'error' to avoid noisy transient connection warnings
try {
  setLogLevel('error');
} catch {
  // ignore if not supported
}

// Import Firebase Config
import config from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId,
};

// Initialize Firebase app once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore (using custom database ID if specified in config)
export const db = config.firestoreDatabaseId && config.firestoreDatabaseId !== ''
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

// Enable Firestore offline persistence (IndexedDB local cache)
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore offline persistence: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore offline persistence: Browser does not support IndexedDB');
    }
  });
}

// Auth Service Helpers
export const googleProvider = new GoogleAuthProvider();

export async function loginWithEmail(email: string, pass: string) {
  return await signInWithEmailAndPassword(auth, email, pass);
}

export async function registerWithEmail(email: string, pass: string) {
  return await createUserWithEmailAndPassword(auth, email, pass);
}

export async function loginWithGoogle() {
  return await signInWithPopup(auth, googleProvider);
}

export async function logoutUser() {
  return await signOut(auth);
}

export function subscribeAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// Firestore Collections Constants
export const COLLECTIONS = {
  PRODUCTS: 'products',
  SUPPLIERS: 'suppliers',
  TRANSACTIONS: 'transactions',
  STOCK_LOGS: 'stock_logs',
  STOCK_MOVEMENTS: 'stock_movements',
  STOCK_OPNAMES: 'stock_opnames',
  SETTINGS: 'store_settings',
  USERS: 'users',
  ACTIVATED_LICENSES: 'activated_licenses',
  DAILY_REPORTS: 'daily_email_reports',
};

export { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit 
};
