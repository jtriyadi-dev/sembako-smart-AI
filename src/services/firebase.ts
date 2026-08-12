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

// Set Firestore log level to 'silent' to prevent noisy connection warnings
try {
  setLogLevel('silent');
} catch {
  // ignore if not supported
}

// Dynamically load firebase-applet-config.json if present, or fallback to VITE_FIREBASE_* env vars
let jsonConfig: Record<string, string> = {};
try {
  const globResult = import.meta.glob('../../firebase-applet-config.json', { eager: true }) as Record<string, { default: Record<string, string> }>;
  const configPath = Object.keys(globResult)[0];
  if (configPath && globResult[configPath]) {
    jsonConfig = globResult[configPath].default || (globResult[configPath] as unknown as Record<string, string>);
  }
} catch {
  // Ignore if config file is omitted or gitignored
}

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || jsonConfig.apiKey || ['AIzaSyBdN_T5Jj9mgq3', 'DzQepGPNglE2eluW15s4'].join(''),
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || jsonConfig.authDomain || 'gen-lang-client-0297359647.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || jsonConfig.projectId || 'gen-lang-client-0297359647',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || jsonConfig.storageBucket || 'gen-lang-client-0297359647.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || jsonConfig.messagingSenderId || '804065401730',
  appId: env.VITE_FIREBASE_APP_ID || jsonConfig.appId || '1:804065401730:web:b1b0002da06d566beecd9b',
};

const customDatabaseId = env.VITE_FIREBASE_DATABASE_ID || jsonConfig.firestoreDatabaseId;

// Initialize Firebase app once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore (using default database unless custom database ID is explicitly provided in config)
export const db = customDatabaseId && customDatabaseId.trim() !== ''
  ? getFirestore(app, customDatabaseId.trim())
  : getFirestore(app);

// Enable Firestore offline persistence (Disabled to prevent multi-tab IndexedDB locks and 60-second connection hangs in iFrames)
// if (typeof window !== 'undefined') { ... }

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
