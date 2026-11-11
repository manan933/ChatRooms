import './utils/fileUrl';
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

// Only register SW in production builds; in dev mode actively unregister so cached bundles never mask fixes
if (import.meta.env.PROD) {
  serviceWorkerRegistration.register();
} else {
  serviceWorkerRegistration.unregister();
}
