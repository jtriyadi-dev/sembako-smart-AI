import React, { useState, useEffect } from 'react';
import { PageId } from '../types';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { getAccentTheme } from '../utils/themeUtils';
import {
  LayoutDashboard,
  Package,
  Boxes,
  Building2,
  ShoppingCart,
  Receipt,
  BarChart3,
  Sparkles,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Globe,
  Sliders,
} from 'lucide-react';

interface SidebarDesktopProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

export const SidebarDesktop: React.FC<SidebarDesktopProps> = ({ currentPage, onNavigate }) => {
  const { storeConfig } = useStore();
  const { profile } = useAuth();
  const accent = getAccentTheme(storeConfig.accentColor);
  const [collapsed, setCollapsed] = useState(false);

  const isDeveloper =
    profile?.role === 'developer' ||
    (typeof window !== 'undefined' && localStorage.getItem('sembako_developer_auth_session') === 'true');

  // Auto-collapse sidebar on tablet screen sizes (< 1024px) for optimal content width
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setCollapsed(true);
      } else {
        setCollapsed(false);
      }
    };

    handleResize(); // run on initial mount
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navItems = [
    { id: 'dashboard' as PageId, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'produk' as PageId, label: 'Produk', icon: Package },
    { id: 'stok' as PageId, label: 'Stok', icon: Boxes },
    { id: 'supplier' as PageId, label: 'Supplier', icon: Building2 },
    { id: 'kasir' as PageId, label: 'Kasir (POS)', icon: ShoppingCart, badge: 'Quick' },
    { id: 'transaksi' as PageId, label: 'Transaksi', icon: Receipt },
    { id: 'laporan' as PageId, label: 'Laporan', icon: BarChart3 },
    { id: 'ai-assistant' as PageId, label: 'AI Assistant', icon: Sparkles, isAi: true },
    { id: 'setting' as PageId, label: 'Setting', icon: Settings },
    ...(isDeveloper
      ? [{ id: 'control-panel' as PageId, label: 'Control Panel', icon: Sliders, badge: 'Dev' }]
      : []),
  ];

  return (
    <aside
      className={`hidden md:flex flex-col border-r border-emerald-900/10 dark:border-emerald-500/15 bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl transition-all duration-300 relative z-20 shrink-0 select-none ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Collapse Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3.5 top-20 w-8 h-8 rounded-full bg-white dark:bg-slate-900 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform cursor-pointer z-30"
        title={collapsed ? 'Perluas Sidebar' : 'Ciutkan Sidebar'}
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Nav items container */}
      <div className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-200 group relative active:scale-98 cursor-pointer ${
                isActive
                  ? `bg-gradient-to-r ${accent.gradient} text-white shadow-lg shadow-emerald-900/25 border border-white/20`
                  : 'text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-emerald-900/40 text-amber-300'
                    : 'text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-amber-400'
                }`}
              >
                <Icon className={`w-5 h-5 ${item.isAi ? 'text-amber-400 animate-pulse' : ''}`} />
              </div>

              {!collapsed && (
                <span className="truncate flex-1 text-left tracking-tight">
                  {item.label}
                </span>
              )}

              {!collapsed && item.badge && (
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                  {item.badge}
                </span>
              )}

              {/* Active gold dot accent */}
              {isActive && (
                <span className="absolute right-2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Info Box */}
      {!collapsed && (
        <div className="p-4 m-3 rounded-2xl bg-gradient-to-br from-emerald-950/90 to-slate-900 text-slate-200 border border-emerald-500/20 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-300 tracking-wide uppercase">
              Sistem Siap
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Pondasi database & AI terintegrasi dengan Firebase & Smart AI.
          </p>
        </div>
      )}
    </aside>
  );
};

