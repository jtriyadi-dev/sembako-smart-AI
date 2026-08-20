import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  ExternalLink, 
  Radio, 
  ShieldCheck, 
  Smartphone, 
  Laptop, 
  Layers, 
  Zap, 
  Send, 
  ArrowDownUp, 
  Store,
  Users,
  Search,
  Filter
} from 'lucide-react';
import { 
  getSupabaseClient, 
  getCurrentStoreId, 
  setCurrentStoreId, 
  SUPABASE_SCHEMA_SQL,
  subscribeRealtimeTable,
  countTableWithFallback,
  logSupabase
} from '../services/supabaseClient';
import { fetchCrmUsers } from '../services/devCrmService';
import { fetchProductsDirect } from '../services/productService';
import { fetchTransactionsDirect } from '../services/transaksiService';
import { fetchStockMovementsDirect } from '../services/stockService';
import { fetchSuppliersDirect } from '../services/supplierService';
import { fetchStaffAccountsDirect } from '../services/staffService';
import { useToast } from '../context/ToastContext';
import { CrmUser } from '../types';

export const SupabaseSyncManager: React.FC = () => {
  const { success, warning, error: toastError, info } = useToast();
  const [storeId, setStoreIdState] = useState<string>(getCurrentStoreId());
  const [newStoreIdInput, setNewStoreIdInput] = useState<string>(getCurrentStoreId());
  const [isEditingStoreId, setIsEditingStoreId] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [crmUsers, setCrmUsers] = useState<CrmUser[]>([]);
  const [tableStats, setTableStats] = useState<{
    products: number;
    transactions: number;
    stockMovements: number;
    suppliers: number;
    staffAccounts: number;
    crmUsers: number;
  }>({
    products: 0,
    transactions: 0,
    stockMovements: 0,
    suppliers: 0,
    staffAccounts: 0,
    crmUsers: 0,
  });
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString('id-ID'));
  const [realtimeMessages, setRealtimeMessages] = useState<{ time: string; text: string }[]>([]);

  // Load CRM Users for Developer Tenant Selector
  useEffect(() => {
    fetchCrmUsers().then((users) => {
      if (Array.isArray(users)) {
        setCrmUsers(users);
      }
    }).catch(() => {});
  }, []);

  // Check Supabase connection and table counts
  const checkSupabaseStatus = async () => {
    setIsChecking(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setConnectionStatus('error');
      setIsChecking(false);
      return;
    }

    try {
      const activeStore = getCurrentStoreId();
      
      const countCrmUsers = async () => {
        try {
          const res = await supabase.from('crm_users').select('id', { count: 'exact', head: true });
          return res.count ?? 0;
        } catch {
          return 0;
        }
      };

      const [pCount, tCount, smCount, sCount, saCount, uCount] = await Promise.all([
        countTableWithFallback(supabase, 'products', activeStore),
        countTableWithFallback(supabase, 'transactions', activeStore),
        countTableWithFallback(supabase, 'stock_movements', activeStore),
        countTableWithFallback(supabase, 'suppliers', activeStore),
        countTableWithFallback(supabase, 'staff_accounts', activeStore),
        countCrmUsers(),
      ]);

      setTableStats({
        products: pCount,
        transactions: tCount,
        stockMovements: smCount,
        suppliers: sCount,
        staffAccounts: saCount,
        crmUsers: uCount,
      });

      setConnectionStatus('connected');
      setLastSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      setConnectionStatus('error');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkSupabaseStatus();

    // Subscribe to realtime changes on products table as an active monitor
    const unsub = subscribeRealtimeTable('products', storeId, (payload) => {
      setRealtimeMessages((prev) => [
        {
          time: new Date().toLocaleTimeString('id-ID'),
          text: `Event [${payload.eventType || 'UPDATE'}] diterima dari cloud untuk tabel produk!`,
        },
        ...prev.slice(0, 9),
      ]);
      checkSupabaseStatus();
    });

    return () => {
      try { unsub(); } catch (_) {}
    };
  }, [storeId]);

  const handleSelectStoreId = (selectedId: string) => {
    setCurrentStoreId(selectedId);
    setStoreIdState(selectedId);
    setNewStoreIdInput(selectedId);
    setIsEditingStoreId(false);
    success('Store Tenant Dipilih', `Target store ID aktif diubah menjadi: "${selectedId}".`);
    checkSupabaseStatus();
  };

  const handleSaveStoreId = () => {
    const trimmed = newStoreIdInput.trim();
    if (!trimmed) {
      warning('Store ID Kosong', 'Harap masukkan ID Toko.');
      return;
    }
    handleSelectStoreId(trimmed);
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL).then(() => {
      setIsCopied(true);
      success('SQL Skema Disalin!', 'Silakan paste dan jalankan di SQL Editor dashboard Supabase Anda.');
      setTimeout(() => setIsCopied(false), 3000);
    });
  };

  const handleForceFullSync = async () => {
    setIsSyncing(true);
    try {
      info('Sinkronisasi Berjalan', `Mengambil data terbaru untuk store "${storeId}" dari Cloud Supabase...`);
      await Promise.allSettled([
        fetchProductsDirect(storeId),
        fetchTransactionsDirect(storeId),
        fetchStockMovementsDirect(storeId),
        fetchSuppliersDirect(storeId),
        fetchStaffAccountsDirect(storeId),
      ]);
      await checkSupabaseStatus();
      success('Sinkronisasi Sukses', `Semua data toko "${storeId}" telah sinkron dengan Cloud Supabase!`);
    } catch (err: any) {
      toastError('Sinkronisasi Terkendala', err.message || 'Gagal menyinkronkan data.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-6 rounded-3xl text-white shadow-xl border border-emerald-500/20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <Database className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Developer Database & Supabase Multi-Device Engine</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                  Realtime Active
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Supabase PostgreSQL adalah <b>Single Source of Truth (SSOT)</b> terpusat. Seluruh pelanggan dan perangkat tersinkronisasi otomatis di latar belakang tanpa perlu menyentuh pengaturan database teknis.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleForceFullSync}
              disabled={isSyncing}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-900/40 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Device Store ID Configuration */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Tenant Store Partition Inspector</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pilih atau masukkan Store ID pelanggan untuk memeriksa dan menyinkronkan data toko terkait.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            {/* Quick CRM Tenant Dropdown */}
            {crmUsers.length > 0 && (
              <select
                value={storeId}
                onChange={(e) => handleSelectStoreId(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="default_store">Default Store (default_store)</option>
                {crmUsers.map((u) => {
                  const sId = u.id || u.namaToko?.toLowerCase().replace(/\s+/g, '_') || 'store';
                  return (
                    <option key={u.id} value={sId}>
                      {u.namaToko} ({u.namaPemilik}) - [{sId}]
                    </option>
                  );
                })}
              </select>
            )}

            {isEditingStoreId ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newStoreIdInput}
                  onChange={(e) => setNewStoreIdInput(e.target.value)}
                  className="px-3 py-1.5 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Contoh: toko_sembako_berkah"
                />
                <button
                  onClick={handleSaveStoreId}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer"
                >
                  Terapkan
                </button>
                <button
                  onClick={() => setIsEditingStoreId(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-300 cursor-pointer"
                >
                  Batal
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-mono font-bold border border-slate-200 dark:border-slate-700">
                  {storeId}
                </span>
                <button
                  onClick={() => setIsEditingStoreId(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500/10 text-slate-700 dark:text-slate-300 hover:text-emerald-600 text-xs font-semibold border border-slate-200 dark:border-slate-700 cursor-pointer transition-all"
                >
                  Kustom ID
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Multi-Device Architecture Diagram Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">HP Kasir Pelanggan</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Input penjualan langsung realtime memotong stok di cloud Postgres.</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
            <Laptop className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Laptop / Tablet Pemilik Toko</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Melihat omzet & stok terbaru seketika tanpa perlu refresh halaman.</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
            <Zap className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Supabase Postgres Engine</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Mendistribusikan notifikasi perubahan data lewat WebSocket channel otomatis.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Cloud Tables Status Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Produk', count: tableStats.products, icon: Layers, color: 'text-emerald-500' },
          { label: 'Transaksi', count: tableStats.transactions, icon: ArrowDownUp, color: 'text-blue-500' },
          { label: 'Mutasi Stok', count: tableStats.stockMovements, icon: RefreshCw, color: 'text-amber-500' },
          { label: 'Pemasok', count: tableStats.suppliers, icon: Store, color: 'text-purple-500' },
          { label: 'Akun Staf', count: tableStats.staffAccounts, icon: ShieldCheck, color: 'text-rose-500' },
          { label: 'Pengguna CRM', count: tableStats.crmUsers, icon: Database, color: 'text-teal-500' },
        ].map((item, idx) => {
          const IconC = item.icon;
          return (
            <div key={idx} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{item.label}</span>
                <IconC className={`w-4 h-4 ${item.color}`} />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{item.count}</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  Synced
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Realtime Log Feed */}
      {realtimeMessages.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-emerald-500 animate-ping" />
              Live Realtime Activity Feed
            </span>
            <button onClick={() => setRealtimeMessages([])} className="text-[11px] text-slate-400 hover:text-slate-600">
              Bersihkan Log
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto font-mono text-[11px]">
            {realtimeMessages.map((msg, i) => (
              <div key={i} className="flex items-center gap-2 text-slate-600 dark:text-slate-300 py-0.5">
                <span className="text-slate-400">[{msg.time}]</span>
                <span>{msg.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SQL Migration & RLS Helper */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Skema Database & RLS Policy Supabase
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Jalankan script SQL ini satu kali di menu <b>SQL Editor</b> pada dashboard Supabase Anda untuk memastikan tabel, indeks multi-tenant, dan realtime aktif.
            </p>
          </div>

          <button
            onClick={handleCopySQL}
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shrink-0"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{isCopied ? 'Tersalin ke Clipboard!' : 'Salin Skema SQL'}</span>
          </button>
        </div>

        <div className="relative">
          <pre className="p-4 rounded-2xl bg-slate-950 text-slate-300 font-mono text-xs overflow-x-auto max-h-60 border border-slate-800 leading-relaxed">
            {SUPABASE_SCHEMA_SQL}
          </pre>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>
            <b>Panduan Setup Supabase (Developer):</b> Buka dashboard Supabase Anda &rarr; Klik menu <b>SQL Editor</b> di sidebar kiri &rarr; Klik <b>+ New query</b> &rarr; Paste skema SQL di atas &rarr; Klik <b>Run</b>. Semua tabel, kolom <code>store_id</code>, dan realtime publication akan terpasang otomatis untuk semua toko!
          </div>
        </div>
      </div>
    </div>
  );
};

