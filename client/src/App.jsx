import React, { useEffect, useState } from 'react';
import useAuthStore from './store/authStore';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';
import NotFoundPage from './pages/NotFoundPage';
import InstallPwaPrompt from './components/ui/InstallPwaPrompt';
import ErrorBoundary from './components/ui/ErrorBoundary';

// Permitted top-level application routes (Clean URLs, no hashes)
const VALID_ROUTES = new Set(['', '/', '/chat', '/login', '/register', '/index.html']);

export function App() {
  const { isAuthenticated, initAuth } = useAuthStore();
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname.toLowerCase().replace(/\/$/, '') || '/');

  useEffect(() => {
    initAuth();

    // Remove any legacy hashtag URL fragment if present (Clean URL standard)
    if (window.location.hash) {
      const cleanPath = window.location.pathname + window.location.search;
      window.history.replaceState(null, '', cleanPath || '/');
    }

    const handleLocationChange = () => {
      const path = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/';
      setCurrentPath(path);
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, [initAuth]);

  const handleReturnHome = () => {
    window.history.pushState(null, '', '/');
    setCurrentPath('/');
  };

  // Check if current route is valid or an unauthorized/broken/admin route (Security & UX requirement)
  const isKnownRoute = VALID_ROUTES.has(currentPath);

  return (
    <ErrorBoundary>
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <InstallPwaPrompt />
        {!isKnownRoute ? (
          <NotFoundPage onReturnHome={handleReturnHome} />
        ) : isAuthenticated ? (
          <ChatPage />
        ) : (
          <AuthPage />
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
