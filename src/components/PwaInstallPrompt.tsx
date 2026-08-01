import React, { useState, useEffect } from 'react';
import { Download, Smartphone, CheckCircle, X, Share2, PlusSquare, Sparkles, Monitor } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Check if app is already running as standalone PWA
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // Check OS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(iosDevice);

    // Check if dismissed before in localStorage
    const dismissedAt = localStorage.getItem('sembako_pwa_dismissed');
    if (dismissedAt) {
      // Re-prompt after 3 days
      const days = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (days < 3) {
        setIsDismissed(true);
      }
    }

    // Catch browser beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        console.log('User accepted PWA install');
        setIsDismissed(true);
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosGuide(true);
    } else {
      // Generic browser guidance
      setShowIosGuide(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('sembako_pwa_dismissed', Date.now().toString());
  };

  // Do not render banner if already installed as standalone app or dismissed
  if (isStandalone || isDismissed) {
    return null;
  }

  return (
    <>
      {/* Floating Bottom PWA Install Banner */}
      <div className="fixed bottom-16 sm:bottom-6 right-3 left-3 sm:left-auto sm:right-6 z-40 max-w-md animate-fade-in-up">
        <div className="bg-slate-900/95 dark:bg-slate-950/95 text-white border-2 border-emerald-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-xl flex flex-col gap-3 relative overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />

          <button
            onClick={handleDismiss}
            className="absolute top-2.5 right-2.5 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Tutup Bar PWA"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 border border-amber-400/30 flex items-center justify-center shrink-0 shadow-md">
              <Smartphone className="w-6 h-6 text-amber-300" />
            </div>

            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Modus Aplikasi PWA</span>
              </div>
              <h4 className="text-sm font-bold text-white leading-tight mt-0.5">
                Install Sembako Smart AI
              </h4>
              <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                Nikmati akses cepat tanpa browser, responsif seperti aplikasi Play Store, dan dapat dipakai saat offline.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleInstallClick}
              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-amber-500 hover:from-emerald-500 hover:to-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/40 cursor-pointer transition-all active:scale-95"
            >
              <Download className="w-4 h-4 stroke-[3]" />
              <span>Install Ke Layar Utama</span>
            </button>
            <button
              onClick={handleDismiss}
              className="py-2 px-3 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer transition-colors"
            >
              Nanti
            </button>
          </div>
        </div>
      </div>

      {/* Guide Modal for iOS Safari / Unsupported standard prompt */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 max-w-sm w-full text-white space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowIosGuide(false)}
              className="absolute top-3 right-3 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Panduan Install PWA</h3>
                <p className="text-xs text-slate-400">Tambah ke Layar Utama HP Anda</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              {isIos ? (
                <>
                  <p className="font-semibold text-amber-300">
                    Untuk pengguna iPhone / iPad (Safari):
                  </p>
                  <ol className="list-decimal list-inside space-y-2">
                    <li className="flex items-start gap-2">
                      <Share2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>Ketuk tombol <strong>Bagikan (Share)</strong> di bagian bawah peramban Safari.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <PlusSquare className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>Pilih menu <strong>"Tambah ke Layar Utama" (Add to Home Screen)</strong>.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>Ketuk <strong>Tambah (Add)</strong> di pojok kanan atas.</span>
                    </li>
                  </ol>
                </>
              ) : (
                <>
                  <p className="font-semibold text-amber-300">
                    Untuk pengguna Android / Chrome / Desktop:
                  </p>
                  <ol className="list-decimal list-inside space-y-2">
                    <li className="flex items-start gap-2">
                      <Monitor className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>Buka menu titik tiga <strong>(⋮)</strong> di sudut kanan atas peramban Chrome.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Download className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>Pilih <strong>"Install Aplikasi"</strong> atau <strong>"Tambah ke Layar Utama"</strong>.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>Konfirmasi pemasangan dan ikon Sembako AI siap digunakan di HP/Laptop!</span>
                    </li>
                  </ol>
                </>
              )}
            </div>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
};
