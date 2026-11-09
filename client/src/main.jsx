// Global URL resolver safeguard across all components
const resolveFileUrl = (url) => {
  if (!url) return '';
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return url;
  }
  return url.startsWith('/') ? url : `/${url}`;
};

if (typeof window !== 'undefined') {
  window.getFileUrl = resolveFileUrl;
}
if (typeof globalThis !== 'undefined') {
  globalThis.getFileUrl = resolveFileUrl;
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for Progressive Web App (PWA) offline shell and fast caching
serviceWorkerRegistration.register();
