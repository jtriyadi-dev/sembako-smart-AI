import React, { createContext, useContext, useState, useEffect } from 'react';
import { isValidLicenseKey } from '../constants/officialLicenseKeys';
import { db, doc, getDoc, setDoc, COLLECTIONS } from '../services/firebase';
import { clearAllDatabaseData } from '../services/productService';

export function getOrCreateInstallationId(): string {
  if (typeof window === 'undefined') return 'INST-SERVER';
  let id = localStorage.getItem('sembako_installation_id');
  if (!id) {
    id = 'INST-' + Math.random().toString(36).substring(2, 9).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
    localStorage.setItem('sembako_installation_id', id);
  }
  return id;
}

export interface StoreConfig {
  namaToko: string;
  alamatToko: string;
  noHp: string;
  emailPemilik: string;
  logoUrl: string;
  footerStruk: string;
  targetOmzetBulanIni?: number;
  printerType: '58mm' | '80mm' | 'a4';
  connectionType: 'bluetooth' | 'usb' | 'network';
  printerName: string;
  autoPrint: boolean;
  accentColor: 'emerald' | 'amber' | 'indigo' | 'rose' | 'teal';

  // Barcode Scanner Connection & Configuration
  scannerType: 'usb_hid' | 'camera' | 'bluetooth_spp' | 'web_serial';
  scannerDeviceName: string;
  scannerBeepSound: boolean;
  scannerAutoAddQty: boolean;
  scannerPrefix: string;
  scannerSuffixKey: 'enter' | 'tab' | 'none';
  scannerMinLength: number;
  scannerContinuousScan: boolean;
}

export interface LicenseInfo {
  isActivated: boolean;
  licenseKey: string;
  licenseType: 'PRO_LIFETIME' | 'ENTERPRISE' | 'TRIAL';
  licenseeName: string;
  activatedAt: string;
  expiryDate: string;
  installationId?: string;
}

const DEFAULT_STORE_CONFIG: StoreConfig = {
  namaToko: 'TOKO SEMBAKO SAYA',
  alamatToko: '',
  noHp: '',
  emailPemilik: '',
  logoUrl: '',
  footerStruk: 'Terima kasih telah berbelanja di Toko Kami! Semoga berkah & sehat selalu.',
  targetOmzetBulanIni: 0,
  printerType: '58mm',
  connectionType: 'bluetooth',
  printerName: 'Thermal Receipt POS-58',
  autoPrint: true,
  accentColor: 'emerald',
  scannerType: 'usb_hid',
  scannerDeviceName: 'Eyoyo / Zebra USB 2D Scanner',
  scannerBeepSound: true,
  scannerAutoAddQty: true,
  scannerPrefix: '',
  scannerSuffixKey: 'enter',
  scannerMinLength: 3,
  scannerContinuousScan: true,
};

const DEFAULT_LICENSE: LicenseInfo = {
  isActivated: false,
  licenseKey: '',
  licenseType: 'PRO_LIFETIME',
  licenseeName: 'Belum Teraktivasi',
  activatedAt: '',
  expiryDate: 'Membutuhkan License Key Resmi',
};

