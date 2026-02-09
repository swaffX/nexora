import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useEffect, useState } from 'react';
import { isMobileDevice } from './utils/deviceDetection';

// Pages
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Training from './pages/Training';
import Leaderboard from './pages/Leaderboard';
import Settings from './pages/Settings';

// Components
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import MobileWarning from './components/MobileWarning';

function App() {
  const { checkAuth, loading } = useAuthStore();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    checkAuth();
    setIsMobile(isMobileDevice());
  }, [checkAuth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-nexora-secondary">
        <div className="text-2xl text-nexora-accent animate-pulse">Loading...</div>
      </div>
    );
  }

  // Show mobile warning for mobile/tablet devices
  if (isMobile) {
    return <MobileWarning />;
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-nexora-secondary">
        <Navbar />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/training/:mapId" element={
            <ProtectedRoute>
              <Training />
            </ProtectedRoute>
          } />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
