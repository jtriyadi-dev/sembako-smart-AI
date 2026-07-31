import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useStore } from '../context/StoreContext';
import { PageId } from '../types';
import { EditStoreModal } from './EditStoreModal';
import { LicenseModal } from './LicenseModal';
import { Sun, Moon, Bell, Store, Sparkles, User as UserIcon, LogOut, HelpCircle, BookOpen, Edit3, KeyRound, Award, Wifi, WifiOff, Clock, RotateCcw, ShieldAlert, Globe } from 'lucide-react';

interface HeaderProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  onOpenDoc?: () => void;
  onOpenOnboarding?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onNavigate, onOpenDoc, onOpenOnboarding }) => {
  const { theme, toggleTheme } = useTheme();
  const { profile, user, logout, isDemoSession, demoTimeRemaining, resetDemoData } = useAuth();
  const { info, success, warning } = useToast();
  const { storeConfig, licenseInfo } = useStore();

  const [isEditStoreOpen, setIsEditStoreOpen] = useState(false);
  const [isLicenseOpen, setIsLicenseOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isResetting, setIsResetting] = useState(false);

  const handleManualResetDemo = async () => {
    if (confirm('Apakah Anda yakin ingin mereset semua data demo sekarang?\n\nSemua produk, transaksi, dan histori yang diinput akan dikosongkan/dikembalikan ke awal.')) {
      setIsResetting(true);
      try {
        await resetDemoData();
        success('Reset Data Demo Berhasil', 'Semua data telah di-reset ke kondisi awal.');
        window.location.reload();
      } catch (e: any) {
        warning('Gagal Reset', e.message);
      } finally {
        setIsResetting(false);
      }
    }
  };


  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      success('Koneksi Terhubung', 'Aplikasi kembali online. Data otomatis tersinkron ke cloud.');
    };
    const handleOffline = () => {
      setIsOnline(false);
      info('Mode Offline Aktif', 'Koneksi terputus. Data disimpan di memori lokal browser (IndexedDB).');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleNotificationClick = () => {
    info('Notifikasi Toko', 'Stok Berkas Sania 5kg menipis (Sisa 3 sak).');
  };

  const handleLogout = async () => {
    await logout();
    success('Berhasil Keluar', 'Sampai jumpa kembali di Sembako Smart AI.');
    onNavigate('landing');
  };

  return (
    <>
      <header className="sticky top-0 z-30 w-full backdrop-blur-xl bg-white/90 dark:bg-slate-950/90 border-b border-emerald-900/10 dark:border-emerald-500/20 transition-colors duration-300">
        <div className="w-full px-3 sm:px-6 lg:px-8 py-2 sm:py-0 min-h-[4.5rem] sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Left: Store Branding with LARGE STORE NAME & UPLOADED LOGO */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div
              className="relative group cursor-pointer shrink-0"
              onClick={() => setIsEditStoreOpen(true)}
              title="Klik untuk ubah identitas & foto logo toko"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-emerald-700 via-emerald-600 to-amber-500 p-0.5 shadow-lg shadow-emerald-900/20 group-hover:scale-105 transition-transform overflow-hidden">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center overflow-hidden">
                  {storeConfig.logoUrl ? (
                    <img
                      src={storeConfig.logoUrl}
                      alt={storeConfig.namaToko}
                      className="w-full h-full object-cover rounded-[14px]"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Store className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                  )}
                </div>
              </div>
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 sm:h-3 sm:w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-amber-500"></span>
              </span>
            </div>

            <div className="flex flex-col justify-center min-w-0">
              {/* LARGE STORE NAME */}
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <h1
                  onClick={() => setIsEditStoreOpen(true)}
                  className="text-sm xs:text-base sm:text-lg md:text-xl lg:text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white cursor-pointer hover:text-emerald-600 dark:hover:text-amber-400 transition-colors flex items-center gap-1.5 truncate max-w-[130px] xs:max-w-[180px] sm:max-w-[280px] md:max-w-[380px] lg:max-w-none"
                  title={storeConfig.namaToko || 'TOKO SEMBAKO BERKAH SMART'}
                >
                  <span className="truncate">{storeConfig.namaToko || 'TOKO SEMBAKO BERKAH SMART'}</span>
                  <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 hover:text-emerald-500 shrink-0" />
                </h1>
              </div>

              {/* Subtitle SaaS & License Status Badge */}
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                <span className="hidden sm:flex text-[10px] sm:text-[11px] font-bold text-emerald-700 dark:text-amber-400 items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Sembako POS Pro</span>
                </span>
                
                {!isDemoSession && (
                  <button
                    type="button"
                    onClick={() => setIsLicenseOpen(true)}
                    className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer"
                  >
                    <Award className="w-3 h-3 text-amber-400" />
                    <span>{licenseInfo.isActivated ? 'LISENSI PRO AKTIF' : 'AKTIVASI LISENSI'}</span>
                  </button>
                )}

                {/* Online / Offline Status Badge */}
                <span
                  className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider border transition-all ${
                    isOnline
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40 animate-pulse'
                  }`}
                  title={isOnline ? 'Terhubung Cloud Firestore' : 'Mode Offline - Cache Lokal'}
                >
                  {isOnline ? (
                    <>
                      <Wifi className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-500" />
                      <span className="hidden xs:inline">Online</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500" />
                      <span>Offline</span>
                    </>
                  )}
                </span>

                {/* 6-Hour Demo Session Countdown & Reset Badge */}
                {isDemoSession && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 border border-amber-500/40 text-amber-800 dark:text-amber-300 font-mono text-[9px] sm:text-[10px] font-black">
                    <Clock className="w-3 h-3 text-amber-500 animate-spin" style={{ animationDuration: '4s' }} />
                    <span title="Sisa Waktu Akun Demo 6 Jam">DEMO {demoTimeRemaining}</span>
                    <button
                      type="button"
                      onClick={handleManualResetDemo}
                      disabled={isResetting}
                      className="ml-0.5 px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-sans font-extrabold text-[9px] hover:bg-amber-400 cursor-pointer flex items-center gap-0.5"
                      title="Reset semua data transaksi & stok demo sekarang"
                    >
                      <RotateCcw className={`w-2.5 h-2.5 ${isResetting ? 'animate-spin' : ''}`} />
                      <span className="hidden xs:inline">Reset</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">

          {/* Notification Bell */}
          <button
            onClick={handleNotificationClick}
            className="relative p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/30 transition-all shadow-sm cursor-pointer"
            title="Notifikasi"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-2 h-2 rounded-full bg-rose-500" />
          </button>

          {/* Theme Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 text-amber-500 dark:text-amber-400 hover:border-amber-500/40 transition-all shadow-sm cursor-pointer"
            title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* User Profile / Auth Status */}
          {user || profile ? (
            <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-slate-200 dark:border-slate-800">
              <button
                onClick={() => onNavigate('setting')}
                className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                title="Setting Profil"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-800 text-amber-300 font-bold flex items-center justify-center text-xs shadow-inner shrink-0">
                  {profile?.displayName?.charAt(0) || 'P'}
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight truncate max-w-[100px]">
                    {profile?.displayName}
                  </span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    Owner
                  </span>
                </div>
              </button>

              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors rounded-lg cursor-pointer"
                title="Keluar"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onNavigate('login')}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-medium text-xs shadow-md shadow-emerald-900/20 transition-all cursor-pointer"
            >
              <UserIcon className="w-3.5 h-3.5 text-amber-300" />
              <span>Masuk</span>
            </button>
          )}

        </div>

      </div>
    </header>

    {/* Edit Store Modal */}
    <EditStoreModal isOpen={isEditStoreOpen} onClose={() => setIsEditStoreOpen(false)} />

    {/* License Modal */}
    {!isDemoSession && <LicenseModal isOpen={isLicenseOpen} onClose={() => setIsLicenseOpen(false)} />}
    </>
  );
};
