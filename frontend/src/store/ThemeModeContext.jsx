import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { settingsApi } from "../api/endpoints";
import { useAuth } from "./AuthContext";

const STORAGE_KEY = "compheart-theme-mode";
const ThemeModeContext = createContext(null);

function readStoredMode() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "dark";
  } catch {
    return "dark";
  }
}

function getSystemMode() {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeModeProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [themeMode, setThemeModeState] = useState(readStoredMode());
  const [systemMode, setSystemMode] = useState(getSystemMode());
  const [workspaceSettings, setWorkspaceSettings] = useState(null);

  const resolvedMode = themeMode === "system" ? systemMode : themeMode;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => setSystemMode(media.matches ? "light" : "dark");
    handler();
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedMode;
    document.documentElement.style.colorScheme = resolvedMode;
    document.body.dataset.theme = resolvedMode;
  }, [resolvedMode]);

  useEffect(() => {
    if (!isAuthenticated) {
      setWorkspaceSettings(null);
      return;
    }
    settingsApi.workspace()
      .then((response) => {
        setWorkspaceSettings(response.data);
        if (response.data?.theme_mode) {
          setThemeModeState(response.data.theme_mode);
          localStorage.setItem(STORAGE_KEY, response.data.theme_mode);
        }
      })
      .catch(() => {});
  }, [isAuthenticated]);

  const setThemeMode = async (nextMode, persistRemote = true) => {
    setThemeModeState(nextMode);
    localStorage.setItem(STORAGE_KEY, nextMode);
    if (persistRemote && isAuthenticated && workspaceSettings) {
      const nextWorkspace = { ...workspaceSettings, theme_mode: nextMode };
      setWorkspaceSettings(nextWorkspace);
      try {
        await settingsApi.updateWorkspace(nextWorkspace);
      } catch {
        // Keep local preference even if backend persistence fails.
      }
    }
  };

  const value = useMemo(
    () => ({
      themeMode,
      resolvedMode,
      setThemeMode,
      workspaceSettings,
      setWorkspaceSettings,
    }),
    [themeMode, resolvedMode, workspaceSettings]
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error("useThemeMode must be used within ThemeModeProvider");
  }
  return context;
}
