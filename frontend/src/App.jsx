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
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="map" element={<MapIntelligencePage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="properties/:id" element={<PropertyDetailPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
    </Routes>
  );
}
