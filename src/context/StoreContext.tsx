import React, { createContext, useContext, useState, useEffect } from 'react';
import { isValidLicenseKey } from '../constants/officialLicenseKeys';
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
    if (!trimmed || trimmed.length < 4) {
      return { success: false, message: 'Kode lisensi tidak valid (minimal 4 karakter).' };
    }

    if (!isValidLicenseKey(trimmed)) {
      return {
        success: false,
        message: 'License Key tidak terdaftar! Harap gunakan License Key resmi yang terdaftar saat pembelian.',
      };
    }

    const installationId = getOrCreateInstallationId();

    let type: 'PRO_LIFETIME' | 'ENTERPRISE' | 'TRIAL' = 'PRO_LIFETIME';
    let expiry = 'Permanen / Lifetime';

    if (
      trimmed.includes('ENTERPRISE') ||
      trimmed.includes('VIP') ||
      trimmed.includes('DEV') ||
      trimmed.includes('MASTER')
    ) {
      type = 'ENTERPRISE';
      expiry = 'SaaS Unlimited Enterprise (Developer Super Admin)';
    } else if (trimmed.includes('TRL') || trimmed.includes('TRIAL')) {
      type = 'TRIAL';
      expiry = 'Trial 6 Jam';
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
    localStorage.setItem('sembako_license_key', trimmed);
    localStorage.setItem('sembako_license_owner', licensee || 'Pemilik Toko Registered');

    if (trimmed.includes('DEV') || trimmed.includes('MASTER')) {
      localStorage.setItem('sembako_developer_auth_session', 'true');
      localStorage.setItem('sembako_developer_secret', 'master-dev-token');
    }

    if (licensee && licensee !== 'Pemilik Toko Official') {
      updateStoreConfig({ namaToko: licensee });
    }

    // Clean up sample demo sessions in background
    setTimeout(() => {
      try {
        localStorage.removeItem('sembako_demo_session');
        localStorage.removeItem('sembako_ai_chat_sessions');
        clearAllDatabaseData().catch(() => {});
      } catch (e) {}
    }, 50);

    return {
      success: true,
      message: `Aktivasi Lisensi Berhasil! Terkunci khusus untuk Perangkat/Toko ini (${installationId}).`,
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
