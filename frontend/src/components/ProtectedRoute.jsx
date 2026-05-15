import { Navigate } from "react-router-dom";

import { useAuth } from "../state/AuthContext";

export function ProtectedRoute({ children, pageKey }) {
  const { token, user } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (pageKey && user && Array.isArray(user.visible_pages) && !user.visible_pages.includes(pageKey)) {
    const fallback = user.visible_pages.includes("dashboard") ? "/dashboard" : "/upload";
    return <Navigate to={fallback} replace />;
  }
  return children;
}
