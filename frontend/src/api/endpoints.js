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
  update: (id, payload) => api.put(`/users/${id}`, payload),
  updateStatus: (id, payload) => api.patch(`/users/${id}/status`, payload),
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
  update: (id, payload) => api.put(`/tasks/${id}`, payload),
  updateStatus: (id, status) => api.patch(`/tasks/${id}/status`, { status }),
  comments: (id) => api.get(`/tasks/${id}/comments`),
  addComment: (id, payload) => api.post(`/tasks/${id}/comments`, payload),
  activity: (id) => api.get(`/tasks/${id}/activity`),
  attachments: (id) => api.get(`/tasks/${id}/attachments`),
  uploadAttachment: (id, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`/tasks/${id}/attachments`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  aiAssist: (id, action) => api.post(`/tasks/${id}/ai-assist`, { action }),
  watch: (id) => api.post(`/tasks/${id}/watch`),
  unwatch: (id) => api.delete(`/tasks/${id}/watch`),
  subtasks: (id) => api.get(`/tasks/${id}/subtasks`),
  createSubtask: (id, payload) => api.post(`/tasks/${id}/subtasks`, payload),
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
  update: (id, payload) => api.put(`/organizations/${id}`, payload),
  updateStatus: (id, payload) => api.patch(`/organizations/${id}/status`, payload),
};

export const adminApi = {
  globalSummary: (params) => api.get("/admin/global-summary", { params }),
  organizationComparison: () => api.get("/admin/organization-comparison"),
  users: (params) => api.get("/admin/users", { params }),
  tasks: (params) => api.get("/admin/tasks", { params }),
  activity: (params) => api.get("/admin/activity", { params }),
};
