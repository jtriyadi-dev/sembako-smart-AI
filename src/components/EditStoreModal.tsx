import React, { useState, useRef } from 'react';
import { Modal } from './Modal';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { processImageFile } from '../utils/imageUtils';
import { Store, Phone, MapPin, Save, FileText, Camera, Trash2, Image as ImageIcon } from 'lucide-react';

interface EditStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditStoreModal: React.FC<EditStoreModalProps> = ({ isOpen, onClose }) => {
  const { storeConfig, updateStoreConfig } = useStore();
  const { success, error } = useToast();

  const [namaToko, setNamaToko] = useState(storeConfig.namaToko);
  const [alamatToko, setAlamatToko] = useState(storeConfig.alamatToko);
  const [noHp, setNoHp] = useState(storeConfig.noHp);
  const [footerStruk, setFooterStruk] = useState(storeConfig.footerStruk);
  const [logoUrl, setLogoUrl] = useState(storeConfig.logoUrl);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await processImageFile(file);
      setLogoUrl(compressed);
      success('Foto Logo Siap', 'Foto logo toko telah diperbarui.');
    } catch (err: any) {
      error('Gagal Unggah Gambar', err.message || 'File gambar tidak valid');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaToko.trim()) return;

    updateStoreConfig({
      namaToko: namaToko.trim().toUpperCase(),
      alamatToko: alamatToko.trim(),
      noHp: noHp.trim(),
      footerStruk: footerStruk.trim(),
      logoUrl: logoUrl,
    });

    success('Identitas Toko Diperbarui', `Identitas toko ${namaToko.toUpperCase()} berhasil disimpan.`);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ubah Identitas Toko Sembako"
      subtitle="Nama & foto logo toko akan tampil di bagian atas header & struk"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Foto Logo Toko Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
              <span>Foto / Logo Toko (Tampil di Left Header & Struk)</span>
            </span>
            {logoUrl && (
              <button
                type="button"
                onClick={() => setLogoUrl('')}
                className="text-[11px] text-rose-500 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                Hapus Logo
              </button>
            )}
          </label>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="flex items-center gap-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-dashed border-emerald-500/40 hover:border-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 shrink-0 shadow-sm flex items-center justify-center relative cursor-pointer group transition-all"
              title="Klik untuk Upload Foto Toko"
            >
              {logoUrl ? (
                <>
                  <img src={logoUrl} alt="Logo Toko" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[9px] font-bold">
                    <Camera className="w-4 h-4" />
                    <span>Ubah</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-1 text-emerald-600 dark:text-emerald-400">
                  <Camera className="w-5 h-5 mb-0.5" />
                  <span className="text-[9px] font-bold">Upload</span>
                </div>
              )}
            </div>

            <div className="text-xs text-slate-500 space-y-1">
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                Gunakan foto toko / logo Anda
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold hover:bg-emerald-500/20 transition-all text-[11px] cursor-pointer"
              >
                Pilih Gambar
              </button>
            </div>
          </div>
        </div>

        {/* Nama Toko Large Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Store className="w-4 h-4 text-emerald-500" />
            <span>Nama Toko Sembako (Tampil Besar)</span>
          </label>
          <input
            type="text"
            required
            value={namaToko}
            onChange={(e) => setNamaToko(e.target.value)}
            placeholder="Contoh: TOKO SEMBAKO JAYA MAKMUR"
            className="w-full px-4 py-3 rounded-2xl bg-amber-500/10 dark:bg-slate-950 border-2 border-emerald-500 text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>

        {/* Alamat Toko */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span>Alamat Lengkap Toko</span>
          </label>
          <input
            type="text"
            value={alamatToko}
            onChange={(e) => setAlamatToko(e.target.value)}
            placeholder="Jl. Pasar Raya No. 12"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
          />
        </div>

        {/* No Telepon / WA */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span>No. Telepon / WhatsApp Kasir</span>
          </label>
          <input
            type="text"
            value={noHp}
            onChange={(e) => setNoHp(e.target.value)}
            placeholder="0812-xxxx-xxxx"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
          />
        </div>

        {/* Footer Struk */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>Pesan Footer Struk Thermal</span>
          </label>
          <textarea
            rows={2}
            value={footerStruk}
            onChange={(e) => setFooterStruk(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-amber-500 hover:from-emerald-600 hover:to-amber-400 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 cursor-pointer transition-all"
        >
          <Save className="w-4 h-4 text-amber-300" />
          <span>Simpan Identitas Toko Baru</span>
        </button>
      </form>
    </Modal>
  );
};
