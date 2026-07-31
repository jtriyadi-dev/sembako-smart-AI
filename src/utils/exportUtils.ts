import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { TransaksiItem } from '../types';
import { formatRupiah } from './formatters';

// Export Transactions to PDF
export function exportTransactionsToPDF(
  transactions: TransaksiItem[],
  filename: string = 'Laporan_Transaksi_Sembako'
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Title & Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('TOKO SEMBAKO BERKAH SMART - LAPORAN TRANSAKSI', 14, 15);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, 14, 22);
  doc.text(`Total Transaksi: ${transactions.length} | Exported Data`, 14, 27);

  // Table Data Preparation
  const tableHead = [
    ['No', 'Kode TRX', 'Tanggal & Waktu', 'Pelanggan', 'Metode', 'Status', 'Jml Item', 'Total (Rp)'],
  ];

  const tableBody = transactions.map((tx, idx) => {
    const isFullRetur = tx.statusPembayaran === 'retur';
    const totalRefund = tx.totalRefund || 0;
    const netTotal = isFullRetur ? 0 : Math.max(0, tx.totalHarga - totalRefund);
    const activeItems = tx.items.reduce((acc, i) => acc + (i.jumlah - (i.returQty || 0)), 0);

    return [
      idx + 1,
      tx.kodeTransaksi,
      new Date(tx.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
      tx.namaPelanggan || 'Pelanggan Umum',
      tx.metodePembayaran.toUpperCase(),
      tx.statusPembayaran.toUpperCase(),
      `${activeItems} item`,
      formatRupiah(netTotal),
    ];
  });

  autoTable(doc, {
    startY: 32,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    styles: { fontSize: 8, cellPadding: 2.5 },
  });

  // Calculate Totals Summary Footer
  const totalOmset = transactions.reduce((acc, t) => {
    if (t.statusPembayaran === 'retur') return acc;
    const refund = t.totalRefund || 0;
    return acc + Math.max(0, t.totalHarga - refund);
  }, 0);

  const finalY = (doc as any).lastAutoTable?.finalY || 100;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL OMSET NETTO: ${formatRupiah(totalOmset)}`, 14, finalY + 10);

  doc.save(`${filename}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// Export Transactions to Excel (.xlsx)
export function exportTransactionsToExcel(
  transactions: TransaksiItem[],
  filename: string = 'Laporan_Transaksi_Sembako'
) {
  const excelData = transactions.map((tx, idx) => {
    const isFullRetur = tx.statusPembayaran === 'retur';
    const totalRefund = tx.totalRefund || 0;
    const netTotal = isFullRetur ? 0 : Math.max(0, tx.totalHarga - totalRefund);
    const activeItems = tx.items.reduce((acc, i) => acc + (i.jumlah - (i.returQty || 0)), 0);

    return {
      No: idx + 1,
      'Kode Transaksi': tx.kodeTransaksi,
      'Tanggal & Waktu': new Date(tx.createdAt).toLocaleString('id-ID'),
      Pelanggan: tx.namaPelanggan || 'Pelanggan Umum',
      Kasir: tx.kasirName || 'Kasir Toko',
      'Metode Pembayaran': tx.metodePembayaran.toUpperCase(),
      Status: tx.statusPembayaran.toUpperCase(),
      'Total Item (Aktif)': activeItems,
      'Subtotal (Rp)': tx.subtotal,
      'Diskon Total (Rp)': tx.diskonTotal,
      'Pajak (Rp)': tx.pajakNominal,
      'Total Struk Awal (Rp)': tx.totalHarga,
      'Total Refund (Rp)': totalRefund,
      'Total Net Tagihan (Rp)': netTotal,
      'Uang Bayar (Rp)': tx.bayar,
      'Kembalian (Rp)': tx.kembalian,
      'Item Detail': tx.items
        .map(
          (i) =>
            `${i.namaProduk} (${i.jumlah - (i.returQty || 0)}/${i.jumlah} ${i.satuan} x Rp${i.hargaJual}${
              i.returQty ? ` [Retur x${i.returQty}]` : ''
            })`
        )
        .join('; '),
      'Catatan / Alasan Retur': tx.alasanRetur || tx.catatan || '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transaksi');

  // Set Auto Column Widths
  const columnWidths = [
    { wch: 5 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 15 },
    { wch: 15 },
    { wch: 12 },
    { wch: 10 },
    { wch: 15 },
    { wch: 15 },
    { wch: 12 },
    { wch: 18 },
    { wch: 15 },
    { wch: 15 },
    { wch: 40 },
    { wch: 25 },
  ];
  worksheet['!cols'] = columnWidths;

  XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Export Summary Financial Report to PDF
export function exportLaporanRingkasanToPDF(summaryData: {
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
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('TOKO SEMBAKO BERKAH SMART', 14, 15);
  doc.setFontSize(12);
  doc.text('LAPORAN KEUANGAN, LABA RUGI & TREN PENJUALAN', 14, 22);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Periode Laporan: ${summaryData.periodeLabel}`, 14, 28);
  doc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, 14, 33);

  // Executive Summary Table
  const summaryRows = [
    ['Total Omzet Penjualan (Bruto)', formatRupiah(summaryData.totalOmset)],
    ['Harga Pokok Penjualan (HPP / Modal)', formatRupiah(summaryData.totalHPP)],
    ['Total Laba Kotor (Gross Profit)', formatRupiah(summaryData.totalLaba)],
    ['Persentase Margin Laba Kotor', `${summaryData.marginLaba.toFixed(1)}%`],
    ['Total Transaksi Berhasil', `${summaryData.totalTxCount} Transaksi`],
    ['Rata-Rata Nilai Belanja (AOV)', formatRupiah(summaryData.avgBasketSize)],
    ['Jumlah Transaksi Retur / Dibatalkan', `${summaryData.totalReturCount} Transaksi`],
  ];

  autoTable(doc, {
    startY: 38,
    head: [['Metrik Keuangan', 'Nilai / Jumlah']],
    body: summaryRows,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2 },
  });

  // Top Selling Products Table
  const finalY1 = (doc as any).lastAutoTable?.finalY || 100;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PERFORMANCE PRODUK TERLARIS (TOP SELLERS)', 14, finalY1 + 10);

  const topProdRows = summaryData.topProducts.map((p, idx) => [
    idx + 1,
    p.kode,
    p.nama,
    `${p.terjual} ${p.satuan}`,
    formatRupiah(p.omset),
    formatRupiah(p.laba),
  ]);

  autoTable(doc, {
    startY: finalY1 + 14,
    head: [['Rank', 'Kode SKU', 'Nama Produk', 'Jumlah Terjual', 'Total Omset', 'Kontribusi Laba']],
    body: topProdRows,
    theme: 'striped',
    headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2 },
  });

  // Stock & Inventory Summary
  const finalY2 = (doc as any).lastAutoTable?.finalY || 180;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('SUMMARY ASET INVENTORIS & STOK BARANG', 14, finalY2 + 10);

  const stockRows = [
    ['Total Variasi Produk Terdaftar', `${summaryData.stockMetrics.totalProduk} Jenis SKU`],
    ['Total Fisik Unit Stok di Toko', `${summaryData.stockMetrics.totalUnitStok} Unit`],
    ['Total Nilai Aset Modal Stok (HPP)', formatRupiah(summaryData.stockMetrics.totalNilaiAset)],
    ['Jumlah Produk Stok Menipis / Restok Needed', `${summaryData.stockMetrics.stokMenipisCount} Produk`],
  ];

  autoTable(doc, {
    startY: finalY2 + 14,
    head: [['Indikator Stok Toko', 'Status Real-time']],
    body: stockRows,
    theme: 'plain',
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 2 },
  });

  doc.save(`Laporan_Sembako_Smart_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// Export Summary Financial Report to Excel
export function exportLaporanRingkasanToExcel(summaryData: {
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
}) {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Ringkasan Keuangan
  const summarySheetData = [
    { Metrik: 'Periode Laporan', Nilai: summaryData.periodeLabel },
    { Metrik: 'Total Omzet Penjualan (Rp)', Nilai: summaryData.totalOmset },
    { Metrik: 'Harga Pokok Penjualan (HPP) (Rp)', Nilai: summaryData.totalHPP },
    { Metrik: 'Total Laba Kotor (Rp)', Nilai: summaryData.totalLaba },
    { Metrik: 'Margin Laba (%)', Nilai: `${summaryData.marginLaba.toFixed(2)}%` },
    { Metrik: 'Total Transaksi Berhasil', Nilai: summaryData.totalTxCount },
    { Metrik: 'Rata-Rata Nilai Transaksi (Rp)', Nilai: summaryData.avgBasketSize },
    { Metrik: 'Jumlah Transaksi Retur', Nilai: summaryData.totalReturCount },
    { Metrik: 'Total SKU Produk', Nilai: summaryData.stockMetrics.totalProduk },
    { Metrik: 'Total Unit Stok Fisik', Nilai: summaryData.stockMetrics.totalUnitStok },
    { Metrik: 'Total Nilai Aset Stok Modal (Rp)', Nilai: summaryData.stockMetrics.totalNilaiAset },
    { Metrik: 'Produk Perlu Restok', Nilai: summaryData.stockMetrics.stokMenipisCount },
  ];
  const ws1 = XLSX.utils.json_to_sheet(summarySheetData);
  ws1['!cols'] = [{ wch: 35 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(workbook, ws1, 'Ringkasan Laporan');

  // Sheet 2: Produk Terlaris
  const topProductsSheetData = summaryData.topProducts.map((p, idx) => ({
    Rank: idx + 1,
    'Kode SKU': p.kode,
    'Nama Produk': p.nama,
    'Terjual (Qty)': p.terjual,
    Satuan: p.satuan,
    'Total Omzet (Rp)': p.omset,
    'Estimasi Laba (Rp)': p.laba,
  }));
  const ws2 = XLSX.utils.json_to_sheet(topProductsSheetData);
  ws2['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, ws2, 'Produk Terlaris');

  XLSX.writeFile(workbook, `Laporan_Keuangan_Sembako_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
