import React from 'react';
import { Modal } from '../Modal';
import { formatRupiah } from '../../utils/formatters';
import { Printer, Building2, Calendar, FileText } from 'lucide-react';

interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  summaryData: {
    periodeLabel: string;
    totalOmset: number;
    totalHPP: number;
    totalLaba: number;
    marginLaba: number;
    totalTxCount: number;
    avgBasketSize: number;
    totalReturCount: number;
    topProducts: Array<{
      nama: string;
      kode: string;
      terjual: number;
      satuan: string;
      omset: number;
      laba: number;
    }>;
    stockMetrics: {
      totalProduk: number;
      totalUnitStok: number;
      totalNilaiAset: number;
      stokMenipisCount: number;
    };
  };
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  onClose,
  summaryData,
}) => {
  const handleTriggerPrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pratinjau Cetak Laporan Keuangan"
      subtitle="Dokumen resmi rekapitulasi bisnis sembako"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        
        {/* Printable Paper Area */}
        <div id="printable-report" className="p-6 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-sans space-y-6 shadow-sm">
          
          {/* Header Toko */}
          <div className="border-b-2 border-emerald-600 pb-4 text-center">
            <h1 className="text-xl font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Sembako Smart AI
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Jl. Sembako Raya No. 88, Jakarta Selatan | Telp: (021) 555-0199
            </p>
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/50 rounded-full text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <Calendar className="w-3.5 h-3.5" />
              <span>PERIODE: {summaryData.periodeLabel.toUpperCase()}</span>
            </div>
          </div>

          {/* Ringkasan Finansial Grid */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              1. Ringkasan Eksekutif Keuangan & Laba Rugi
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px]">Total Omzet Penjualan</span>
                <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                  {formatRupiah(summaryData.totalOmset)}
                </span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px]">Harga Pokok Penjualan (HPP Modal)</span>
                <span className="text-base font-black text-slate-700 dark:text-slate-300 font-mono">
                  {formatRupiah(summaryData.totalHPP)}
                </span>
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <span className="text-emerald-700 dark:text-emerald-300 block text-[10px] font-bold">
                  Total Laba Kotor (Gross Profit)
                </span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {formatRupiah(summaryData.totalLaba)}
                </span>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800">
                <span className="text-amber-700 dark:text-amber-300 block text-[10px] font-bold">
                  Persentase Margin Laba
                </span>
                <span className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                  {summaryData.marginLaba.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Table Products */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              2. Top 5 Produk Terlaris (Kontributor Utama)
            </h3>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-900 font-bold text-slate-600">
                  <tr>
                    <th className="px-3 py-2">No</th>
                    <th className="px-3 py-2">Produk</th>
                    <th className="px-3 py-2 text-center">Terjual</th>
                    <th className="px-3 py-2 text-right">Total Omzet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {summaryData.topProducts.slice(0, 5).map((p, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-1.5">{idx + 1}</td>
                      <td className="px-3 py-1.5 font-sans font-medium">{p.nama}</td>
                      <td className="px-3 py-1.5 text-center">{p.terjual} {p.satuan}</td>
                      <td className="px-3 py-1.5 text-right font-bold">{formatRupiah(p.omset)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer & Signature */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-between items-end text-xs text-slate-500">
            <div>
              <p className="text-[10px]">Dicetak otomatis dari Sistem Sembako Smart AI</p>
              <p className="text-[10px]">Tanggal: {new Date().toLocaleString('id-ID')}</p>
            </div>

            <div className="text-center w-36">
              <p className="text-[10px] mb-10">Pemilik / Manager Toko</p>
              <div className="border-b border-slate-400 w-full mb-1"></div>
              <p className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">( Admin Toko )</p>
            </div>
          </div>

        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Tutup
          </button>

          <button
            type="button"
            onClick={handleTriggerPrint}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            <span>Cetak Dokumen Sekarang</span>
          </button>
        </div>

      </div>
    </Modal>
  );
};
