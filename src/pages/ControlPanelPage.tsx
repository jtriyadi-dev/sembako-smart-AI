import React, { useState, useEffect } from 'react';
import { PageId, CrmUser, CrmUserStatus, RemoteAppConfig, VideoShowcaseItem, ImageGalleryItem } from '../types';
import { useRemoteConfig } from '../context/RemoteConfigContext';
import { useToast } from '../context/ToastContext';
import {
  fetchCrmUsers,
  saveCrmUser,
  deleteCrmUser,
  testGeminiApiKey,
  testWhatsAppGateway,
  testSupabaseGateway,
  MASTER_DEV_PIN,
  MASTER_DEV_EMAIL
} from '../services/devCrmService';
import { SUPABASE_SCHEMA_SQL } from '../services/supabaseClient';
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  Key,
  Globe,
  Radio,
  Plus,
  Edit,
  Trash2,
  Lock,
  Unlock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Download,
  Share2,
  Video,
  Image as ImageIcon,
  Save,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  Zap,
  Phone,
  Mail,
  Copy,
  ExternalLink,
  Sliders,
  DollarSign,
  HelpCircle,
  LogOut,
  Layers,
  ArrowRight,
  TrendingUp,
  Server,
  Activity,
  Send,
  Play,
  RotateCcw,
  CheckCircle2,
  X,
  Database,
  FileCode,
  Code
} from 'lucide-react';
import { formatRupiah } from '../utils/formatters';

interface ControlPanelPageProps {
  onNavigate: (page: PageId) => void;
}

