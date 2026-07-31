import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Modal } from '../Modal';
import { formatRupiah } from '../../utils/formatters';
import { useStore } from '../../context/StoreContext';
import { getAccentTheme } from '../../utils/themeUtils';
import {
  DollarSign,
  QrCode,
  CreditCard,
  Receipt,
  CheckCircle2,
  Copy,
  Check,
  Building2,
  User,
  Calendar,
  AlertCircle,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotal: number;
  diskonTotal: number;
  pajakNominal: number;
  totalHarga: number;
  itemCount: number;
  onConfirmPayment: (paymentDetails: {
    metodePembayaran: 'tunai' | 'qris' | 'transfer' | 'hutang';
    bayar: number;
    kembalian: number;
    bankNama?: string;
    noReferensi?: string;
    namaPelanggan?: string;
    catatan?: string;
  }) => Promise<void>;
}

const BANK_ACCOUNTS = [
  { id: 'bca', name: 'Bank BCA', noAcc: '8830-1928-33', nameAcc: 'TOKO SEMBAKO BERKAH' },
  { id: 'mandiri', name: 'Bank Mandiri', noAcc: '137-00-98213-44', nameAcc: 'TOKO SEMBAKO BERKAH' },
  { id: 'bri', name: 'Bank BRI', noAcc: '0206-01-002931-53', nameAcc: 'TOKO SEMBAKO BERKAH' },
  { id: 'bni', name: 'Bank BNI', noAcc: '0912-8371-22', nameAcc: 'TOKO SEMBAKO BERKAH' },
];

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  subtotal,
  diskonTotal,
  pajakNominal,
  totalHarga,
  itemCount,
  onConfirmPayment,
}) => {
  const { storeConfig } = useStore();
  const accent = getAccentTheme(storeConfig.accentColor);

  const [metode, setMetode] = useState<'tunai' | 'qris' | 'transfer' | 'hutang'>('tunai');
  const [jumlahBayarInput, setJumlahBayarInput] = useState<string>('');
  const [selectedBank, setSelectedBank] = useState<string>('bca');
  const [noReferensi, setNoReferensi] = useState<string>('');
  const [namaPelanggan, setNamaPelanggan] = useState<string>('Pelanggan Umum');
  const [catatan, setCatatan] = useState<string>('');
  const [copiedBank, setCopiedBank] = useState(false);
  const [qrisVerified, setQrisVerified] = useState(false);
  const [isVerifyingQris, setIsVerifyingQris] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qrisTimer, setQrisTimer] = useState(300); // 5 minutes timer

  // Auto-fill cash when modal opens or total changes
  useEffect(() => {
    if (isOpen) {
      setJumlahBayarInput(totalHarga.toString());
      setQrisVerified(false);
      setCopiedBank(false);
      setQrisTimer(300);
    }
  }, [isOpen, totalHarga]);

  // QRIS timer countdown
  useEffect(() => {
    let interval: any;
    if (isOpen && metode === 'qris' && qrisTimer > 0 && !qrisVerified) {
      interval = setInterval(() => {
        setQrisTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isOpen, metode, qrisTimer, qrisVerified]);

  const numericBayar = Number(jumlahBayarInput) || 0;
  const kembalian = Math.max(0, numericBayar - totalHarga);
  const isSufficient = metode === 'tunai' ? numericBayar >= totalHarga : true;

  const quickNominals = [
    { label: 'Uang Pas', value: totalHarga },
    { label: '10 Ribu', value: 10000 },
    { label: '20 Ribu', value: 20000 },
    { label: '50 Ribu', value: 50000 },
    { label: '100 Ribu', value: 100000 },
    { label: '200 Ribu', value: 200000 },
  ].filter((n) => n.value >= totalHarga || n.label === 'Uang Pas');

  const handleSimulateQrisScan = () => {
    setIsVerifyingQris(true);
    setTimeout(() => {
      setIsVerifyingQris(false);
      setQrisVerified(true);
    }, 1200);
  };

  const handleCopyAccount = (accNo: string) => {
    navigator.clipboard.writeText(accNo);
    setCopiedBank(true);
    setTimeout(() => setCopiedBank(false), 2000);
  };

  const handleSubmit = async () => {
    if (!isSufficient) return;

    try {
      setIsSubmitting(true);
      const bankObj = BANK_ACCOUNTS.find((b) => b.id === selectedBank);
      await onConfirmPayment({
        metodePembayaran: metode,
        bayar: metode === 'tunai' ? numericBayar : totalHarga,
        kembalian: metode === 'tunai' ? kembalian : 0,
        bankNama: metode === 'transfer' ? (bankObj?.name || '') : '',
        noReferensi: metode === 'transfer' ? (noReferensi || '') : '',
        namaPelanggan: namaPelanggan.trim() || 'Pelanggan Umum',
        catatan: catatan.trim() || '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Proses Pembayaran Kasir"
      subtitle={`Total ${itemCount} Item: ${formatRupiah(totalHarga)}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Total Summary Header */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white border border-emerald-500/30 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">
              Total Tagihan Pelanggan
            </p>
            <h3 className="text-2xl font-black text-amber-400 mt-0.5">
              {formatRupiah(totalHarga)}
            </h3>
            {diskonTotal > 0 && (
              <span className="text-[11px] text-emerald-400">
                (Hemat Diskon: {formatRupiah(diskonTotal)})
              </span>
            )}
          </div>

          <div className="text-right text-xs text-slate-300 space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Subtotal:</span>
              <span>{formatRupiah(subtotal)}</span>
            </div>
            {pajakNominal > 0 && (
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Pajak:</span>
                <span>{formatRupiah(pajakNominal)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Payment Method Selector Tabs */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Pilih Metode Pembayaran
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { id: 'tunai', label: 'Tunai / Cash', icon: DollarSign, badge: 'Paling Cepat' },
              { id: 'qris', label: 'QRIS Scan', icon: QrCode, badge: 'Instant' },
              { id: 'transfer', label: 'Transfer Bank', icon: CreditCard, badge: 'Virtual Acc' },
              { id: 'hutang', label: 'Bon / Hutang', icon: Receipt, badge: 'Tempo' },
            ].map((m) => {
              const Icon = m.icon;
              const isSel = metode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMetode(m.id as any)}
                  className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                    isSel
                      ? 'bg-amber-500/15 border-amber-500 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold shadow-md'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${isSel ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold truncate">{m.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">{m.badge}</span>
                  {isSel && (
                    <motion.div
                      layoutId="activeTabGlow"
                      className="absolute inset-0 border-2 border-amber-500 rounded-2xl pointer-events-none"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Method Specific Panels */}
        <AnimatePresence mode="wait">
          {/* 1. TUNAI / CASH */}
          {metode === 'tunai' && (
            <motion.div
              key="tunai"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nominal Uang Diterima dari Pembeli (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 font-bold text-sm text-slate-400">Rp</span>
                  <input
                    type="number"
                    value={jumlahBayarInput}
                    onChange={(e) => setJumlahBayarInput(e.target.value)}
                    placeholder="Masukkan nominal bayar..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-lg font-black text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Quick Nominal Chips */}
              <div>
                <span className="text-[11px] text-slate-500 font-medium block mb-1.5">
                  Nominal Cepat:
                </span>
                <div className="flex flex-wrap gap-2">
                  {quickNominals.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setJumlahBayarInput(item.value.toString())}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all cursor-pointer shadow-sm"
                    >
                      {item.label === 'Uang Pas' ? 'Uang Pas' : formatRupiah(item.value)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Change calculation badge */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                  isSufficient
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isSufficient ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  )}
                  <div>
                    <p className="text-xs font-bold">
                      {isSufficient ? 'Kembalian Pembeli:' : 'Uang Kurang:'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isSufficient
                        ? 'Nominal bayar mencukupi total tagihan.'
                        : `Kurang ${formatRupiah(totalHarga - numericBayar)} lagi.`}
                    </p>
                  </div>
                </div>

                <span className="text-xl font-black font-mono">
                  {isSufficient ? formatRupiah(kembalian) : formatRupiah(totalHarga - numericBayar)}
                </span>
              </div>
            </motion.div>
          )}

          {/* 2. QRIS SCAN */}
          {metode === 'qris' && (
            <motion.div
              key="qris"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                <QrCode className="w-3.5 h-3.5" />
                <span>QRIS Standard Indonesia (GPN)</span>
              </div>

              {/* QR Code Graphic Display */}
              <div className="flex flex-col items-center justify-center">
                <div className="p-4 bg-white rounded-2xl border-4 border-slate-900 shadow-2xl relative">
                  {/* Simulated SVG QR Code */}
                  <svg className="w-44 h-44 text-slate-900" viewBox="0 0 100 100" fill="currentColor">
                    <path d="M0,0 h30 v30 h-30 z M5,5 v20 h20 v-20 z M10,10 h10 v10 h-10 z" />
                    <path d="M70,0 h30 v30 h-30 z M75,5 v20 h20 v-20 z M80,10 h10 v10 h-10 z" />
                    <path d="M0,70 h30 v30 h-30 z M5,75 v20 h20 v-20 z M10,80 h10 v10 h-10 z" />
                    <rect x="35" y="5" width="10" height="20" />
                    <rect x="50" y="15" width="15" height="10" />
                    <rect x="35" y="35" width="30" height="30" />
                    <rect x="70" y="35" width="25" height="10" />
                    <rect x="75" y="50" width="10" height="25" />
                    <rect x="35" y="70" width="15" height="25" />
                    <rect x="55" y="75" width="20" height="20" />
                    <rect x="80" y="80" width="15" height="15" />
                  </svg>

                  {/* QRIS Logo Center Badge */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="px-2 py-0.5 rounded bg-emerald-700 text-white font-black text-[10px] shadow-md border border-white">
                      QRIS
                    </span>
                  </div>
                </div>

                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-3">
                  TOKO SEMBAKO BERKAH SMART
                </p>
                <p className="text-[11px] text-slate-400">NMID: ID1020267129381</p>
              </div>

              {/* Status & Verification Toggle */}
              {qrisVerified ? (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Pembayaran QRIS Berhasil Terverifikasi Instant!</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center justify-center gap-1.5">
                    <span>Berlaku hingga: {formatTime(qrisTimer)}</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSimulateQrisScan}
                    disabled={isVerifyingQris}
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                  >
                    {isVerifyingQris ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Mengecek Status Pembayaran...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-slate-950" />
                        <span>Simulasi Konfirmasi Scan QRIS Buyer</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* 3. TRANSFER BANK */}
          {metode === 'transfer' && (
            <motion.div
              key="transfer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Pilih Bank Tujuan Transfer
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {BANK_ACCOUNTS.map((bank) => (
                    <button
                      key={bank.id}
                      type="button"
                      onClick={() => setSelectedBank(bank.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        selectedBank === bank.id
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs">{bank.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Bank Details Card */}
              {(() => {
                const b = BANK_ACCOUNTS.find((item) => item.id === selectedBank);
                if (!b) return null;
                return (
                  <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Nomor Rekening {b.name}:</span>
                      <button
                        type="button"
                        onClick={() => handleCopyAccount(b.noAcc)}
                        className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-[10px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedBank ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedBank ? 'Tercopy' : 'Copy'}</span>
                      </button>
                    </div>

                    <p className="text-lg font-mono font-black text-emerald-600 dark:text-emerald-400">
                      {b.noAcc}
                    </p>
                    <p className="text-xs text-slate-500">a.n {b.nameAcc}</p>
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nomor Referensi Transfer / M-Banking (Opsional)
                </label>
                <input
                  type="text"
                  value={noReferensi}
                  onChange={(e) => setNoReferensi(e.target.value)}
                  placeholder="Contoh: REF-20260728-1982"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </motion.div>
          )}

          {/* 4. HUTANG / BON PELANGGAN */}
          {metode === 'hutang' && (
            <motion.div
              key="hutang"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-5 bg-amber-500/10 rounded-2xl border border-amber-500/30 space-y-4"
            >
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-bold">
                <Receipt className="w-4 h-4 text-amber-600" />
                <span>Pencatatan Bon / Hutang Pelanggan</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Transaksi ini akan disimpan dengan status <strong>Belum Lunas</strong>. Pastikan
                mencatat nama pelanggan dengan benar.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Pelanggan Peminjam
                  </label>
                  <input
                    type="text"
                    value={namaPelanggan}
                    onChange={(e) => setNamaPelanggan(e.target.value)}
                    placeholder="Ketik nama lengkap pembeli..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Customer & Note Input */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nama Pelanggan (Opsional)
            </label>
            <div className="relative">
              <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={namaPelanggan}
                onChange={(e) => setNamaPelanggan(e.target.value)}
                placeholder="Pelanggan Umum"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Catatan Nota (Opsional)
            </label>
            <input
              type="text"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Misal: Diskon khusus tetangga / Delivery"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isSufficient || isSubmitting}
            className={`w-full py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              !isSufficient || isSubmitting
                ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                : `bg-gradient-to-r ${accent.gradient} hover:opacity-90 text-white shadow-lg`
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan Transaksi & Mengupdate Stok...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-amber-300" />
                <span>Selesaikan Transaksi & Terbitkan Struk</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