interface StoreContextType {
  storeConfig: StoreConfig;
  licenseInfo: LicenseInfo;
  updateStoreConfig: (newCfg: Partial<StoreConfig>) => void;
  activateLicenseKey: (key: string, licensee?: string) => Promise<{ success: boolean; message: string }>;
  deactivateLicense: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [storeConfig, setStoreConfig] = useState<StoreConfig>(() => {
    const saved = localStorage.getItem('sembako_store_config');
    if (saved) {
      try {
        return { ...DEFAULT_STORE_CONFIG, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Error loading store config:', e);
      }
    }
    return DEFAULT_STORE_CONFIG;
  });

  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo>(() => {
    const saved = localStorage.getItem('sembako_license_info');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.isActivated && isValidLicenseKey(parsed.licenseKey)) {
          return { ...DEFAULT_LICENSE, ...parsed };
        }
      } catch (e) {
        console.error('Error loading license info:', e);
      }
    }
    return DEFAULT_LICENSE;
  });

  // Background verification of cloud device locking
  useEffect(() => {
    if (licenseInfo.isActivated && licenseInfo.licenseKey) {
      const currentInstId = getOrCreateInstallationId();
      const licenseDocRef = doc(db, COLLECTIONS.ACTIVATED_LICENSES, licenseInfo.licenseKey);

      getDoc(licenseDocRef)
        .then((snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.installationId && data.installationId !== currentInstId) {
              console.warn('License key locked to another device on Cloud!');
              deactivateLicense();
            }
          }
        })
        .catch((err) => {
          console.warn('Background license verification skipped:', err);
        });
    }
  }, []);

  // Save to localStorage
  const updateStoreConfig = (newCfg: Partial<StoreConfig>) => {
    setStoreConfig((prev) => {
      const updated = { ...prev, ...newCfg };
      localStorage.setItem('sembako_store_config', JSON.stringify(updated));
      return updated;
    });
  };

  const activateLicenseKey = async (
    key: string,
    licensee: string = 'Pemilik Toko Official'
  ): Promise<{ success: boolean; message: string }> => {
    const trimmed = key.trim().toUpperCase();
    if (!trimmed || trimmed.length < 6) {
      return { success: false, message: 'Kode lisensi tidak valid (minimal 6 karakter).' };
    }

    if (!isValidLicenseKey(trimmed)) {
      return {
        success: false,
        message: 'License Key tidak terdaftar! Harap gunakan License Key resmi 16 karakter yang terdaftar saat pembelian.',
      };
    }

    const installationId = getOrCreateInstallationId();

    // Check Cloud Lock in Firestore
    try {
      const licenseDocRef = doc(db, COLLECTIONS.ACTIVATED_LICENSES, trimmed);
      const docSnap = await getDoc(licenseDocRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        // If activated on another device/installation
        if (data.installationId && data.installationId !== installationId) {
          return {
            success: false,
            message: `Gagal Aktivasi! License Key (${trimmed}) sudah diaktifkan dan TERKUNCI pada toko/perangkat lain (${data.licenseeName || 'User Lain'}). 1 License Key hanya diperbolehkan untuk 1 perangkat!`,
          };
        }
      } else {
        // First time activation - Lock key to this installation in Firestore
        await setDoc(licenseDocRef, {
          licenseKey: trimmed,
          installationId: installationId,
          licenseeName: licensee || 'Pemilik Toko Registered',
          activatedAt: new Date().toISOString(),
          activatedAtFormatted: new Date().toLocaleDateString('id-ID'),
          status: 'ACTIVE_LOCKED',
          deviceUserAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        });
      }
    } catch (err: any) {
      console.warn('Firestore Cloud Lock Check warning:', err);
      // Proceed if offline local cache allows
    }

    let type: 'PRO_LIFETIME' | 'ENTERPRISE' | 'TRIAL' = 'PRO_LIFETIME';
    let expiry = 'Permanen / Lifetime';

    if (trimmed.includes('ENTERPRISE') || trimmed.includes('VIP')) {
      type = 'ENTERPRISE';
      expiry = 'SaaS Unlimited Enterprise';
    }

    const updatedLicense: LicenseInfo = {
      isActivated: true,
      licenseKey: trimmed,
      licenseType: type,
      licenseeName: licensee || 'Pemilik Toko Registered',
      activatedAt: new Date().toISOString().split('T')[0],
      expiryDate: expiry,
      installationId: installationId,
    };

    setLicenseInfo(updatedLicense);
    localStorage.setItem('sembako_license_info', JSON.stringify(updatedLicense));

    // Reset store configuration to blank state for clean user input
    updateStoreConfig({
      alamatToko: '',
      noHp: '',
      emailPemilik: '',
      targetOmzetBulanIni: 0,
    });

    // Clear AI Assistant chat sessions from localStorage
    localStorage.removeItem('sembako_ai_chat_sessions');

    // Clear all previous sample/demo database data so user starts with a clean slate
    try {
      await clearAllDatabaseData();
    } catch (err) {
      console.warn('Wipe database on activation skipped:', err);
    }

    return {
      success: true,
      message: `Aktivasi Lisensi Berhasil! Terkunci khusus untuk Perangkat/Toko ini (${installationId}). Semua data aplikasi telah dikosongkan agar Anda dapat meng-input produk & transaksi toko dari awal.`,
    };
  };

  const deactivateLicense = () => {
    const trialLicense: LicenseInfo = {
      isActivated: false,
      licenseKey: '',
      licenseType: 'TRIAL',
      licenseeName: 'Unregistered Client',
      activatedAt: '',
      expiryDate: 'Trial Expired',
    };
    setLicenseInfo(trialLicense);
    localStorage.setItem('sembako_license_info', JSON.stringify(trialLicense));
  };

  return (
    <StoreContext.Provider
      value={{
        storeConfig,
        licenseInfo,
        updateStoreConfig,
        activateLicenseKey,
        deactivateLicense,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = (): StoreContextType => {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return ctx;
};
