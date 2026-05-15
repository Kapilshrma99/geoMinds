import { createContext, useContext, useEffect, useState } from "react";

import { api, setAuthToken } from "../lib/api";

const AuthContext = createContext(null);
const storageKey = "geomind-auth";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(storageKey));
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem(`${storageKey}-user`);
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const refreshProfile = async () => {
    if (!token) return null;
    const { data } = await api.get("/auth/me");
    setUser(data);
    localStorage.setItem(`${storageKey}-user`, JSON.stringify(data));
    return data;
  };

  useEffect(() => {
    if (!token) return;
    if (user?.visible_pages?.length) return;

    let active = true;
    api
      .get("/auth/me")
      .then(({ data }) => {
        if (!active) return;
        setUser(data);
        localStorage.setItem(`${storageKey}-user`, JSON.stringify(data));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [token, user]);

  const login = async (payload) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", payload);
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem(storageKey, data.access_token);
      localStorage.setItem(`${storageKey}-user`, JSON.stringify(data.user));
      setAuthToken(data.access_token);
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", payload);
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem(storageKey, data.access_token);
      localStorage.setItem(`${storageKey}-user`, JSON.stringify(data.user));
      setAuthToken(data.access_token);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(storageKey);
    localStorage.removeItem(`${storageKey}-user`);
    setAuthToken(null);
  };

  return <AuthContext.Provider value={{ token, user, loading, login, register, logout, refreshProfile }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
