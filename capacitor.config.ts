import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.seasalt.ledger',
  appName: '海盐账本',
  webDir: 'dist',
  android: {
    backgroundColor: '#f7f4ec',
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    // Edge-to-edge safe areas for Android 15/16.
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'LIGHT',
      hidden: false,
      animation: 'NONE',
    },
  },
};

export default config;
