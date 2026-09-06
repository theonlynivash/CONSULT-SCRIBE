import { useState, type ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AboutPage from './pages/AboutPage';
import Dashboard from './pages/Dashboard';
import ScribePage from './pages/ScribePage';
import PatientsPage from './pages/PatientsPage';
import SettingsPage from './pages/SettingsPage';
import ConsultationPage from './pages/ConsultationPage';
import PatientPage from './pages/PatientPage';
import NotesPage from './pages/NotesPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import SplashScreen from './components/SplashScreen';
import NavBar from './components/NavBar';
import { useAuth } from './auth';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function AppShell() {
  const location = useLocation();
  return (
    <div className="app-shell">
      <div className="app-dynamic-background" aria-hidden="true">
        <span className="app-mesh-light app-mesh-light-a" />
        <span className="app-mesh-light app-mesh-light-b" />
        <span className="app-mesh-light app-mesh-light-c" />
        <span className="app-background-ray app-background-ray-a" />
        <span className="app-background-ray app-background-ray-b" />
      </div>
      <NavBar />
      <main className="app-main">
        <div className="app-page-transition" key={location.pathname}>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="scribe" element={<ScribePage />} />
          <Route path="patients" element={<PatientsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="patient/:patientId" element={<PatientPage />} />
          <Route path="consultation/:consultationId" element={<ConsultationPage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="about" element={<AboutPage />} />
        </Routes>
        </div>
      </main>
      <footer className="app-footer">© 2026 Srinivash Karthikeyan. All Rights Reserved.</footer>
    </div>
  );
}

const SPLASH_SEEN_KEY = 'consult-scribe-splash-seen';

export default function App() {
  const [showSplash, setShowSplash] = useState(() => !sessionStorage.getItem(SPLASH_SEEN_KEY));

  function handleSplashDone() {
    sessionStorage.setItem(SPLASH_SEEN_KEY, '1');
    setShowSplash(false);
  }

  return (
    <>
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}
