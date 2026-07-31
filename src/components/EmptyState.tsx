import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';
import { motion } from 'motion/react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-3xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-dashed border-emerald-500/20 shadow-lg my-4"
    >
      <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500/10 to-amber-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-amber-400 mb-4 shadow-inner">
        <Icon className="w-8 h-8" />
      </div>

      <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
        {title}
      </h3>

      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
        {description}
      </p>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-800 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs font-bold shadow-lg shadow-emerald-900/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
};
