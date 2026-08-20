import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { RemoteAppConfig, DeveloperApiKeys } from '../types';
import { DEFAULT_REMOTE_CONFIG, DEFAULT_API_KEYS } from '../data/defaultRemoteConfig';
import { 
  fetchRemoteConfig, 
  saveRemoteConfig as serviceSaveRemoteConfig,
  fetchDeveloperApiKeys,
  saveDeveloperApiKeys as serviceSaveDeveloperApiKeys,
  isDeveloperLoggedIn,
  setDeveloperSession,
  clearDeveloperSession
} from '../services/devCrmService';
import { initPublicSupabaseConfig } from '../services/supabaseClient';

interface RemoteConfigContextType {
  config: RemoteAppConfig;
  apiKeys: DeveloperApiKeys;
  loading: boolean;
  isDevAuth: boolean;
  lastSyncedAt: Date | null;
  updateConfig: (partial: Partial<RemoteAppConfig>) => Promise<boolean>;
  updateApiKeys: (partial: Partial<DeveloperApiKeys>) => Promise<boolean>;
  refreshConfig: () => Promise<void>;
  loginDeveloper: (pin: string) => boolean;
  logoutDeveloper: () => void;
}

const RemoteConfigContext = createContext<RemoteConfigContextType | undefined>(undefined);

export const RemoteConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<RemoteAppConfig>(DEFAULT_REMOTE_CONFIG);
  const [apiKeys, setApiKeys] = useState<DeveloperApiKeys>(DEFAULT_API_KEYS);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDevAuth, setIsDevAuth] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Initial Load
  const loadInitialData = useCallback(async () => {
    try {
      const cfg = await fetchRemoteConfig();
      setConfig(cfg);
      setIsDevAuth(isDeveloperLoggedIn());

      if (isDeveloperLoggedIn()) {
        const keys = await fetchDeveloperApiKeys();
        setApiKeys(keys);
      } else {
        // Also run public Supabase auto-discovery for client / secondary devices
        await initPublicSupabaseConfig();
        try {
          const rawDevKeys = localStorage.getItem('sembako_developer_api_keys');
          const rawSemKeys = localStorage.getItem('sem_api_keys');
          let combined = {};
          if (rawDevKeys) combined = { ...combined, ...JSON.parse(rawDevKeys) };
          if (rawSemKeys) combined = { ...combined, ...JSON.parse(rawSemKeys) };
          if (Object.keys(combined).length > 0) {
            setApiKeys(prev => ({ ...prev, ...combined }));
          }
        } catch (_) {}
      }
      setLastSyncedAt(new Date());
    } catch (err) {
      console.warn('[RemoteConfigProvider] Initial load fallback:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Real-time Background Poller (every 4 seconds) to ensure changes propagate instantly to all users
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const remote = await fetchRemoteConfig();
        if (remote && remote.version !== config.version) {
          console.log(`[RemoteConfigProvider] Live update detected! v${remote.version} (updated: ${remote.updatedAt})`);
          setConfig(remote);
          setLastSyncedAt(new Date());
        }
      } catch (e) {
        // silent
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [config.version]);

  const updateConfig = async (partial: Partial<RemoteAppConfig>): Promise<boolean> => {
    try {
      const result = await serviceSaveRemoteConfig(partial);
      if (result.success) {
        setConfig(result.config);
        setLastSyncedAt(new Date());
        return true;
      }
      return false;
    } catch (e) {
      console.error('Update config failed:', e);
      return false;
    }
  };

  const updateApiKeys = async (partial: Partial<DeveloperApiKeys>): Promise<boolean> => {
    try {
      const result = await serviceSaveDeveloperApiKeys(partial);
      if (result.success) {
        setApiKeys(result.keys);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Update API keys failed:', e);
      return false;
    }
  };

  const refreshConfig = async () => {
    setLoading(true);
    await loadInitialData();
  };

  const loginDeveloper = (pin: string): boolean => {
    const ok = setDeveloperSession(pin);
    if (ok) {
      setIsDevAuth(true);
      fetchDeveloperApiKeys().then(keys => setApiKeys(keys));
      return true;
    }
    return false;
  };

  const logoutDeveloper = () => {
    clearDeveloperSession();
    setIsDevAuth(false);
  };

  return (
    <RemoteConfigContext.Provider
      value={{
        config,
        apiKeys,
        loading,
        isDevAuth,
        lastSyncedAt,
        updateConfig,
        updateApiKeys,
        refreshConfig,
        loginDeveloper,
        logoutDeveloper,
      }}
    >
      {children}
    </RemoteConfigContext.Provider>
  );
};

export function useRemoteConfig(): RemoteConfigContextType {
  const context = useContext(RemoteConfigContext);
  if (!context) {
    throw new Error('useRemoteConfig must be used within a RemoteConfigProvider');
  }
  return context;
}
