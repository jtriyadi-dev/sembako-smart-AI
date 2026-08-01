import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import { PageId } from './types';

// Global Layout Components
import { Header } from './components/Header';
import { SidebarDesktop } from './components/SidebarDesktop';
import { BottomNavMobile } from './components/BottomNavMobile';
import { FloatingActionButton } from './components/FloatingActionButton';
import { ToastContainer } from './components/ToastContainer';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OnboardingModal } from './components/OnboardingModal';
import { DocumentationModal } from './components/DocumentationModal';
import { LicenseActivationGate } from './components/LicenseActivationGate';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { useStore } from './context/StoreContext';

// Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProdukPage } from './pages/ProdukPage';
import { StokPage } from './pages/StokPage';
import { SupplierPage } from './pages/SupplierPage';
import { KasirPage } from './pages/KasirPage';
import { TransaksiPage } from './pages/TransaksiPage';
import { LaporanPage } from './pages/LaporanPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { SettingPage } from './pages/SettingPage';

import { motion, AnimatePresence } from 'motion/react';

const MainAppContent: React.FC = () => {
  const { user, profile, loading, isDemoSession } = useAuth();
  const { licenseInfo } = useStore();
  const [currentPage, setCurrentPage] = useState<PageId>('landing');

  // Modal States
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isDocOpen, setIsDocOpen] = useState(false);

  // Check if first-time visitor
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('sembako_onboarding_seen');
    if (!hasSeenOnboarding) {
      setIsOnboardingOpen(true);
      localStorage.setItem('sembako_onboarding_seen', 'true');
    }
  }, []);

  if (loading) {
    return <LoadingSpinner fullScreen label="Memuat Sembako Smart AI..." />;
  }

  // 1. Landing Page
  if (currentPage === 'landing') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
        <ToastContainer />
        <LandingPage onNavigate={setCurrentPage} />
      </div>
    );
  }

  // 2. Login Page
  if (currentPage === 'login') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex items-center justify-center p-4">
        <ToastContainer />
        <LoginPage onNavigate={setCurrentPage} />
      </div>
    );
  }

  // 3. Menu Aktivasi Lisensi (For new users with unactivated license)
  const isActivated = licenseInfo.isActivated || isDemoSession;
  if (currentPage === 'activation' || !isActivated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white font-sans">
        <ToastContainer />
        <LicenseActivationGate
          onNavigate={setCurrentPage}
          onActivateSuccess={() => setCurrentPage('dashboard')}
        />
      </div>
    );
  }

  // 4. Main Application (Aplikasi - Dashboard, Kasir, Produk, Stok, etc.)
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage onNavigate={setCurrentPage} />;
      case 'produk':
        return <ProdukPage />;
      case 'stok':
        return <StokPage />;
      case 'supplier':
        return <SupplierPage />;
      case 'kasir':
        return <KasirPage />;
      case 'transaksi':
        return <TransaksiPage />;
      case 'laporan':
        return <LaporanPage />;
      case 'ai-assistant':
        return <AIAssistantPage />;
      case 'setting':
        return <SettingPage />;
      default:
        return <DashboardPage onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-[#061a14] text-slate-900 dark:text-slate-100 transition-colors duration-300 font-sans">
      <ToastContainer />

      {/* Sticky Top Header */}
      <Header
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onOpenDoc={() => setIsDocOpen(true)}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <SidebarDesktop currentPage={currentPage} onNavigate={setCurrentPage} />

        {/* Main Content Stage */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 md:pb-12 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPage}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {renderPage()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Global Modals */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onStartKasir={() => setCurrentPage('kasir')}
      />

      <DocumentationModal
        isOpen={isDocOpen}
        onClose={() => setIsDocOpen(false)}
      />

      {/* Floating Action Button */}
      <FloatingActionButton onNavigate={setCurrentPage} />

      {/* Native Mobile Bottom Navigation */}
      <BottomNavMobile currentPage={currentPage} onNavigate={setCurrentPage} />

      {/* PWA Install Prompt Banner */}
      <PwaInstallPrompt />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <StoreProvider>
              <MainAppContent />
            </StoreProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

