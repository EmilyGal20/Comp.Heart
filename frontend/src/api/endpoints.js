import api from "./client";

export const authApi = {
  login: (payload) => api.post("/auth/login", payload),
  me: () => api.get("/auth/me"),
  organizations: () => api.get("/auth/organizations"),
};

export const dashboardApi = {
  summary: (params) => api.get("/dashboard/summary", { params }),
};

export const usersApi = {
  list: (params) => api.get("/users", { params }),
  create: (payload) => api.post("/users", payload),
  detail: (id) => api.get(`/users/${id}`),
  myDashboard: () => api.get("/users/me/dashboard"),
};

export const knowledgeApi = {
  list: (params) => api.get("/knowledge", { params }),
  search: (params) => api.get("/knowledge/search", { params }),
  detail: (id) => api.get(`/knowledge/${id}`),
  create: (payload) => api.post("/knowledge", payload),
};

export const tasksApi = {
  list: (params) => api.get("/tasks", { params }),
  detail: (id) => api.get(`/tasks/${id}`),
  create: (payload) => api.post("/tasks", payload),
  updateStatus: (id, status) => api.patch(`/tasks/${id}/status`, { status }),
};

export const automationApi = {
  list: (params) => api.get("/automation", { params }),
  create: (payload) => api.post("/automation", payload),
  toggle: (id) => api.patch(`/automation/${id}/toggle`),
  evaluate: (payload) => api.post("/automation/evaluate", payload),
};

export const notificationsApi = {
  list: (params) => api.get("/notifications", { params }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
};

export const aiApi = {
  chat: (payload) => api.post("/ai/chat", payload),
  conversations: () => api.get("/ai/conversations"),
  conversation: (id) => api.get(`/ai/conversations/${id}`),
};

export const organizationsApi = {
  list: () => api.get("/organizations"),
  detail: (id) => api.get(`/organizations/${id}`),
  users: (id) => api.get(`/organizations/${id}/users`),
  teams: (id) => api.get(`/organizations/${id}/teams`),
  summary: (id) => api.get(`/organizations/${id}/summary`),
  create: (payload) => api.post("/organizations", payload),
};

export const adminApi = {
  globalSummary: (params) => api.get("/admin/global-summary", { params }),
  organizationComparison: () => api.get("/admin/organization-comparison"),
  users: (params) => api.get("/admin/users", { params }),
  tasks: (params) => api.get("/admin/tasks", { params }),
};
