import React from 'react';
import { Sparkles } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  label?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  fullScreen = false,
  label = 'Memuat Sembako Smart AI...',
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-16 h-16 border-4',
  };

  const spinnerContent = (
    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="relative flex items-center justify-center">
        {/* Outer Glow Ring */}
        <div
          className={`${sizeClasses[size]} rounded-full border-emerald-500/20 border-t-amber-400 border-r-emerald-500 animate-spin shadow-[0_0_20px_rgba(16,185,129,0.3)]`}
        />
        {/* Inner Gold Sparkle */}
        <Sparkles className="w-5 h-5 text-amber-400 absolute animate-pulse" />
      </div>

      {label && (
        <p className="text-xs font-medium tracking-wide text-emerald-800 dark:text-emerald-300 animate-pulse">
          {label}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md">
        <div className="bg-white/90 dark:bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-8 shadow-2xl backdrop-blur-xl max-w-xs w-full">
          {spinnerContent}
        </div>
      </div>
    );
  }

  return spinnerContent;
};
