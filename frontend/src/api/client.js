import axios from "axios";

const STORAGE_KEY = "compheart-session";

const api = axios.create({
  baseURL: "http://localhost:7155/api",
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

export default api;
