import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// In development or preview iframe, unregister stale service worker to avoid caching conflicts
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW Registration note:', err);
      });
    });
  }
}

const rootEl = document.getElementById('root');
if (rootEl) {
  try {
    createRoot(rootEl).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (err: any) {
    console.error('Mount error:', err);
    rootEl.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#020617;color:#f8fafc;font-family:sans-serif;padding:24px;text-align:center;">
        <div style="max-width:400px;background:#0f172a;padding:24px;border-radius:16px;border:1px solid #ef4444;">
          <h2 style="font-size:18px;font-weight:bold;color:#f87171;margin-bottom:8px;">Terjadi Kendala Memuat Aplikasi</h2>
          <p style="font-size:12px;color:#94a3b8;margin-bottom:16px;">Silakan muat ulang halaman untuk memperbarui sesi.</p>
          <button onclick="window.location.reload()" style="background:#10b981;color:#020617;border:none;padding:10px 20px;border-radius:8px;font-weight:bold;cursor:pointer;">Muat Ulang</button>
        </div>
      </div>
    `;
  }
}

