import { Navigate } from "react-router-dom";

import { useAuth } from "../state/AuthContext";

export function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