export const ControlPanelPage: React.FC<ControlPanelPageProps> = ({ onNavigate }) => {
  const {
    config,
    apiKeys,
    isDevAuth,
    lastSyncedAt,
    updateConfig,
    updateApiKeys,
    refreshConfig,
    loginDeveloper,
    logoutDeveloper
  } = useRemoteConfig();

  const { success, error, warning, info } = useToast();

  // Authentication State
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Active Control Panel Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'keys' | 'cms' | 'logs'>('overview');

  // CRM Users State
  const [crmUsers, setCrmUsers] = useState<CrmUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');

  // User Modal State (Add/Edit)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<CrmUser> | null>(null);
  const [showUserPassword, setShowUserPassword] = useState(false);

  // API Keys Local Form State
  const [geminiKeyInput, setGeminiKeyInput] = useState(apiKeys.geminiApiKey || '');
  const [geminiModelInput, setGeminiModelInput] = useState(
    apiKeys.geminiModel && !['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'].includes(apiKeys.geminiModel)
      ? apiKeys.geminiModel
      : 'gemini-3.7-flash'
  );
  const [waProviderInput, setWaProviderInput] = useState(apiKeys.waGatewayProvider || 'fonnte');
  const [waApiKeyInput, setWaApiKeyInput] = useState(apiKeys.waApiKey || '');
  const [waSenderInput, setWaSenderInput] = useState(apiKeys.waSenderNumber || '');
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(apiKeys.supabaseUrl || '');
  const [supabaseAnonKeyInput, setSupabaseAnonKeyInput] = useState(apiKeys.supabaseAnonKey || '');
  const [supabaseServiceRoleKeyInput, setSupabaseServiceRoleKeyInput] = useState(apiKeys.supabaseServiceRoleKey || '');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showWaKey, setShowWaKey] = useState(false);
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);
  const [showSupabaseServiceKey, setShowSupabaseServiceKey] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingWa, setTestingWa] = useState(false);
  const [waTestResult, setWaTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [supabaseTestResult, setSupabaseTestResult] = useState<{ success: boolean; message: string; projectUrl?: string } | null>(null);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);

  // Live CMS Form State (Synced from Remote Config)
  const [cmsDraft, setCmsDraft] = useState<RemoteAppConfig>(config);
  const [cmsSubTab, setCmsSubTab] = useState<'branding' | 'hero' | 'announcement' | 'media' | 'pricing' | 'faqs' | 'flags'>('hero');
  const [isSavingCms, setIsSavingCms] = useState(false);

  // New Video / Image Modal
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Partial<VideoShowcaseItem> | null>(null);

  // Webhook Logs
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [sendingDummyWebhook, setSendingDummyWebhook] = useState(false);

  const fetchWebhookLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/whatsapp/logs');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (e) {
      console.warn('Failed to load webhook logs:', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleClearWebhookLogs = async () => {
    if (!confirm('Hapus semua riwayat log webhook di server?')) return;
    try {
      await fetch('/api/whatsapp/clear-logs', { method: 'POST' });
      setLogs([]);
      success('Log Dibersihkan', 'Semua riwayat webhook berhasil dihapus.');
    } catch (e) {
      error('Gagal', 'Gagal menghapus log server.');
    }
  };

  const handleSendDummyWebhook = async (commandType: 'product' | 'stock' | 'check') => {
    setSendingDummyWebhook(true);
    let sampleMsg = '';
    if (commandType === 'product') {
      sampleMsg = 'PRODUK#Beras Rojolele Super 5kg#Sembako & Bumbu#68000#75000#30#Sak#5';
    } else if (commandType === 'stock') {
      sampleMsg = 'STOK#Beras Rojolele Super 5kg#15';
    } else {
      sampleMsg = '!stok';
    }

    try {
      const res = await fetch('/api/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: '6281234567890',
          message: sampleMsg,
          pushName: 'Admin Toko (Uji)'
        })
      });
      const data = await res.json();
      await fetchWebhookLogs();
      success('Simulasi Webhook Berhasil', `Pesan "${sampleMsg}" berhasil diterima dan diproses server.`);
    } catch (e: any) {
      warning('Simulasi Webhook Gagal', e?.message || 'Gagal mengirim pesan');
    } finally {
      setSendingDummyWebhook(false);
    }
  };

  // Load CRM Users when dev is authenticated
  const loadUsersList = async () => {
    setLoadingUsers(true);
    try {
      const data = await fetchCrmUsers();
      setCrmUsers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isDevAuth) {
      loadUsersList();
      setCmsDraft(config);
      setGeminiKeyInput(apiKeys.geminiApiKey || '');
      const validModel =
        apiKeys.geminiModel && !['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'].includes(apiKeys.geminiModel)
          ? apiKeys.geminiModel
          : 'gemini-3.7-flash';
      setGeminiModelInput(validModel);
      setWaApiKeyInput(apiKeys.waApiKey || '');
      setWaSenderInput(apiKeys.waSenderNumber || '');
      setWaProviderInput(apiKeys.waGatewayProvider || 'fonnte');
      setSupabaseUrlInput(apiKeys.supabaseUrl || '');
      setSupabaseAnonKeyInput(apiKeys.supabaseAnonKey || '');
      setSupabaseServiceRoleKeyInput(apiKeys.supabaseServiceRoleKey || '');
      fetchWebhookLogs();
    }
  }, [isDevAuth, config, apiKeys]);

  // Polling for Webhook Logs every 2 seconds when logs tab is active
  useEffect(() => {
    if (!isDevAuth) return;
    if (activeTab === 'logs') {
      fetchWebhookLogs();
      const interval = setInterval(() => {
        fetchWebhookLogs();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isDevAuth, activeTab]);

  // Handle Developer Login
  const handleDevLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pinInput) {
      setPinError('Masukkan Master PIN / Passcode');
      return;
    }
    const ok = loginDeveloper(pinInput);
    if (ok) {
      setPinError('');
      success('Akses Developer Diverifikasi', 'Selamat datang di Master Developer Control Panel & CRM.');
    } else {
      setPinError('PIN / Passcode salah. Gunakan PIN: 998877');
    }
  };

  // Handle Save User
  const handleSaveUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser?.namaPemilik || !editingUser?.namaToko) {
      warning('Data Belum Lengkap', 'Nama pemilik dan nama toko wajib diisi.');
      return;
    }

    try {
      const res = await saveCrmUser(editingUser);
      if (res.success) {
        success('Akun Berhasil Disimpan', res.message);
        setIsUserModalOpen(false);
        setEditingUser(null);
        await loadUsersList();
      }
    } catch (err: any) {
      error('Gagal Menyimpan', err.message);
    }
  };

  // Handle Delete User
  const handleDeleteUserClick = async (userId: string, nama: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus akun pelanggan "${nama}"?\n\nTindakan ini permanen dan akan menghapus akses lisensi pengguna ini.`)) {
      try {
        const res = await deleteCrmUser(userId);
        if (res.success) {
          success('Akun Dihapus', res.message);
          await loadUsersList();
        }
      } catch (err: any) {
        error('Gagal Menghapus', err.message);
      }
    }
  };

  // Handle Toggle User Status
  const handleToggleUserStatus = async (user: CrmUser) => {
    const nextStatus: CrmUserStatus = user.status === 'aktif' ? 'suspended' : 'aktif';
    const updated: CrmUser = { ...user, status: nextStatus };
    const res = await saveCrmUser(updated);
    if (res.success) {
      info('Status Diperbarui', `Akun ${user.namaPemilik} sekarang: ${nextStatus.toUpperCase()}`);
      await loadUsersList();
    }
  };

  // Handle Test Gemini Key
  const handleTestGemini = async () => {
    setTestingGemini(true);
    setGeminiTestResult(null);
    try {
      const res = await testGeminiApiKey(geminiKeyInput, geminiModelInput);
      setGeminiTestResult(res);
      if (res.success) {
        success('Google Gemini AI Terhubung', res.message);
      } else {
        warning('Uji Koneksi Gemini Gagal', res.message);
      }
    } catch (e: any) {
      setGeminiTestResult({ success: false, message: e.message || 'Terjadi kesalahan saat menguji API Key' });
    } finally {
      setTestingGemini(false);
    }
  };

  // Handle Test WhatsApp Gateway
  const handleTestWa = async () => {
    setTestingWa(true);
    setWaTestResult(null);
    try {
      const res = await testWhatsAppGateway({
        provider: waProviderInput,
        token: waApiKeyInput,
        targetPhone: waSenderInput || '081234567890',
      });
      setWaTestResult(res);
      if (res.success) {
        success('WhatsApp Gateway Terhubung', res.message);
      } else {
        warning('Uji Gateway Gagal', res.message);
      }
    } catch (e: any) {
      setWaTestResult({ success: false, message: e.message });
    } finally {
      setTestingWa(false);
    }
  };

  // Handle Test Supabase Connection
  const handleTestSupabase = async () => {
    setTestingSupabase(true);
    setSupabaseTestResult(null);

    // Auto-clean inputs
    let cleanUrl = (supabaseUrlInput || '').trim();
    if ((cleanUrl.startsWith('"') && cleanUrl.endsWith('"')) || (cleanUrl.startsWith("'") && cleanUrl.endsWith("'"))) {
      cleanUrl = cleanUrl.slice(1, -1).trim();
    }
    cleanUrl = cleanUrl.replace(/\/+$/, '');

    let cleanKey = (supabaseAnonKeyInput || '').trim();
    if ((cleanKey.startsWith('"') && cleanKey.endsWith('"')) || (cleanKey.startsWith("'") && cleanKey.endsWith("'"))) {
      cleanKey = cleanKey.slice(1, -1).trim();
    }
    if (cleanKey.toLowerCase().startsWith('bearer ')) {
      cleanKey = cleanKey.slice(7).trim();
    }

    setSupabaseUrlInput(cleanUrl);
    setSupabaseAnonKeyInput(cleanKey);

    try {
      const res = await testSupabaseGateway({
        supabaseUrl: cleanUrl,
        supabaseAnonKey: cleanKey,
      });
      setSupabaseTestResult(res);
      if (res.success) {
        success('Supabase Terhubung', res.message);
      } else {
        warning('Uji Koneksi Supabase Gagal', res.message);
      }
    } catch (e: any) {
      setSupabaseTestResult({ success: false, message: e.message || 'Gagal menguji koneksi Supabase' });
    } finally {
      setTestingSupabase(false);
    }
  };

  // Handle Save API Keys
  const handleSaveApiKeys = async () => {
    let cleanUrl = (supabaseUrlInput || '').trim();
    if ((cleanUrl.startsWith('"') && cleanUrl.endsWith('"')) || (cleanUrl.startsWith("'") && cleanUrl.endsWith("'"))) {
      cleanUrl = cleanUrl.slice(1, -1).trim();
    }
    cleanUrl = cleanUrl.replace(/\/+$/, '');

    let cleanKey = (supabaseAnonKeyInput || '').trim();
    if ((cleanKey.startsWith('"') && cleanKey.endsWith('"')) || (cleanKey.startsWith("'") && cleanKey.endsWith("'"))) {
      cleanKey = cleanKey.slice(1, -1).trim();
    }
    if (cleanKey.toLowerCase().startsWith('bearer ')) {
      cleanKey = cleanKey.slice(7).trim();
    }

    try {
      const ok = await updateApiKeys({
        geminiApiKey: (geminiKeyInput || '').trim(),
        geminiModel: geminiModelInput,
        waGatewayProvider: waProviderInput as any,
        waApiKey: (waApiKeyInput || '').trim(),
        waSenderNumber: (waSenderInput || '').trim(),
        supabaseUrl: cleanUrl,
        supabaseAnonKey: cleanKey,
        supabaseServiceRoleKey: (supabaseServiceRoleKeyInput || '').trim(),
      });
      if (ok) {
        success('Konfigurasi API & Database Disimpan', 'Kredensial Supabase, AI, dan WhatsApp Gateway berhasil diperbarui!');
      } else {
        error('Gagal Menyimpan', 'Terjadi kesalahan saat menyimpan konfigurasi.');
      }
    } catch (e: any) {
      error('Gagal Menyimpan', e.message);
    }
  };

  // Handle Save Live CMS Configuration
  const handleSaveCms = async () => {
    setIsSavingCms(true);
    try {
      const ok = await updateConfig(cmsDraft);
      if (ok) {
        success('CMS Berhasil Disimpan & Disiarkan!', `Perubahan langsung aktif untuk semua pengunjung dan pengguna website (v${(config.version || 1) + 1}).`);
      } else {
        error('Gagal Menyimpan', 'Periksa koneksi internet Anda.');
      }
    } catch (e: any) {
      error('Gagal Menyimpan', e.message);
    } finally {
      setIsSavingCms(false);
    }
  };

  // Filtered Users
  const filteredUsers = crmUsers.filter(u => {
    const matchSearch =
      (u.namaPemilik || '').toLowerCase().includes(searchUser.toLowerCase()) ||
      (u.namaToko || '').toLowerCase().includes(searchUser.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchUser.toLowerCase()) ||
      (u.noHp || '').includes(searchUser) ||
      (u.licenseKey || '').toLowerCase().includes(searchUser.toLowerCase());

    const matchPlan = filterPlan === 'all' || u.plan === filterPlan;
    const matchStatus = filterStatus === 'all' || u.status === filterStatus;
    const matchRole = filterRole === 'all' || (u.role || 'owner') === filterRole;

    return matchSearch && matchPlan && matchStatus && matchRole;
  });

  // Calculate telemetry stats
  const totalUsers = crmUsers.length;
  const devUsersCount = crmUsers.filter(u => u.role === 'developer').length;
  const activeProUsers = crmUsers.filter(u => u.plan === 'pro_lifetime' && u.status === 'aktif').length;
  const trialUsers = crmUsers.filter(u => u.plan === 'trial_6h').length;
  const enterpriseUsers = crmUsers.filter(u => u.plan === 'enterprise').length;

  // -------------------------------------------------------------
  // RENDER: DEVELOPER AUTHENTICATION GATEWAY (PIN LOCK)
  // -------------------------------------------------------------
  if (!isDevAuth) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-950/40 relative overflow-hidden backdrop-blur-xl">
          {/* Top Decorative Glow */}
          <div className="absolute -top-16 -right-16 w-36 h-36 bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-amber-500/15 rounded-full blur-3xl" />

          <div className="relative z-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-emerald-600 to-amber-500 p-0.5 shadow-xl flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <ShieldAlert className="w-8 h-8 text-amber-400" />
              </div>
            </div>

            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Developer Control Panel
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-xs mx-auto">
              Super Admin & CRM Portal untuk mengedit konten website, pengguna, dan API Key tanpa perlu deploy ulang.
            </p>

            <form onSubmit={handleDevLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-left text-slate-700 dark:text-slate-300 mb-1.5">
                  Master Developer PIN / Passcode
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="Masukkan PIN (Default: 998877)"
                    className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white font-mono tracking-wider"
                    autoFocus
                  />
                </div>
                {pinError && (
                  <p className="text-xs text-rose-500 mt-1.5 text-left flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {pinError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Unlock className="w-4 h-4" />
                Buka Control Panel Developer
              </button>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPinInput(MASTER_DEV_PIN);
                    loginDeveloper(MASTER_DEV_PIN);
                    success('Akses Otomatis', 'Login menggunakan Master PIN developer.');
                  }}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium cursor-pointer"
                >
                  ⚡ Gunakan Master PIN Pengembang ({MASTER_DEV_PIN})
                </button>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('landing')}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                >
                  ← Kembali ke Halaman Utama
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: MAIN DEVELOPER CONTROL PANEL & CRM DASHBOARD
  // -------------------------------------------------------------
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Super Admin Header */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border border-emerald-500/30 rounded-3xl p-5 sm:p-6 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-emerald-400 p-0.5 shadow-lg">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Sliders className="w-6 h-6 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Developer Control Panel & CRM
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  SUPER ADMIN
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                <span>Versi CMS: <strong className="text-amber-300">v{config.version || 1}</strong></span>
                <span>•</span>
                <span className="text-slate-400">
                  Sinkronisasi: {lastSyncedAt ? lastSyncedAt.toLocaleTimeString('id-ID') : 'Aktif'}
                </span>
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => onNavigate('landing')}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              Lihat Website
            </button>
            <button
              onClick={() => {
                refreshConfig();
                loadUsersList();
                success('Data Disegarkan', 'Semua data konfigurasi dan CRM diperbarui dari server.');
              }}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-300" />
              Sync Cloud
            </button>
            <button
              onClick={() => {
                logoutDeveloper();
                info('Logout Developer', 'Sesi developer control panel ditutup.');
              }}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-1 border-t border-slate-800/80 pt-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Activity className="w-4 h-4" />
            Ringkasan Sistem
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'users'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            CRM Pelanggan ({crmUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('cms')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'cms'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Globe className="w-4 h-4" />
            Edit Website & Media (Live CMS)
          </button>
          <button
            onClick={() => setActiveTab('keys')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'keys'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Key className="w-4 h-4" />
            API Key & Gateway
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Radio className="w-4 h-4" />
            Webhook & Log Sync
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & SYSTEM TELEMETRY */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Akun CRM</span>
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2">
                {totalUsers}
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                <CheckCircle className="w-3 h-3" />
                {activeProUsers} Lisensi Pro Lifetime Aktif
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pelanggan Trial 6 Jam</span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2">
                {trialUsers}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Potensi konversi ke Pro Lifetime Rp 99rb
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Live CMS Broadcast</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Globe className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                v{config.version || 1}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Otomatis disinkron ke semua browser klien
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Status Server & API</span>
                <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center">
                  <Server className="w-4 h-4" />
                </div>
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-2 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                Express + REST Active
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Port 3000 • In-memory + File Sync OK
              </p>
            </div>
          </div>

          {/* Quick Shortcuts & Feature Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Aksi Cepat Pengembang
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    const defaultPassword = 'sembako' + Math.floor(1000 + Math.random() * 9000);
                    const defaultLicense = `SBK-PRO-${Math.floor(1000 + Math.random() * 9000)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                    setEditingUser({
                      plan: 'pro_lifetime',
                      status: 'aktif',
                      deviceLimit: 3,
                      role: 'owner',
                      password: defaultPassword,
                      licenseKey: defaultLicense,
                    });
                    setIsUserModalOpen(true);
                  }}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-500/10 border border-slate-200 dark:border-slate-700 text-left transition-colors cursor-pointer group"
                >
                  <Users className="w-5 h-5 text-emerald-600 mb-1.5 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-bold text-slate-900 dark:text-white">+ Buat Akun Pelanggan</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Tambah lisensi manual</p>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('cms');
                    setCmsSubTab('hero');
                  }}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-500/10 border border-slate-200 dark:border-slate-700 text-left transition-colors cursor-pointer group"
                >
                  <Edit className="w-5 h-5 text-blue-500 mb-1.5 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Edit Headline & Promo</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Ubah teks website live</p>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('cms');
                    setCmsSubTab('media');
                  }}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-500/10 border border-slate-200 dark:border-slate-700 text-left transition-colors cursor-pointer group"
                >
                  <Video className="w-5 h-5 text-rose-500 mb-1.5 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Tambah Video Tutorial</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Embed video YouTube</p>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('keys');
                  }}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-500/10 border border-slate-200 dark:border-slate-700 text-left transition-colors cursor-pointer group"
                >
                  <Key className="w-5 h-5 text-amber-500 mb-1.5 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Atur Google Gemini Key</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Live update API Key</p>
                </button>
              </div>
            </div>

            {/* System Information & Sync Health */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  Status Sinkronisasi Real-Time (No Redeploy)
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Semua perubahan pada konten, teks, gambar, video, dan akun pelanggan yang disimpan melalui panel ini akan 
                  <strong> langsung diperbarui di browser seluruh pengguna yang sedang aktif</strong> tanpa memerlukan build atau deploy ulang aplikasi.
                </p>
              </div>

              <div className="mt-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>
                  Pengaturan saat ini: Mode Pengembang <strong>Aktif</strong> • Semua Klien Terhubung.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CRM USER & CUSTOMER ACCOUNT MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  placeholder="Cari nama, toko, no HP, lisensi..."
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 outline-none font-medium"
              >
                <option value="all">Semua Role</option>
                <option value="developer">🛡️ Developer / Super Admin</option>
                <option value="owner">👑 Owner Toko</option>
                <option value="admin">💼 Admin Toko</option>
                <option value="kasir">💻 Kasir POS</option>
              </select>

              <select
                value={filterPlan}
                onChange={(e) => setFilterPlan(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="all">Semua Paket</option>
                <option value="pro_lifetime">Pro Lifetime (Rp 99rb)</option>
                <option value="trial_6h">Trial 6 Jam</option>
                <option value="enterprise">Enterprise</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="all">Semua Status</option>
                <option value="aktif">Aktif</option>
                <option value="suspended">Suspended / Beku</option>
                <option value="expired">Expired</option>
              </select>

              <button
                onClick={() => {
                  const defaultPassword = 'sembako' + Math.floor(1000 + Math.random() * 9000);
                  const defaultLicense = `SBK-PRO-${Math.floor(1000 + Math.random() * 9000)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                  setEditingUser({
                    plan: 'pro_lifetime',
                    status: 'aktif',
                    deviceLimit: 3,
                    role: 'owner',
                    password: defaultPassword,
                    licenseKey: defaultLicense,
                  });
                  setIsUserModalOpen(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Tambah Akun Pelanggan
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">Pelanggan & Toko</th>
                    <th className="px-4 py-3.5">Role & Hak Akses</th>
                    <th className="px-4 py-3.5">Kontak & Password</th>
                    <th className="px-4 py-3.5">Paket & Lisensi</th>
                    <th className="px-4 py-3.5">Status Akun</th>
                    <th className="px-4 py-3.5">Masa Aktif</th>
                    <th className="px-4 py-3.5 text-right">Aksi Developer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                        Memuat data pelanggan CRM...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Tidak ada akun pelanggan yang cocok dengan pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const isPro = user.plan === 'pro_lifetime';
                      const isTrial = user.plan === 'trial_6h';
                      const isEnterprise = user.plan === 'enterprise';
                      const role = user.role || 'owner';

                      return (
                        <tr key={user.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{user.namaPemilik}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <span>🏪 {user.namaToko}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            {role === 'developer' ? (
                              <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 flex items-center gap-1 w-fit shadow-xs">
                                <ShieldCheck className="w-3 h-3 text-purple-500" />
                                Developer / Super Admin
                              </span>
                            ) : role === 'owner' ? (
                              <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1 w-fit">
                                👑 Owner Toko
                              </span>
                            ) : role === 'admin' ? (
                              <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/30 flex items-center gap-1 w-fit">
                                💼 Admin Toko
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1 w-fit">
                                💻 Kasir POS
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-emerald-500" />
                              {user.noHp}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {user.email}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                              <Lock className="w-3 h-3 text-amber-500" />
                              <span>Pass: <strong className="text-slate-700 dark:text-slate-200">{user.password || 'password123'}</strong></span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full ${
                                  isPro
                                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                    : isTrial
                                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                                    : 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                                }`}
                              >
                                {isPro ? 'Pro Lifetime' : isTrial ? 'Trial 6 Jam' : isEnterprise ? 'Enterprise' : user.plan}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 mt-1 flex items-center gap-1">
                              <Key className="w-3 h-3 text-amber-500" />
                              {user.licenseKey || 'No Key'}
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <button
                              onClick={() => handleToggleUserStatus(user)}
                              className={`px-2.5 py-1 text-[10px] font-bold rounded-full cursor-pointer flex items-center gap-1 transition-all ${
                                user.status === 'aktif'
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/25'
                              }`}
                              title="Klik untuk ubah status aktif/bekukan"
                            >
                              {user.status === 'aktif' ? (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Aktif
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3" />
                                  Suspended
                                </>
                              )}
                            </button>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                              {user.expiresAt ? new Date(user.expiresAt).toLocaleDateString('id-ID') : '♾️ Seumur Hidup'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Limit: {user.deviceLimit} Perangkat
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  const text = `Halo Kak ${user.namaPemilik}, Akun Sembako Smart POS AI Toko "${user.namaToko}" Anda sudah aktif!\n\nEmail: ${user.email}\nPassword: ${user.password || 'password123'}\nLisensi: ${user.licenseKey}\n\nLogin sekarang di website.`;
                                  navigator.clipboard.writeText(text);
                                  success('Disalin ke Clipboard', 'Detail akun siap dikirim via WhatsApp ke pelanggan.');
                                }}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500/20 text-slate-600 dark:text-slate-300 hover:text-emerald-500 transition-colors cursor-pointer"
                                title="Salin Info Login untuk WA"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => {
                                  setEditingUser(user);
                                  setIsUserModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-500/20 text-slate-600 dark:text-slate-300 hover:text-blue-500 transition-colors cursor-pointer"
                                title="Edit Akun Pelanggan"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteUserClick(user.id, user.namaPemilik)}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/20 text-slate-600 dark:text-slate-300 hover:text-rose-500 transition-colors cursor-pointer"
                                title="Hapus Akun"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: LIVE WEBSITE CONTENT & MEDIA CMS */}
      {/* ========================================================================= */}
      {activeTab === 'cms' && (
        <div className="space-y-6">
          {/* CMS Sub-Navigation */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setCmsSubTab('hero')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                cmsSubTab === 'hero'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              1. Hero & Headline Teks
            </button>
            <button
              onClick={() => setCmsSubTab('branding')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                cmsSubTab === 'branding'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              2. Identitas & Kontak
            </button>
            <button
              onClick={() => setCmsSubTab('announcement')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                cmsSubTab === 'announcement'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              3. Top Announcement & Banner
            </button>
            <button
              onClick={() => setCmsSubTab('media')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                cmsSubTab === 'media'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              4. Media & Video Tutorial CMS
            </button>
            <button
              onClick={() => setCmsSubTab('pricing')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                cmsSubTab === 'pricing'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              5. Paket Harga & Fitur
            </button>
            <button
              onClick={() => setCmsSubTab('faqs')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                cmsSubTab === 'faqs'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              6. FAQ Tanya Jawab
            </button>
            <button
              onClick={() => setCmsSubTab('flags')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                cmsSubTab === 'flags'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              7. Mode Maintenance & Flags
            </button>
          </div>

          {/* Sub-Tab 1: HERO & HEADLINE */}
          {cmsSubTab === 'hero' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit className="w-4 h-4 text-emerald-500" />
                Pengaturan Teks Hero Landing Page (Live)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Badge Header Hero
                  </label>
                  <input
                    type="text"
                    value={cmsDraft.hero.badgeText}
                    onChange={(e) => setCmsDraft({
                      ...cmsDraft,
                      hero: { ...cmsDraft.hero, badgeText: e.target.value }
                    })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Headline Utama
                  </label>
                  <textarea
                    rows={2}
                    value={cmsDraft.hero.headline}
                    onChange={(e) => setCmsDraft({
                      ...cmsDraft,
                      hero: { ...cmsDraft.hero, headline: e.target.value }
                    })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Headline Highlight (Warna Emas)
                  </label>
                  <textarea
                    rows={2}
                    value={cmsDraft.hero.headlineHighlight}
                    onChange={(e) => setCmsDraft({
                      ...cmsDraft,
                      hero: { ...cmsDraft.hero, headlineHighlight: e.target.value }
                    })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Subheadline / Paragraf Penjelasan
                  </label>
                  <textarea
                    rows={3}
                    value={cmsDraft.hero.subheadline}
                    onChange={(e) => setCmsDraft({
                      ...cmsDraft,
                      hero: { ...cmsDraft.hero, subheadline: e.target.value }
                    })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Teks Tombol CTA Utama
                  </label>
                  <input
                    type="text"
                    value={cmsDraft.hero.ctaPrimaryText}
                    onChange={(e) => setCmsDraft({
                      ...cmsDraft,
                      hero: { ...cmsDraft.hero, ctaPrimaryText: e.target.value }
                    })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Teks Tombol CTA Sekunder
                  </label>
                  <input
                    type="text"
                    value={cmsDraft.hero.ctaSecondaryText}
                    onChange={(e) => setCmsDraft({
                      ...cmsDraft,
                      hero: { ...cmsDraft.hero, ctaSecondaryText: e.target.value }
                    })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tab 2: BRANDING */}
          {cmsSubTab === 'branding' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                Identitas Aplikasi & Kontak Support
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Aplikasi
                  </label>
                  <input
                    type="text"
                    value={cmsDraft.branding.appName}
                    onChange={(e) => setCmsDraft({
                      ...cmsDraft,
                      branding: { ...cmsDraft.branding, appName: e.target.value }
                    })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sub Judul Aplikasi
                  </label>
                  <input
                    type="text"
                    value={cmsDraft.branding.appSubtitle}
                    onChange={(e) => setCmsDraft({
                      ...cmsDraft,
                      branding: { ...cmsDraft.branding, appSubtitle: e.target.value }
                    })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tagline Utama
                  </label>
                  <input
                    type="text"
                    value={cmsDraft.branding.tagline}
                    onChange={(e) => setCmsDraft({
                      ...cmsDraft,
                      branding: { ...cmsDraft.branding, tagline: e.target.value }
                    })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nomor WhatsApp Support Developer
                  </label>
                  <input
                    type="text"
                    value={cmsDraft.branding.supportWa}
                    onChange={(e) => setCmsDraft({
                      ...cmsDraft,
                      branding: { ...cmsDraft.branding, supportWa: e.target.value }
                    })}
                    placeholder="Contoh: 6281234567890"
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Kontak Developer
                  </label>
                  <input
                    type="email"
                    value={cmsDraft.branding.supportEmail}
                    onChange={(e) => setCmsDraft({
                      ...cmsDraft,
                      branding: { ...cmsDraft.branding, supportEmail: e.target.value }
                    })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tab 3: ANNOUNCEMENT BAR */}
          {cmsSubTab === 'announcement' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-500" />
                  Top Announcement Bar (Banner Pengumuman Atas)
                </h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cmsDraft.announcement.enabled}
                    onChange={(e) => setCmsDraft({
                      ...cmsDraft,
                      announcement: { ...cmsDraft.announcement, enabled: e.target.checked }
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Badge Pengumuman
                  </label>
                  <input
                    type="text"
                    value={cmsDraft.announcement.badgeText}
                    onChange={(e) => setCmsDraft({
                      ...cmsDraft,
                      announcement: { ...cmsDraft.announcement, badgeText: e.target.value }
                    })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Warna Tema Bar
                  </label>
                  <select
                    value={cmsDraft.announcement.theme}
                    onChange={(e) => setCmsDraft({
                      ...cmsDraft,
                      announcement: { ...cmsDraft.announcement, theme: e.target.value as any }
                    })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                  >
                    <option value="emerald">Emerald Green (Standar)</option>
                    <option value="amber">Amber Gold (Promo)</option>
                    <option value="indigo">Indigo Blue (Info)</option>
                    <option value="rose">Rose Red (Urgent)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Isi Pesan Pengumuman
                  </label>
                  <textarea
                    rows={2}
                    value={cmsDraft.announcement.message}
                    onChange={(e) => setCmsDraft({
                      ...cmsDraft,
                      announcement: { ...cmsDraft.announcement, message: e.target.value }
                    })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tab 4: MEDIA & VIDEOS */}
          {cmsSubTab === 'media' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-500" />
                  Foto & Banner Utama Landing Page
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      URL Foto Banner Hero (Bisa diganti URL Unsplash / Gambar Hosting)
                    </label>
                    <input
                      type="text"
                      value={cmsDraft.media.heroBannerImage}
                      onChange={(e) => setCmsDraft({
                        ...cmsDraft,
                        media: { ...cmsDraft.media, heroBannerImage: e.target.value }
                      })}
                      className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-mono"
                    />
                  </div>

                  {cmsDraft.media.heroBannerImage && (
                    <div className="relative w-full h-40 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                      <img
                        src={cmsDraft.media.heroBannerImage}
                        alt="Hero Banner Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 backdrop-blur-md rounded-md text-[10px] text-white">
                        Live Preview Foto Hero
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Video Tutorial Showcase */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Video className="w-4 h-4 text-rose-500" />
                      Daftar Video Tutorial & Demo (YouTube / MP4 Embed)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Video yang ditambahkan di sini akan langsung muncul di showcase landing page.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setEditingVideo({
                        title: 'Tutorial Baru',
                        description: 'Panduan penggunaan fitur.',
                        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                        thumbnailUrl: 'https://images.unsplash.com/photo-1556742049-0a67e557224f?q=80&w=800&auto=format&fit=crop',
                        isFeatured: false,
                        platform: 'youtube',
                      });
                      setIsVideoModalOpen(true);
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Tambah Video
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {cmsDraft.media.videos.map((vid, idx) => (
                    <div
                      key={vid.id || idx}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                            {vid.title}
                          </h4>
                          {vid.isFeatured && (
                            <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded bg-amber-500/20 text-amber-600 dark:text-amber-300">
                              Featured
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                          {vid.description}
                        </p>
                        <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-2 truncate">
                          📺 {vid.videoUrl}
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 mt-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <button
                          onClick={() => {
                            setEditingVideo(vid);
                            setIsVideoModalOpen(true);
                          }}
                          className="px-2 py-1 text-[10px] font-semibold rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-emerald-500 hover:text-white transition-colors"
                        >
                          Edit Video
                        </button>
                        <button
                          onClick={() => {
                            const filtered = cmsDraft.media.videos.filter((_, i) => i !== idx);
                            setCmsDraft({
                              ...cmsDraft,
                              media: { ...cmsDraft.media, videos: filtered }
                            });
                          }}
                          className="px-2 py-1 text-[10px] font-semibold rounded bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white transition-colors"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tab 5: PRICING */}
          {cmsSubTab === 'pricing' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                Paket Harga Promo & Daftar Fitur
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Harga Promo (Sekali Bayar)
                  </label>
                  <input
                    type="number"
                    value={cmsDraft.pricing.promoPrice}
                    onChange={(e) => setCmsDraft({
                      ...cmsDraft,
                      pricing: { ...cmsDraft.pricing, promoPrice: Number(e.target.value) }
                    })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-bold"
                  />
                  <p className="text-[10px] text-emerald-600 mt-1">
                    Tampil: {formatRupiah(cmsDraft.pricing.promoPrice)}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Harga Normal (Dicoret)
                  </label>
                  <input
                    type="number"
                    value={cmsDraft.pricing.normalPrice}
                    onChange={(e) => setCmsDraft({
                      ...cmsDraft,
                      pricing: { ...cmsDraft.pricing, normalPrice: Number(e.target.value) }
                    })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Diskon (%)
                  </label>
                  <input
                    type="number"
                    value={cmsDraft.pricing.discountPercent}
                    onChange={(e) => setCmsDraft({
                      ...cmsDraft,
                      pricing: { ...cmsDraft.pricing, discountPercent: Number(e.target.value) }
                    })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Daftar Fitur Checklist Promo (Satu baris per butir fitur)
                </label>
                <textarea
                  rows={6}
                  value={cmsDraft.pricing.featuresList.join('\n')}
                  onChange={(e) => setCmsDraft({
                    ...cmsDraft,
                    pricing: {
                      ...cmsDraft.pricing,
                      featuresList: e.target.value.split('\n').filter(s => s.trim().length > 0)
                    }
                  })}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>
          )}

          {/* Sub-Tab 6: FAQS */}
          {cmsSubTab === 'faqs' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-emerald-500" />
                  Daftar Pertanyaan Umum (FAQ)
                </h3>
                <button
                  onClick={() => {
                    const newFaqs = [
                      ...cmsDraft.faqs,
                      { id: `faq-${Date.now()}`, q: 'Pertanyaan Baru?', a: 'Jawaban penjelasan di sini.' }
                    ];
                    setCmsDraft({ ...cmsDraft, faqs: newFaqs });
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Tambah FAQ
                </button>
              </div>

              <div className="space-y-3">
                {cmsDraft.faqs.map((faq, idx) => (
                  <div key={faq.id || idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={faq.q}
                        onChange={(e) => {
                          const updated = [...cmsDraft.faqs];
                          updated[idx].q = e.target.value;
                          setCmsDraft({ ...cmsDraft, faqs: updated });
                        }}
                        placeholder="Pertanyaan FAQ"
                        className="w-full p-2 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      />
                      <button
                        onClick={() => {
                          const filtered = cmsDraft.faqs.filter((_, i) => i !== idx);
                          setCmsDraft({ ...cmsDraft, faqs: filtered });
                        }}
                        className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Hapus FAQ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <textarea
                      rows={2}
                      value={faq.a}
                      onChange={(e) => {
                        const updated = [...cmsDraft.faqs];
                        updated[idx].a = e.target.value;
                        setCmsDraft({ ...cmsDraft, faqs: updated });
                      }}
                      placeholder="Jawaban FAQ"
                      className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub-Tab 7: MAINTENANCE & FLAGS */}
          {cmsSubTab === 'flags' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    Mode Pemeliharaan (Maintenance Mode)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Saat aktif, pengunjung akan melihat layar pemberitahuan maintenance.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cmsDraft.maintenance.enabled}
                    onChange={(e) => setCmsDraft({
                      ...cmsDraft,
                      maintenance: { ...cmsDraft.maintenance, enabled: e.target.checked }
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {cmsDraft.maintenance.enabled && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Judul Pesan Maintenance
                    </label>
                    <input
                      type="text"
                      value={cmsDraft.maintenance.title}
                      onChange={(e) => setCmsDraft({
                        ...cmsDraft,
                        maintenance: { ...cmsDraft.maintenance, title: e.target.value }
                      })}
                      className="w-full p-2.5 text-xs bg-white dark:bg-slate-800 border border-amber-500/30 rounded-xl outline-none text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Penjelasan untuk Pengunjung
                    </label>
                    <textarea
                      rows={2}
                      value={cmsDraft.maintenance.message}
                      onChange={(e) => setCmsDraft({
                        ...cmsDraft,
                        maintenance: { ...cmsDraft.maintenance, message: e.target.value }
                      })}
                      className="w-full p-2.5 text-xs bg-white dark:bg-slate-800 border border-amber-500/30 rounded-xl outline-none text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sticky Action: SAVE & BROADCAST */}
          <div className="sticky bottom-4 z-20 bg-slate-900/90 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white">
            <div>
              <p className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                Siap Disiarkan ke Seluruh Klien Aktif
              </p>
              <p className="text-[11px] text-slate-400">
                Perubahan tersimpan otomatis di server dan langsung tampil di website tanpa deploy ulang.
              </p>
            </div>

            <button
              onClick={handleSaveCms}
              disabled={isSavingCms}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
            >
              {isSavingCms ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Menyiarkan Perubahan...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  💾 SIMPAN & BROADCAST PERUBAHAN
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: API KEY & GATEWAY MANAGER */}
      {/* ========================================================================= */}
      {activeTab === 'keys' && (
        <div className="space-y-6">
          {/* Gemini AI API Key */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Google Gemini AI API Key (Server & Client)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kunci API untuk asisten rekomendasi restock, analisis untung-rugi, dan peringatan barang kedaluwarsa.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  API Key Google Gemini
                </label>
                <div className="relative">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiKeyInput}
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full pr-10 pl-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Model AI:</span>
                  <select
                    value={geminiModelInput}
                    onChange={(e) => setGeminiModelInput(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                  >
                    <option value="gemini-3.7-flash">gemini-3.7-flash (Terbaru & Direkomendasikan)</option>
                    <option value="gemini-3.6-flash">gemini-3.6-flash (Cepat & Stabil)</option>
                    <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Ultra Cepat)</option>
                    <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Penalaran Kompleks)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestGemini}
                    disabled={testingGemini}
                    className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-bold text-xs border border-amber-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {testingGemini ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    Uji Koneksi Gemini AI
                  </button>
                </div>
              </div>

              {geminiTestResult && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    geminiTestResult.success
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {geminiTestResult.success ? <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />}
                  <span>{geminiTestResult.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* WhatsApp Gateway Integration */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  WhatsApp Gateway & Bot Integration
                </h3>
                <p className="text-xs text-slate-500">
                  Integrasi penyedia WhatsApp API untuk bot auto-stok dan kirim struk digital.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Penyedia Gateway WhatsApp
                </label>
                <select
                  value={waProviderInput}
                  onChange={(e) => setWaProviderInput(e.target.value as any)}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                >
                  <option value="fonnte">Fonnte (Indonesia Gateway)</option>
                  <option value="wablas">Wablas</option>
                  <option value="whacenter">WhaCenter</option>
                  <option value="custom">Custom Webhook API</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nomor WhatsApp Pengirim (Sender Device)
                </label>
                <input
                  type="text"
                  value={waSenderInput}
                  onChange={(e) => setWaSenderInput(e.target.value)}
                  placeholder="081234567890"
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Token / API Key WhatsApp
                </label>
                <div className="relative">
                  <input
                    type={showWaKey ? 'text' : 'password'}
                    value={waApiKeyInput}
                    onChange={(e) => setWaApiKeyInput(e.target.value)}
                    placeholder="Masukkan token dari dashboard penyedia..."
                    className="w-full pr-10 pl-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWaKey(!showWaKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showWaKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Webhook URL Display & Copy */}
              <div className="md:col-span-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                    Link / URL Webhook WhatsApp (Untuk Bot & Auto-Stok)
                  </label>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                    🟢 Endpoint Aktif
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}/api/whatsapp/webhook` : 'https://your-domain.com/api/whatsapp/webhook'}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl outline-none text-emerald-600 dark:text-emerald-400 font-mono select-all font-bold tracking-wide"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const url = typeof window !== 'undefined' ? `${window.location.origin}/api/whatsapp/webhook` : '/api/whatsapp/webhook';
                      navigator.clipboard.writeText(url);
                      success('Link Webhook Disalin', 'URL Webhook WhatsApp berhasil disalin ke clipboard!');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-md shadow-emerald-900/20"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Salin Link Webhook
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  💡 <strong>Cara Pasang:</strong> Masuk ke dashboard penyedia (<strong>Wablas / Fonnte / WhaCenter</strong>), buka menu <strong>Webhook</strong>, lalu tempel (<em>paste</em>) tautan di atas agar notifikasi dan bot otomatis aktif.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleTestWa}
                disabled={testingWa}
                className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {testingWa ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Uji Gateway WhatsApp
              </button>
            </div>

            {waTestResult && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  waTestResult.success
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                }`}
              >
                {waTestResult.success ? <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />}
                <span>{waTestResult.message}</span>
              </div>
            )}
          </div>

          {/* Supabase Cloud Database & Backend Integration */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-inner">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Supabase Cloud Database & Backend (PostgreSQL)
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                      Cloud DB & Auth
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Penyimpanan cloud terpusat untuk Data Produk, Transaksi POS Kasir, Akun Pelanggan CRM, dan Webhook Bot.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSqlModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500/15 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
              >
                <FileCode className="w-4 h-4 text-emerald-500" />
                Skrip SQL Schema Supabase
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supabase Project URL (API URL)
                </label>
                <input
                  type="text"
                  value={supabaseUrlInput}
                  onChange={(e) => setSupabaseUrlInput(e.target.value)}
                  placeholder="https://abcdefghijklmn.supabase.co"
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Dapat ditemukan di dashboard Supabase: <strong>Project Settings &gt; API &gt; Project URL</strong>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supabase Anon / Public API Key (Client & Web)
                </label>
                <div className="relative">
                  <input
                    type={showSupabaseKey ? 'text' : 'password'}
                    value={supabaseAnonKeyInput}
                    onChange={(e) => setSupabaseAnonKeyInput(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full pr-10 pl-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSupabaseKey(!showSupabaseKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showSupabaseKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  🔑 Salin dari: <strong>Project Settings &gt; API &gt; API Keys &gt; anon public</strong> (diawali <code>eyJ...</code>).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Service Role Key (Opsional / Admin Backend)
                </label>
                <div className="relative">
                  <input
                    type={showSupabaseServiceKey ? 'text' : 'password'}
                    value={supabaseServiceRoleKeyInput}
                    onChange={(e) => setSupabaseServiceRoleKeyInput(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full pr-10 pl-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSupabaseServiceKey(!showSupabaseServiceKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showSupabaseServiceKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  🔒 Salin dari: <strong>Project Settings &gt; API &gt; API Keys &gt; service_role</strong>.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestSupabase}
                  disabled={testingSupabase}
                  className="px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {testingSupabase ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-emerald-500" />}
                  Uji Koneksi Supabase Cloud
                </button>
              </div>

              <span className="text-[11px] text-slate-400">
                💡 <em>Data otomatis tersinkronisasi dua arah saat online.</em>
              </span>
            </div>

            {supabaseTestResult && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  supabaseTestResult.success
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                }`}
              >
                {supabaseTestResult.success ? <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />}
                <span>{supabaseTestResult.message}</span>
              </div>
            )}
          </div>

          {/* Save Button for API Keys */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveApiKeys}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              Simpan & Terapkan Semua Konfigurasi
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: WEBHOOK LOGS & SYNC MONITOR */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          {/* Active Webhook URL Banner & Quick Copy */}
          <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-3xl p-5 sm:p-6 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">
                      Link / URL Webhook WhatsApp Aktif
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40">
                      🟢 SIAP DIGUNAKAN
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Tempel tautan ini ke pengaturan Webhook di dashboard gateway Anda (Wablas, Fonnte, WhaCenter, dll).
                  </p>
                </div>
              </div>
            </div>

            {/* URL Box */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-950/80 p-2 rounded-2xl border border-slate-800">
              <input
                type="text"
                readOnly
                value={typeof window !== 'undefined' ? `${window.location.origin}/api/whatsapp/webhook` : 'https://your-domain.com/api/whatsapp/webhook'}
                className="w-full px-3.5 py-2.5 text-xs bg-transparent outline-none text-emerald-400 font-mono select-all font-bold tracking-wide"
              />
              <button
                type="button"
                onClick={() => {
                  const url = typeof window !== 'undefined' ? `${window.location.origin}/api/whatsapp/webhook` : '/api/whatsapp/webhook';
                  navigator.clipboard.writeText(url);
                  success('Link Webhook Disalin', 'URL Webhook WhatsApp berhasil disalin ke clipboard!');
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer shadow-lg shadow-emerald-950/50"
              >
                <Copy className="w-4 h-4" />
                Salin Link Webhook
              </button>
            </div>

            {/* Quick Testing Actions */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Uji Cepat Simulasi Webhook (Tanpa Aplikasi Eksternal):
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={sendingDummyWebhook}
                    onClick={() => handleSendDummyWebhook('product')}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    📦 Uji Tambah Produk
                  </button>
                  <button
                    type="button"
                    disabled={sendingDummyWebhook}
                    onClick={() => handleSendDummyWebhook('stock')}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    📈 Uji Tambah Stok
                  </button>
                  <button
                    type="button"
                    disabled={sendingDummyWebhook}
                    onClick={() => handleSendDummyWebhook('check')}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    🔍 Uji Cek !stok
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Live Log Console */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-500" />
                  Live Webhook Console & Message Logs
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    Auto-Refresh Realtime (2s)
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Riwayat pesan WhatsApp yang masuk ke backend server secara live dan tercatat otomatis.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearWebhookLogs}
                  disabled={logs.length === 0}
                  className="px-3 py-2 text-xs font-bold rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 flex items-center gap-1.5 transition-colors cursor-pointer border border-rose-500/30 disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Bersihkan Log
                </button>
                <button
                  type="button"
                  onClick={fetchWebhookLogs}
                  disabled={loadingLogs}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-500/20 flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                  Segarkan Log
                </button>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto max-h-96 custom-scrollbar border border-slate-800">
              <div className="text-slate-500 mb-2 border-b border-slate-800 pb-2 flex items-center justify-between">
                <span>// Server Webhook Listener Active on /api/whatsapp/webhook</span>
                <span className="text-[10px] text-slate-400 font-bold">{logs.length} Log Tercatat</span>
              </div>
              {logs.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <p className="text-slate-400 font-mono">
                    // Belum ada log pesan webhook. Kirim pesan WhatsApp atau klik tombol "Uji Tambah Produk" di atas.
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Setiap pesan yang dikirim ke nomor bot Anda via Webhook akan otomatis muncul di sini.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {logs.map((log, i) => (
                    <div key={log.id || i} className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-amber-300">
                            {log.time || new Date().toLocaleTimeString()}
                          </span>
                          <span className="text-blue-400 font-bold text-[11px]">
                            📱 {log.sender || 'WhatsApp'}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'success'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : log.status === 'error'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {log.status === 'success' ? '✓ BERHASIL' : log.status === 'error' ? '✕ ERROR' : 'ℹ DIABAIKAN'}
                        </span>
                      </div>
                      <div className="text-slate-100 bg-slate-950 p-2 rounded-lg border border-slate-800/80 font-mono text-[11px] break-all">
                        {log.messageText || log.rawMessage || JSON.stringify(log)}
                      </div>
                      {log.actionTaken && (
                        <div className="text-[11px] text-emerald-400 font-sans flex items-center gap-1.5">
                          <span>↳</span> <span className="font-semibold">{log.actionTaken}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Guide Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-emerald-500" />
                Format Perintah WhatsApp yang Didukung Bot Kasir:
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[11px]">
                  <strong className="text-slate-800 dark:text-slate-200">1. Tambah / Update Produk:</strong>
                  <p className="text-emerald-600 dark:text-emerald-400 mt-0.5">
                    PRODUK#Nama#Kategori#HargaBeli#HargaJual#Stok#Satuan#MinStok
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[11px]">
                  <strong className="text-slate-800 dark:text-slate-200">2. Tambah Stok Barang Saja:</strong>
                  <p className="text-emerald-600 dark:text-emerald-400 mt-0.5">
                    STOK#NamaProduk#JumlahTambah (cth: STOK#Minyak 2L#20)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT CRM USER ACCOUNT */}
      {/* ========================================================================= */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" />
                {editingUser?.id ? 'Edit Akun Pelanggan' : 'Buat Akun Pelanggan Baru'}
              </h3>
              <button
                onClick={() => {
                  setIsUserModalOpen(false);
                  setEditingUser(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUserSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Pemilik Toko
                </label>
                <input
                  type="text"
                  value={editingUser?.namaPemilik || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, namaPemilik: e.target.value })}
                  placeholder="Contoh: Haji Budi Santoso"
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Toko / Usaha
                </label>
                <input
                  type="text"
                  value={editingUser?.namaToko || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, namaToko: e.target.value })}
                  placeholder="Contoh: Toko Berkah Sembako Utama"
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    No. WhatsApp / HP
                  </label>
                  <input
                    type="text"
                    value={editingUser?.noHp || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, noHp: e.target.value })}
                    placeholder="081234567890"
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Pengguna
                  </label>
                  <input
                    type="email"
                    value={editingUser?.email || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    placeholder="toko@gmail.com"
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              {/* Password Form Input */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-500" />
                    Password Akun Pelanggan
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const newPass = 'sembako' + Math.floor(1000 + Math.random() * 9000);
                      setEditingUser({ ...editingUser, password: newPass });
                    }}
                    className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Generate Acak
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showUserPassword ? 'text' : 'password'}
                    value={editingUser?.password || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                    placeholder="Contoh: sembako123"
                    className="w-full p-2.5 pr-10 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-mono tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUserPassword(!showUserPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                    title={showUserPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Password ini akan digunakan oleh pelanggan/pemilik toko untuk login ke sistem POS.
                </p>
              </div>

              {/* Role & Hak Akses Akun */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
                    Role & Hak Akses Akun
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Pilih wewenang akses akun
                  </span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    {
                      id: 'developer',
                      label: 'Developer',
                      sub: 'Super Admin CRM',
                      badge: 'Full Dev',
                      color: 'border-purple-500/40 text-purple-600 dark:text-purple-300 bg-purple-500/10',
                      activeColor: 'ring-2 ring-purple-500 bg-purple-500/20 font-bold',
                    },
                    {
                      id: 'owner',
                      label: 'Owner Toko',
                      sub: 'Akses Penuh POS',
                      badge: 'Owner',
                      color: 'border-amber-500/40 text-amber-600 dark:text-amber-300 bg-amber-500/10',
                      activeColor: 'ring-2 ring-amber-500 bg-amber-500/20 font-bold',
                    },
                    {
                      id: 'admin',
                      label: 'Admin Toko',
                      sub: 'Kelola Stok/Barang',
                      badge: 'Admin',
                      color: 'border-blue-500/40 text-blue-600 dark:text-blue-300 bg-blue-500/10',
                      activeColor: 'ring-2 ring-blue-500 bg-blue-500/20 font-bold',
                    },
                    {
                      id: 'kasir',
                      label: 'Kasir POS',
                      sub: 'Kasir & Transaksi',
                      badge: 'Kasir',
                      color: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-300 bg-emerald-500/10',
                      activeColor: 'ring-2 ring-emerald-500 bg-emerald-500/20 font-bold',
                    },
                  ].map((r) => {
                    const isSelected = (editingUser?.role || 'owner') === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setEditingUser({ ...editingUser, role: r.id as any })}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? `${r.activeColor} ${r.color} shadow-sm`
                            : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold">{r.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </div>
                        <span className="text-[10px] opacity-80 leading-tight">{r.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pilihan Paket / Plan
                  </label>
                  <select
                    value={editingUser?.plan || 'pro_lifetime'}
                    onChange={(e) => setEditingUser({ ...editingUser, plan: e.target.value as any })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                  >
                    <option value="pro_lifetime">Pro Lifetime (Rp 99rb Sekali Bayar)</option>
                    <option value="trial_6h">Trial 6 Jam</option>
                    <option value="enterprise">Enterprise Multi-Cabang</option>
                    <option value="custom">Custom Plan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status Akun
                  </label>
                  <select
                    value={editingUser?.status || 'aktif'}
                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as any })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                  >
                    <option value="aktif">Aktif</option>
                    <option value="suspended">Suspended (Dibekukan)</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Batas Perangkat (Device Limit)
                  </label>
                  <input
                    type="number"
                    value={editingUser?.deviceLimit || 3}
                    onChange={(e) => setEditingUser({ ...editingUser, deviceLimit: Number(e.target.value) })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Kode Lisensi Resmi
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const prefix = editingUser?.plan === 'trial_6h' ? 'TRL' : editingUser?.plan === 'enterprise' ? 'ENT' : 'PRO';
                        const newLicense = `SBK-${prefix}-${Math.floor(1000 + Math.random() * 9000)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                        setEditingUser({ ...editingUser, licenseKey: newLicense });
                      }}
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      Generate Acak
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={editingUser?.licenseKey || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, licenseKey: e.target.value })}
                      placeholder="Auto-generated jika kosong"
                      className="w-full p-2.5 pr-24 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white font-mono tracking-wider"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const prefix = editingUser?.plan === 'trial_6h' ? 'TRL' : editingUser?.plan === 'enterprise' ? 'ENT' : 'PRO';
                        const newLicense = `SBK-${prefix}-${Math.floor(1000 + Math.random() * 9000)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                        setEditingUser({ ...editingUser, licenseKey: newLicense });
                      }}
                      className="absolute right-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-[10px] font-bold flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                      title="Klik untuk generate kode lisensi resmi instan"
                    >
                      <Key className="w-3 h-3" />
                      <span>Generate</span>
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Catatan Pengembang (Notes)
                </label>
                <input
                  type="text"
                  value={editingUser?.notes || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, notes: e.target.value })}
                  placeholder="Contoh: Pembayaran transfer BCA Rp 99.000"
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserModalOpen(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md cursor-pointer"
                >
                  Simpan Akun Pelanggan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT VIDEO SHOWCASE */}
      {/* ========================================================================= */}
      {isVideoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Video className="w-4 h-4 text-rose-500" />
                Tambah / Edit Video Tutorial
              </h3>
              <button
                onClick={() => {
                  setIsVideoModalOpen(false);
                  setEditingVideo(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Judul Video Tutorial
                </label>
                <input
                  type="text"
                  value={editingVideo?.title || ''}
                  onChange={(e) => setEditingVideo({ ...editingVideo, title: e.target.value })}
                  placeholder="Contoh: Tutorial POS Kasir & Struk Bluetooth"
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  URL Video YouTube (Embed atau Share URL)
                </label>
                <input
                  type="text"
                  value={editingVideo?.videoUrl || ''}
                  onChange={(e) => {
                    let url = e.target.value;
                    // Format youtube watch url to embed url if needed
                    if (url.includes('watch?v=')) {
                      url = url.replace('watch?v=', 'embed/');
                    } else if (url.includes('youtu.be/')) {
                      url = url.replace('youtu.be/', 'www.youtube.com/embed/');
                    }
                    setEditingVideo({ ...editingVideo, videoUrl: url });
                  }}
                  placeholder="https://www.youtube.com/embed/..."
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Deskripsi Singkat
                </label>
                <textarea
                  rows={2}
                  value={editingVideo?.description || ''}
                  onChange={(e) => setEditingVideo({ ...editingVideo, description: e.target.value })}
                  placeholder="Penjelasan isi tutorial..."
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsVideoModalOpen(false);
                    setEditingVideo(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!editingVideo?.title || !editingVideo?.videoUrl) {
                      warning('Isi Judul & URL', 'Judul dan link video wajib diisi.');
                      return;
                    }
                    const newVideoItem: VideoShowcaseItem = {
                      id: editingVideo.id || `vid-${Date.now()}`,
                      title: editingVideo.title || '',
                      description: editingVideo.description || '',
                      videoUrl: editingVideo.videoUrl || '',
                      thumbnailUrl: editingVideo.thumbnailUrl || 'https://images.unsplash.com/photo-1556742049-0a67e557224f?q=80&w=800&auto=format&fit=crop',
                      isFeatured: !!editingVideo.isFeatured,
                      platform: 'youtube',
                    };

                    const existingIdx = cmsDraft.media.videos.findIndex(v => v.id === newVideoItem.id);
                    let updatedVideos = [...cmsDraft.media.videos];
                    if (existingIdx >= 0) {
                      updatedVideos[existingIdx] = newVideoItem;
                    } else {
                      updatedVideos.unshift(newVideoItem);
                    }

                    setCmsDraft({
                      ...cmsDraft,
                      media: { ...cmsDraft.media, videos: updatedVideos }
                    });
                    setIsVideoModalOpen(false);
                    setEditingVideo(null);
                    success('Video Ditambahkan', 'Jangan lupa klik "Simpan & Broadcast" agar tampil di landing page.');
                  }}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-md cursor-pointer"
                >
                  Tambahkan ke CMS
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SUPABASE SQL SCHEMA MIGRATION SCRIPT */}
      {/* ========================================================================= */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Skrip SQL Schema Supabase (PostgreSQL)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tabel: products, transactions, crm_users, webhook_logs, remote_config
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 space-y-1.5 leading-relaxed">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Petunjuk Pemasangan di Supabase:
                </p>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] text-slate-700 dark:text-slate-300">
                  <li>Buka dashboard project Anda di <strong>https://supabase.com/dashboard</strong></li>
                  <li>Pilih menu <strong>SQL Editor</strong> pada bilah navigasi kiri.</li>
                  <li>Klik <strong>New Query</strong>, lalu tempel (<em>paste</em>) kode SQL di bawah ini.</li>
                  <li>Klik tombol hijau <strong>Run</strong> untuk membuat seluruh tabel &amp; index secara instan.</li>
                </ol>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-emerald-500" />
                    SQL Schema Script
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
                      success('Skrip SQL Disalin', 'Seluruh perintah SQL Schema berhasil disalin ke clipboard!');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Salin SQL Schema
                  </button>
                </div>
                <pre className="p-4 rounded-2xl bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto max-h-72 select-all border border-slate-800 leading-relaxed">
                  {SUPABASE_SCHEMA_SQL}
                </pre>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
                  success('Skrip SQL Disalin', 'Seluruh perintah SQL Schema berhasil disalin ke clipboard!');
                  setIsSqlModalOpen(false);
                }}
                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                Salin &amp; Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
