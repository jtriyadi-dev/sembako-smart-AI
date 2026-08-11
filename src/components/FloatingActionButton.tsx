import React, { useState } from 'react';
import { PageId } from '../types';
import { Plus, ShoppingCart, PackagePlus, Sparkles, X, Boxes } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FABProps {
  onNavigate: (page: PageId) => void;
}

export const FloatingActionButton: React.FC<FABProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleFab = () => setIsOpen(!isOpen);

  const handleAction = (page: PageId) => {
    setIsOpen(false);
    onNavigate(page);
  };

  return (
    <>
      {/* Dim Backdrop when Floating Menu is expanded on Mobile/Tablet */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-40 transition-opacity"
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-24 md:bottom-8 right-5 z-50 flex flex-col items-end select-none">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="flex flex-col gap-3 mb-3 items-end"
            >
              {/* Action 1: Quick POS */}
              <button
                onClick={() => handleAction('kasir')}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-emerald-500/30 shadow-2xl hover:scale-105 active:scale-95 transition-all group cursor-pointer touch-target"
              >
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-amber-300">
                  Kasir Cepat (POS)
                </span>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-700 to-emerald-500 flex items-center justify-center text-amber-300 shadow-md">
                  <ShoppingCart className="w-5 h-5" />
                </div>
              </button>

              {/* Action 2: Kelola Produk */}
              <button
                onClick={() => handleAction('produk')}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-emerald-500/30 shadow-2xl hover:scale-105 active:scale-95 transition-all group cursor-pointer touch-target"
              >
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-amber-300">
                  Kelola Produk
                </span>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-700 to-emerald-500 flex items-center justify-center text-amber-300 shadow-md">
                  <PackagePlus className="w-5 h-5" />
                </div>
              </button>

              {/* Action 3: Opname Stok */}
              <button
                onClick={() => handleAction('stok')}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-emerald-500/30 shadow-2xl hover:scale-105 active:scale-95 transition-all group cursor-pointer touch-target"
              >
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-amber-300">
                  Opname Stok Sembako
                </span>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-700 to-emerald-500 flex items-center justify-center text-amber-300 shadow-md">
                  <Boxes className="w-5 h-5" />
                </div>
              </button>

              {/* Action 4: Smart AI Assistant */}
              <button
                onClick={() => handleAction('ai-assistant')}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-amber-700 text-white border border-amber-400/40 shadow-2xl hover:scale-105 active:scale-95 transition-all group cursor-pointer touch-target"
              >
                <span className="text-xs font-bold text-amber-200">
                  Tanya AI Assistant
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center text-slate-950 shadow-md">
                  <Sparkles className="w-5 h-5" />
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Trigger Button */}
        <button
          onClick={toggleFab}
          className={`w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-700 via-emerald-600 to-amber-500 text-slate-950 font-bold flex items-center justify-center shadow-2xl shadow-emerald-950/50 hover:scale-105 active:scale-90 transition-all duration-300 border border-amber-300/40 cursor-pointer ${
            isOpen ? 'rotate-45 bg-rose-600 text-white' : ''
          }`}
          title="Floating Menu Aksi Cepat"
        >
          {isOpen ? <X className="w-6 h-6 text-white" /> : <Plus className="w-7 h-7 text-amber-300" />}
        </button>
      </div>
    </>
  );
};

