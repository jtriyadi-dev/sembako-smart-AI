import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportUserGuideToPDF() {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  let currentY = 15;

  // Helper Function for Header Banner
  const drawBanner = () => {
    // Top Emerald Header Box
    doc.setFillColor(15, 118, 110); // Emerald 700
    doc.rect(0, 0, pageWidth, 32, 'F');

    // Decorative Gold Accent Strip
    doc.setFillColor(217, 119, 6); // Amber 600
    doc.rect(0, 32, pageWidth, 2, 'F');

    // Title Text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('PANDUAN PENGGUNAAN APLIKASI SEMBAKO SMART AI', 14, 15);

    // Subtitle
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'Buku Manual Operasional Lengkap: Kasir POS, Manajemen Stok, Retur Item, & Laporan Keuangan',
      14,
      22
    );

    // Version Badge
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Sembako Smart v2.5 Pro Commercial Edition  |  Dicetak: ${new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`,
      14,
      28
    );
  };

  // Helper Function for Footer Page Numbering
  const addPageFooters = () => {
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139); // Slate 500

      // Divider Line
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.setLineWidth(0.3);
      doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

      // Footer Text
      doc.text(
        'Sembako Smart AI Platform - Dokumen Panduan Resmi Penggunaan Aplikasi Toko',
        14,
        pageHeight - 7
      );
      doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - 14, pageHeight - 7, {
        align: 'right',
      });
    }
  };

  // Render Cover Banner
  drawBanner();
  currentY = 42;

  // --- RINGKASAN MODUL SISTEM & ALUR KERJA (VISUAL DIAGRAM) ---
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 118, 110);
  doc.text('1. DIAGRAM ALUR KERJA SISTEM (WORKFLOW DIAGRAM)', 14, currentY);
  currentY += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(
    'Berikut adalah alur proses transaksi kasir dan alur retur barang pada Sembako Smart AI:',
    14,
    currentY
  );
  currentY += 6;

  // Visual Diagram 1: Flow Kasir POS
  const drawKasirDiagram = (startY: number) => {
    const boxW = 41;
    const boxH = 16;
    const gap = 5;
    const startX = 14;

    const steps = [
      { num: '1', title: 'Scan / Pilih Barcode', desc: 'Input item ke keranjang' },
      { num: '2', title: 'Atur Qty & Diskon', desc: 'Diskon/kupon pelanggan' },
      { num: '3', title: 'Pilih Metode Bayar', desc: 'Tunai / QRIS / Bank' },
      { num: '4', title: 'Cetak Struk & Stok', desc: 'Stok terpotong otomatis' },
    ];

    steps.forEach((step, idx) => {
      const x = startX + idx * (boxW + gap);

      // Box Background
      doc.setFillColor(240, 253, 244); // Emerald 50
      doc.setDrawColor(16, 185, 129); // Emerald 500
      doc.setLineWidth(0.4);
      doc.roundedRect(x, startY, boxW, boxH, 2, 2, 'FD');

      // Step Number Circle
      doc.setFillColor(15, 118, 110);
      doc.circle(x + 5, startY + 5, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(step.num, x + 5, startY + 6, { align: 'center' });

      // Step Title
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(step.title, x + 10, startY + 6);

      // Step Description
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(step.desc, x + 3, startY + 12);

      // Arrow connector
      if (idx < steps.length - 1) {
        const arrowX = x + boxW + 1;
        doc.setDrawColor(16, 185, 129);
        doc.line(arrowX, startY + boxH / 2, arrowX + gap - 2, startY + boxH / 2);
        doc.text('>', arrowX + gap - 2, startY + boxH / 2 + 1);
      }
    });
  };

  drawKasirDiagram(currentY);
  currentY += 22;

  // Visual Diagram 2: Flow Retur Sebagian / Penuh
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9); // Amber 700
  doc.text('Diagram Alur Retur Items & Pengembalian Dana (Refund):', 14, currentY);
  currentY += 5;

  const drawReturDiagram = (startY: number) => {
    const boxW = 41;
    const boxH = 16;
    const gap = 5;
    const startX = 14;

    const steps = [
      { num: 'A', title: 'Buka Riwayat TRX', desc: 'Pilih nota transaksi' },
      { num: 'B', title: 'Klik Retur Item', desc: 'Atur jumlah retur per item' },
      { num: 'C', title: 'Refund Nominal', desc: 'Kasir kembalikan uang' },
      { num: 'D', title: 'Stok Kembali', desc: 'Stok & Struk ter-update' },
    ];

    steps.forEach((step, idx) => {
      const x = startX + idx * (boxW + gap);

      // Box Background
      doc.setFillColor(254, 242, 242); // Rose 50
      doc.setDrawColor(244, 63, 94); // Rose 500
      doc.setLineWidth(0.4);
      doc.roundedRect(x, startY, boxW, boxH, 2, 2, 'FD');

      // Step Badge
      doc.setFillColor(225, 29, 72);
      doc.circle(x + 5, startY + 5, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(step.num, x + 5, startY + 6, { align: 'center' });

      // Title
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(step.title, x + 10, startY + 6);

      // Desc
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(step.desc, x + 3, startY + 12);

      // Arrow
      if (idx < steps.length - 1) {
        const arrowX = x + boxW + 1;
        doc.setDrawColor(244, 63, 94);
        doc.line(arrowX, startY + boxH / 2, arrowX + gap - 2, startY + boxH / 2);
        doc.text('>', arrowX + gap - 2, startY + boxH / 2 + 1);
      }
    });
  };

  drawReturDiagram(currentY);
  currentY += 24;

  // --- TABEL PANDUAN 8 LANGKAH OPERASIONAL ---
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 118, 110);
  doc.text('2. PANDUAN LANGKAH DEMI LANGKAH FITUR UTAMA', 14, currentY);
  currentY += 4;

  const guideTableHead = [['Langkah & Fitur', 'Modul / Area', 'Instruksi Penggunaan Lengkap']];
  const guideTableBody = [
    [
      '1. Profil & Identitas Toko',
      'Pengaturan > Profil Toko',
      'Atur Nama Toko, Alamat, No. Telp/WA, dan Footer Struk. Nama toko akan tampil di bagian atas header serta dicetak pada bagian paling atas nota belanja thermal.',
    ],
    [
      '2. Tambah Produk & Import Excel',
      'Produk / Pengaturan > Import',
      'Tambah manual via "+ Tambah Produk" (Nama, Barcode, Kategori, Harga Beli, Harga Jual, Stok). Atau unduh Template Excel CSV, isi puluhan barang, lalu unggah sekaligus.',
    ],
    [
      '3. Transaksi Kasir POS & Barcode',
      'Menu Kasir POS',
      'Pilih produk via klik kartu, pencarian SKU, atau Scan Barcode (Scanner USB / Kamera HP). Tekan ikon Mikrofon untuk input barang via Perintah Suara.',
    ],
    [
      '4. Pembayaran & Kembalian',
      'Kasir > Modal Pembayaran',
      'Pilih Tunai, QRIS, atau Transfer Bank. Gunakan tombol "Uang Pas" atau pecahan nominal cepat (Rp10k, Rp20k, Rp50k, Rp100k) untuk menghitung kembalian akurat.',
    ],
    [
      '5. Retur Items & Void Transaksi',
      'Transaksi > Detail Transaksi',
      'Mendukung Retur Sebagian (Partial Return) per item barang. Nominal refund akan diproses, stok barang otomatis kembali ke gudang, dan nota diperbarui.',
    ],
    [
      '6. Kelola Stok & Stock Opname',
      'Stok > Stock Opname',
      'Sistem memberi peringatan otomatis untuk stok menipis (< 5 pcs). Lakukan penyesuaian fisik stok dengan alasan Barang Rusak, Selisih Gudang, atau Kadaluarsa.',
    ],
    [
      '7. Printer Thermal & Cetak Struk',
      'Pengaturan > Printer Struk',
      'Pilih lebar kertas (58mm atau 80mm). Aktifkan toggle "Otomatis Cetak Struk Setelah Pembayaran" untuk memicu dialog cetak printer thermal secara langsung.',
    ],
    [
      '8. Kecerdasan Gemini AI Assistant',
      'Menu AI Assistant',
      'Tanyakan pertanyaan analisis bisnis seperti: "Barang apa yang paling laris minggu ini?", "Berapa estimasi nilai stok gudang?", atau "Buat paket promo bundling sembako".',
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    head: guideTableHead,
    body: guideTableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 118, 110],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
    },
    columnStyles: {
      0: { cellWidth: 45, fontStyle: 'bold' },
      1: { cellWidth: 42, fontStyle: 'italic' },
      2: { cellWidth: 95 },
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // Check if new page needed
  if (currentY > pageHeight - 60) {
    doc.addPage();
    drawBanner();
    currentY = 40;
  }

  // --- SHORTCUT KEYBOARD REFERENCE TABLE ---
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 118, 110);
  doc.text('3. TABEL REFERENSI SHORTCUT KEYBOARD KASIR', 14, currentY);
  currentY += 4;

  const shortcutHead = [['Tombol Keyboard', 'Halaman / Area', 'Fungsi / Aksi Otomatis']];
  const shortcutBody = [
    ['ESC', 'Global Modal Dialog', 'Menutup jendela dialog modal aktif (Detail Transaksi, Tambah Produk, Pembayaran)'],
    ['Enter', 'Kasir POS & Form Input', 'Memproses konfirmasi pembayaran atau menyimpan data formulir'],
    ['Scanner Barcode USB', 'Halaman Kasir POS', 'Otomatis mendeteksi SKU produk, membunyikan beep, dan menambah ke keranjang'],
    ['Klik Uang Pas', 'Modal Pembayaran', 'Mengisi angka bayar sesuai total tagihan untuk kembalian Rp0'],
    ['Tombol Pecahan Uang', 'Modal Pembayaran', 'Menambahkan nominal cepat Rp10.000, Rp20.000, Rp50.000, atau Rp100.000'],
  ];

  autoTable(doc, {
    startY: currentY,
    head: shortcutHead,
    body: shortcutBody,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
    },
    columnStyles: {
      0: { cellWidth: 45, fontStyle: 'bold', textColor: [15, 118, 110] },
      1: { cellWidth: 45 },
      2: { cellWidth: 92 },
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // Check if new page needed
  if (currentY > pageHeight - 60) {
    doc.addPage();
    drawBanner();
    currentY = 40;
  }

  // --- GEMINI AI PROMPTS REFERENCE ---
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 118, 110);
  doc.text('4. CONTOH PERTANYAAN ANALISIS GEMINI AI ASSISTANT', 14, currentY);
  currentY += 4;

  const aiHead = [['Topik Analisis AI', 'Contoh Perintah / Pertanyaan ke Gemini AI']];
  const aiBody = [
    ['Produk Terlaris', '"Produk sembako apa yang paling banyak terjual minggu ini dan memberikan keuntungan terbesar?"'],
    ['Peringatan Stok Gudang', '"Barang apa saja yang stoknya di bawah batas minimum dan harus segera dibeli ke supplier?"'],
    ['Stok Mati (Deadstock)', '"Apakah ada produk yang mengendap lama di gudang dan belum pernah terjual sama sekali?"'],
    ['Estimasi Modal Aset', '"Berapa total nilai estimasi aset modal belanja barang yang tersimpan di gudang toko saat ini?"'],
    ['Paket Bundling Promo', '"Berikan ide paket promo bundling sembako (contoh: Beras 5kg + Minyak 2L + Gula 1kg) untuk tingkatkan omset."'],
  ];

  autoTable(doc, {
    startY: currentY,
    head: aiHead,
    body: aiBody,
    theme: 'grid',
    headStyles: {
      fillColor: [217, 119, 6],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 132, fontStyle: 'italic' },
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // Check if new page needed
  if (currentY > pageHeight - 60) {
    doc.addPage();
    drawBanner();
    currentY = 40;
  }

  // --- FAQ & KETENTUAN TEKNIS ---
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 118, 110);
  doc.text('5. TANYA JAWAB TEKNIS (FAQ & TROUBLESHOOTING)', 14, currentY);
  currentY += 6;

  const faqs = [
    {
      q: 'Q: Dimana data toko saya disimpan? Apakah aman jika browser ditutup?',
      a: 'A: Sangat aman! Data tersimpan di Cloud Database Firebase Firestore secara realtime dan terenskripsi. Data juga dicache secara lokal di browser via Progressive Web App (PWA).',
    },
    {
      q: 'Q: Bagaimana jika koneksi internet terputus atau mati lampu?',
      a: 'A: Aplikasi tetap bisa digunakan dalam Mode Offline. Begitu internet terhubung kembali, data transaksi offline akan otomatis disinkronkan ke Cloud Firestore tanpa ada data hilang.',
    },
    {
      q: 'Q: Bagaimana cara menghubungkan Printer Struk Thermal Bluetooth?',
      a: 'A: Buka Bluetooth HP/Laptop, hubungkan perangkat printer. Kemudian di aplikasi buka Pengaturan > Printer Struk, pilih ukuran kertas 58mm/80mm, lalu tekan "Uji Cetak Printer".',
    },
    {
      q: 'Q: Bagaimana cara mengaktifkan Lisensi Commercial Pro seumur hidup?',
      a: 'A: Buka menu Pengaturan > Lisensi Software. Masukkan 16-karakter License Key Anda lalu tekan "Proses Aktivasi Lisensi". Status akan aktif terverifikasi seumur hidup.',
    },
  ];

  faqs.forEach((item) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, currentY, pageWidth - 28, 14, 1.5, 1.5, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(item.q, 17, currentY + 4.5);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(item.a, 17, currentY + 10, { maxWidth: pageWidth - 34 });

    currentY += 17;
  });

  // Add Page Footers to all pages
  addPageFooters();

  // Save the PDF File
  doc.save('PANDUAN_PENGGUNAAN_SEMBAKO_SMART_AI.pdf');
}
