import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../api/endpoints";
import { APP_AUTH_EXPIRED_EVENT } from "../api/client";

const AuthContext = createContext(null);
const STORAGE_KEY = "compheart-session";

function readStoredSession() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readStoredSession()?.token || "");
  const [user, setUser] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [scopedOrganizationId, setScopedOrganizationId] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshOrganizations = async () => {
    const response = await authApi.organizations();
    setOrganizations(response.data);
    return response.data;
  };

  const hydrate = async () => {
    const stored = readStoredSession();
    if (!stored?.token) {
      await refreshOrganizations();
      setLoading(false);
      return;
    }
    setToken(stored.token);
    try {
      const [meResponse, orgsResponse] = await Promise.all([authApi.me(), authApi.organizations()]);
      setUser(meResponse.data);
      setOrganizations(orgsResponse.data);
      setScopedOrganizationId(stored.scopedOrganizationId || null);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setToken("");
      setUser(null);
      await refreshOrganizations();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    const handleExpired = () => {
      localStorage.removeItem(STORAGE_KEY);
      setToken("");
      setUser(null);
      setScopedOrganizationId(null);
      setLoading(false);
    };

    window.addEventListener(APP_AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(APP_AUTH_EXPIRED_EVENT, handleExpired);
  }, []);

  const login = async ({ email, password, organization_slug }) => {
    const response = await authApi.login({
      email,
      password,
      ...(organization_slug ? { organization_slug } : {}),
    });
    const nextToken = response.data.access_token;
    const nextUser = response.data.user;
    const scopedOrg = nextUser.role === "SUPER_ADMIN" ? null : nextUser.organization_id;
    setToken(nextToken);
    setUser(nextUser);
    setScopedOrganizationId(scopedOrg);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: nextToken, scopedOrganizationId: scopedOrg }));
    await refreshOrganizations();
    return response.data;
  };

  const logout = async () => {
    localStorage.removeItem(STORAGE_KEY);
    setToken("");
    setUser(null);
    setScopedOrganizationId(null);
    await refreshOrganizations();
  };

  const updateScopedOrganization = (organizationId) => {
    const nextValue = organizationId || null;
    setScopedOrganizationId(nextValue);
    if (token) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, scopedOrganizationId: nextValue }));
    }
  };

  const scopedOrganization = useMemo(() => {
    if (!user) return null;
    if (user.role === "SUPER_ADMIN") {
      return organizations.find((organization) => organization.id === scopedOrganizationId)?.organization
        || organizations.find((organization) => organization.id === scopedOrganizationId)
        || null;
    }
    return user.organization;
  }, [organizations, scopedOrganizationId, user]);

  const value = {
    token,
    user,
    organizations,
    loading,
    login,
    logout,
    refreshOrganizations,
    scopedOrganizationId,
    setScopedOrganizationId: updateScopedOrganization,
    scopedOrganization,
    activeOrganizationId: user?.role === "SUPER_ADMIN" ? scopedOrganizationId : user?.organization_id,
    isAuthenticated: Boolean(token && user),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
