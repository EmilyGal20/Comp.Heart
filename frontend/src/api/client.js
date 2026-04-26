import axios from "axios";

const STORAGE_KEY = "compheart-session";

const rawApiBase = import.meta.env.VITE_API_BASE_URL;
// Dev + Vite proxy: use same-origin /api. Production build: point at the API host unless overridden.
export const API_BASE_URL =
  rawApiBase != null && rawApiBase !== ""
    ? rawApiBase
    : import.meta.env.DEV
      ? "/api"
      : "http://localhost:7155/api";
export const APP_AUTH_EXPIRED_EVENT = "compheart:auth-expired";
export const APP_API_ERROR_EVENT = "compheart:api-error";

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  try {
    const session = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (session?.token) {
      config.headers.Authorization = `Bearer ${session.token}`;
    }
  } catch {
    // Ignore local storage parse issues.
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const message = error?.response?.data?.detail || error?.message || "Request failed";
    const method = String(error?.config?.method || "get").toLowerCase();
    const retryable = (!status || status >= 500) && ["get", "head"].includes(method);
    const attempt = error?.config?._retryAttempt || 0;

    if (retryable && attempt < 2 && typeof window !== "undefined") {
      error.config._retryAttempt = attempt + 1;
      await sleep(250 * (attempt + 1));
      return api.request(error.config);
    }

    if (status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(APP_AUTH_EXPIRED_EVENT, { detail: { message } }));
    }

    if (typeof window !== "undefined" && import.meta.env.DEV) {
      window.dispatchEvent(
        new CustomEvent(APP_API_ERROR_EVENT, {
          detail: {
            url: error?.config?.url,
            method: error?.config?.method,
            status,
            message,
          },
        })
      );
    }

    return Promise.reject(error);
  }
);

/**
 * WebSocket URL for /ws/live. In dev (with Vite proxy), use same host as the page so LAN demos work.
 * If VITE_API_BASE_URL is set, derive host from that instead.
 */
export function buildLiveWebSocketUrl() {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (import.meta.env.DEV && (raw == null || raw === "")) {
    const url = new URL("/ws/live", window.location.origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url;
  }
  const base = API_BASE_URL;
  if (base.startsWith("/")) {
    const url = new URL("/ws/live", window.location.origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url;
  }
  const url = new URL(base.replace(/\/api\/?$/, "/ws/live"));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url;
}

export default api;
