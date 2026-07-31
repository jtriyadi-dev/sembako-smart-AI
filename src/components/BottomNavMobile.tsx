import React from 'react';
import { PageId } from '../types';
import { useStore } from '../context/StoreContext';
import { getAccentTheme } from '../utils/themeUtils';
import { LayoutDashboard, ShoppingCart, Package, Receipt, Sparkles } from 'lucide-react';

interface BottomNavMobileProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

export const BottomNavMobile: React.FC<BottomNavMobileProps> = ({ currentPage, onNavigate }) => {
  const { storeConfig } = useStore();
  const accent = getAccentTheme(storeConfig.accentColor);
  const navItems = [
    { id: 'dashboard' as PageId, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'produk' as PageId, label: 'Produk', icon: Package },
    { id: 'kasir' as PageId, label: 'Kasir', icon: ShoppingCart, isPrimary: true },
    { id: 'transaksi' as PageId, label: 'Transaksi', icon: Receipt },
    { id: 'ai-assistant' as PageId, label: 'AI Assistant', icon: Sparkles },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-2xl bg-white/95 dark:bg-slate-950/95 border-t border-emerald-900/10 dark:border-emerald-500/20 px-3 pt-2 pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.15)] select-none">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          if (item.isPrimary) {
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="flex flex-col items-center relative -top-5 group active:scale-95 transition-transform cursor-pointer"
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all ${
                    isActive
                      ? `bg-gradient-to-tr ${accent.gradient} text-white ring-4 ${accent.ring} scale-105`
                      : `bg-gradient-to-tr ${accent.gradient} text-white/90 ring-2 ring-amber-400/40 opacity-90`
                  }`}
                >
                  <Icon className="w-7 h-7" />
                </div>
                <span className="text-[11px] font-black tracking-tight text-emerald-800 dark:text-emerald-300 mt-1">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] px-2 py-1 rounded-2xl transition-all relative active:scale-90 cursor-pointer ${
                isActive
                  ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 font-medium'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive
                      ? 'text-emerald-600 dark:text-amber-400 scale-110'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                />
                {isActive && (
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-1 truncate max-w-[64px]">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

