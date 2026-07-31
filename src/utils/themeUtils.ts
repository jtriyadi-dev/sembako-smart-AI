export type AccentColor = 'emerald' | 'amber' | 'indigo' | 'rose' | 'teal';

export interface AccentThemeClasses {
  btnBg: string;
  btnHover: string;
  text: string;
  textDark: string;
  bgLight: string;
  border: string;
  borderDark: string;
  ring: string;
  badge: string;
  gradient: string;
  activeTab: string;
}

export const ACCENT_THEMES: Record<AccentColor, AccentThemeClasses> = {
  emerald: {
    btnBg: 'bg-emerald-600',
    btnHover: 'hover:bg-emerald-700',
    text: 'text-emerald-600',
    textDark: 'dark:text-emerald-400',
    bgLight: 'bg-emerald-500/10',
    border: 'border-emerald-500',
    borderDark: 'dark:border-emerald-500/40',
    ring: 'ring-emerald-500',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    gradient: 'from-emerald-600 to-emerald-800',
    activeTab: 'bg-emerald-600 text-white shadow-emerald-600/30',
  },
  amber: {
    btnBg: 'bg-amber-500',
    btnHover: 'hover:bg-amber-600',
    text: 'text-amber-600',
    textDark: 'dark:text-amber-400',
    bgLight: 'bg-amber-500/10',
    border: 'border-amber-500',
    borderDark: 'dark:border-amber-500/40',
    ring: 'ring-amber-500',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    gradient: 'from-amber-500 to-amber-700',
    activeTab: 'bg-amber-500 text-slate-950 shadow-amber-500/30',
  },
  indigo: {
    btnBg: 'bg-indigo-600',
    btnHover: 'hover:bg-indigo-700',
    text: 'text-indigo-600',
    textDark: 'dark:text-indigo-400',
    bgLight: 'bg-indigo-500/10',
    border: 'border-indigo-500',
    borderDark: 'dark:border-indigo-500/40',
    ring: 'ring-indigo-500',
    badge: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
    gradient: 'from-indigo-600 to-indigo-800',
    activeTab: 'bg-indigo-600 text-white shadow-indigo-600/30',
  },
  teal: {
    btnBg: 'bg-teal-600',
    btnHover: 'hover:bg-teal-700',
    text: 'text-teal-600',
    textDark: 'dark:text-teal-400',
    bgLight: 'bg-teal-500/10',
    border: 'border-teal-500',
    borderDark: 'dark:border-teal-500/40',
    ring: 'ring-teal-500',
    badge: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',
    gradient: 'from-teal-600 to-teal-800',
    activeTab: 'bg-teal-600 text-white shadow-teal-600/30',
  },
  rose: {
    btnBg: 'bg-rose-600',
    btnHover: 'hover:bg-rose-700',
    text: 'text-rose-600',
    textDark: 'dark:text-rose-400',
    bgLight: 'bg-rose-500/10',
    border: 'border-rose-500',
    borderDark: 'dark:border-rose-500/40',
    ring: 'ring-rose-500',
    badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    gradient: 'from-rose-600 to-rose-800',
    activeTab: 'bg-rose-600 text-white shadow-rose-600/30',
  },
};

export const getAccentTheme = (color?: AccentColor): AccentThemeClasses => {
  return ACCENT_THEMES[color || 'emerald'] || ACCENT_THEMES.emerald;
};
