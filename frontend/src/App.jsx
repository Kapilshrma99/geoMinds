import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./state/AuthContext";
import { AdminPage } from "./pages/AdminPage";
import { ChatPage } from "./pages/ChatPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { MapIntelligencePage } from "./pages/MapIntelligencePage";
import { PropertyDetailPage } from "./pages/PropertyDetailPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ReportsPage } from "./pages/ReportsPage";
import { UploadPage } from "./pages/UploadPage";

export default function App() {
  const { token } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/register" element={token ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<ProtectedRoute pageKey="dashboard"><DashboardPage /></ProtectedRoute>} />
        <Route path="upload" element={<ProtectedRoute pageKey="upload"><UploadPage /></ProtectedRoute>} />
        <Route path="map" element={<ProtectedRoute pageKey="map"><MapIntelligencePage /></ProtectedRoute>} />
        <Route path="chat" element={<ProtectedRoute pageKey="chat"><ChatPage /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute pageKey="reports"><ReportsPage /></ProtectedRoute>} />
        <Route path="properties/:id" element={<ProtectedRoute pageKey="property-detail"><PropertyDetailPage /></ProtectedRoute>} />
        <Route path="admin" element={<ProtectedRoute pageKey="admin"><AdminPage /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}
