import axios from "axios";

const STORAGE_KEY = "compheart-session";
export const API_BASE_URL = "http://localhost:7155/api";
export const APP_AUTH_EXPIRED_EVENT = "compheart:auth-expired";
export const APP_API_ERROR_EVENT = "compheart:api-error";

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
  (error) => {
    const status = error?.response?.status;
    const message = error?.response?.data?.detail || error?.message || "Request failed";

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

export default api;
