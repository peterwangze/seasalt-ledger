import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import App from './App';
import { LedgerProvider } from './store/LedgerContext';
import { ToastProvider } from './store/ToastContext';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LedgerProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </LedgerProvider>
  </StrictMode>,
);

if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Offline support is a progressive enhancement, and native WebViews
      // loaded from a custom scheme usually do not expose service workers.
    });
  });
}

if (Capacitor.isNativePlatform()) {
  void CapacitorApp.addListener('backButton', () => {
    // Close an open bottom sheet first, then walk the in-app hash history.
    if (document.body.classList.contains('sheet-open')) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      return;
    }
    const hash = window.location.hash || '#/';
    if (hash !== '#/' && hash !== '#') {
      window.history.back();
      return;
    }
    void CapacitorApp.exitApp();
  });
}
