import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { auth, subscribeAuthState, loginWithEmail, registerWithEmail, loginWithGoogle, logoutUser } from '../services/firebase';
import { UserProfile } from '../types';
import { resetDatabaseToInitialState } from '../services/productService';

export interface DemoSession {
  isDemo: boolean;
  expiresAt: number; // Timestamp in milliseconds
  createdAt: number;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: typeof loginWithEmail;
  signup: typeof registerWithEmail;
  loginGoogle: typeof loginWithGoogle;
  logout: () => Promise<void>;
  demoLogin: () => boolean;
  isDemoSession: boolean;
  demoExpiresAt: number | null;
  demoTimeRemaining: string;
  resetDemoData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Demo 6-Hour Account State
  const [isDemoSession, setIsDemoSession] = useState<boolean>(false);
  const [demoExpiresAt, setDemoExpiresAt] = useState<number | null>(null);
  const [demoTimeRemaining, setDemoTimeRemaining] = useState<string>('06:00:00');

  // Load initial demo session from localStorage if exists
  useEffect(() => {
    const savedDemo = localStorage.getItem('sembako_demo_session');
    const storedExpiresAt = localStorage.getItem('sembako_demo_expires_at');

    if (storedExpiresAt && Date.now() >= parseInt(storedExpiresAt, 10)) {
      if (savedDemo) {
        handleDemoExpired();
      }
      return;
    }

    if (savedDemo) {
      try {
        const parsed: DemoSession = JSON.parse(savedDemo);
        if (parsed.isDemo && parsed.expiresAt > Date.now()) {
          const mockUser = {
            uid: 'demo-user-6h',
            email: 'demo6jam@sembakosmart.id',
            displayName: 'Haji Budi Santoso (Akun Demo 6 Jam)',
            photoURL: null,
          } as User;

          setIsDemoSession(true);
          setDemoExpiresAt(parsed.expiresAt);
          setUser(mockUser);
          setProfile({
            uid: mockUser.uid,
            email: mockUser.email,
            displayName: 'Haji Budi Santoso (Akun Demo 6 Jam)',
            photoURL: null,
            namaToko: 'Sembako Smart AI (Demo)',
            role: 'owner',
            alamatToko: 'Jl. Raya Utama No. 88, Jakarta',
            noHp: '0812-3456-7890',
          });
        } else if (parsed.isDemo && parsed.expiresAt <= Date.now()) {
          // Expired on load
          handleDemoExpired();
        }
      } catch (e) {
        console.error('Failed to parse demo session:', e);
      }
    }
  }, []);

  // 1-Second Timer Tick for Demo Account Expiration
  useEffect(() => {
    if (!isDemoSession || !demoExpiresAt) return;

    const interval = setInterval(() => {
      const diff = demoExpiresAt - Date.now();
      if (diff <= 0) {
        clearInterval(interval);
        handleDemoExpired();
      } else {
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setDemoTimeRemaining(
          `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isDemoSession, demoExpiresAt]);

  useEffect(() => {
    const unsubscribe = subscribeAuthState((currentUser) => {
      if (!isDemoSession) {
        setUser(currentUser);
        if (currentUser) {
          setProfile({
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName || 'Pemilik Toko Sembako',
            photoURL: currentUser.photoURL,
            namaToko: 'TOKO SEMBAKO SAYA',
            role: 'owner',
            alamatToko: '',
            noHp: '',
          });
        } else {
          setProfile(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isDemoSession]);

  const demoLogin = (): boolean => {
    const now = Date.now();
    // Always start a fresh 6-Hour demo session when user clicks Demo button
    const expiresAt = now + 6 * 60 * 60 * 1000;
    localStorage.setItem('sembako_demo_expires_at', expiresAt.toString());

    setLoading(true);

    const session: DemoSession = {
      isDemo: true,
      expiresAt,
      createdAt: now,
    };

    localStorage.setItem('sembako_demo_session', JSON.stringify(session));

    const mockUser = {
      uid: 'demo-user-6h',
      email: 'demo6jam@sembakosmart.id',
      displayName: 'Haji Budi Santoso (Akun Demo 6 Jam)',
      photoURL: null,
    } as User;

    setIsDemoSession(true);
    setDemoExpiresAt(expiresAt);

    setUser(mockUser);
    setProfile({
      uid: mockUser.uid,
      email: mockUser.email,
      displayName: 'Haji Budi Santoso (Akun Demo 6 Jam)',
      photoURL: null,
      namaToko: 'Sembako Smart AI (Demo)',
      role: 'owner',
      alamatToko: 'Jl. Raya Utama No. 88, Jakarta',
      noHp: '0812-3456-7890',
    });

    setLoading(false);
    return true;
  };

  const handleDemoExpired = async () => {
    localStorage.removeItem('sembako_demo_session');
    // Keep sembako_demo_expires_at so they cannot re-enter demo on this device
    setIsDemoSession(false);
    setDemoExpiresAt(null);
    setUser(null);
    setProfile(null);
    await resetDatabaseToInitialState();
    alert('⏰ Sesi Akun Demo 6 Jam Telah Berakhir!\n\nSemua data transaksi, stok, dan pengaturan yang Anda masukkan dalam mode demo telah otomatis di-reset kembali kosong/awal. Silakan aktivasi License Key resmi untuk membuka akses seumur hidup.');
    window.location.reload();
  };

  const resetDemoData = async () => {
    setLoading(true);
    await resetDatabaseToInitialState();
    localStorage.removeItem('sembako_demo_session');
    setIsDemoSession(false);
    setDemoExpiresAt(null);
    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  const handleLogout = async () => {
    if (isDemoSession) {
      localStorage.removeItem('sembako_demo_session');
      setIsDemoSession(false);
      setDemoExpiresAt(null);
      setUser(null);
      setProfile(null);
    } else {
      await logoutUser();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        login: loginWithEmail,
        signup: registerWithEmail,
        loginGoogle: loginWithGoogle,
        logout: handleLogout,
        demoLogin,
        isDemoSession,
        demoExpiresAt,
        demoTimeRemaining,
        resetDemoData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

