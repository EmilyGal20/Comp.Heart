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
  selectableRecipients: () => api.get("/users/selectable-recipients"),
  myProfile: () => api.get("/users/me/profile"),
  profile: (id) => api.get(`/users/${id}/profile`),
};

export const knowledgeApi = {
  list: (params) => api.get("/knowledge", { params }),
  search: (params) => api.get("/knowledge/search", { params }),
  detail: (id) => api.get(`/knowledge/${id}`),
  create: (payload) => api.post("/knowledge", payload),
  update: (id, payload) => api.put(`/knowledge/${id}`, payload),
  versions: (id) => api.get(`/knowledge/${id}/versions`),
  restoreVersion: (id, versionId) => api.post(`/knowledge/${id}/restore-version/${versionId}`),
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
  downloadAttachment: (taskId, attachmentId) =>
    api.get(`/tasks/${taskId}/attachments/${attachmentId}/download`, { responseType: "blob" }),
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

export const workApi = {
  sprints: (params) => api.get("/work/sprints", { params }),
  createSprint: (payload) => api.post("/work/sprints", payload),
  updateSprintStatus: (id, payload) => api.patch(`/work/sprints/${id}/status`, payload),
  backlog: (params) => api.get("/work/backlog", { params }),
  reorderBacklog: (orderedIds, params) => api.patch("/work/backlog/reorder", { ordered_ids: orderedIds }, { params }),
  assignTaskSprint: (taskId, sprintId) => api.patch(`/work/tasks/${taskId}/sprint`, null, { params: { sprint_id: sprintId } }),
  templates: (params) => api.get("/work/templates", { params }),
  createTemplate: (payload) => api.post("/work/templates", payload),
  createTaskFromTemplate: (id) => api.post(`/work/templates/${id}/tasks`),
  recurring: (params) => api.get("/work/recurring", { params }),
  createRecurring: (payload) => api.post("/work/recurring", payload),
  runRecurring: () => api.post("/work/recurring/run"),
  requestApproval: (taskId) => api.post("/work/approvals", { task_id: taskId }),
  updateApproval: (id, status) => api.patch(`/work/approvals/${id}`, { status }),
  messages: (taskId, params) => api.get(`/work/tasks/${taskId}/messages`, { params }),
  sendMessage: (taskId, message) => api.post(`/work/tasks/${taskId}/messages`, { message }),
  search: (params) => api.get("/work/search", { params }),
  reports: (params) => api.get("/work/reports/summary", { params }),
  exportTasks: (params) => api.get("/work/reports/tasks.csv", { params }),
  auditLogs: (params) => api.get("/work/audit-logs", { params }),
  permissionMatrix: () => api.get("/work/permissions/matrix"),
};

export const automationApi = {
  list: (params) => api.get("/automation", { params }),
  create: (payload) => api.post("/automation", payload),
  update: (id, payload) => api.put(`/automation/${id}`, payload),
  toggle: (id) => api.patch(`/automation/${id}/toggle`),
  remove: (id) => api.delete(`/automation/${id}`),
  evaluate: (payload) => api.post("/automation/evaluate", payload),
};

export const notificationsApi = {
  list: (params) => api.get("/notifications", { params }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: (params) => api.patch("/notifications/read-all", null, { params }),
  bulkRead: (ids) => api.patch("/notifications/bulk-read", { ids }),
};

export const aiApi = {
  chat: (payload) => api.post("/ai/chat", payload),
  conversations: () => api.get("/ai/conversations"),
  conversation: (id) => api.get(`/ai/conversations/${id}`),
  generateTasks: (payload) => api.post("/ai/generate-tasks", payload),
  generateSubtasks: (payload) => api.post("/ai/generate-subtasks", payload),
  suggestTaskPlan: (payload) => api.post("/ai/suggest-task-plan", payload),
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
  commandCenter: () => api.get("/admin/command-center"),
  controlCenter: () => api.get("/admin/control-center"),
  onboardingOverview: (params) => api.get("/admin/onboarding-overview", { params }),
};

export const chatApi = {
  channels: (params) => api.get("/chat/channels", { params }),
  createChannel: (payload) => api.post("/chat/channels", payload),
  messages: (id) => api.get(`/chat/channels/${id}/messages`),
  sendMessage: (id, payload) => api.post(`/chat/channels/${id}/messages`, payload),
  taskThread: (taskId) => api.get(`/chat/task/${taskId}/thread`),
};

export const integrationsApi = {
  summary: () => api.get("/integrations"),
  github: () => api.get("/integrations/github"),
  updateGithub: (payload) => api.put("/integrations/github", payload),
  slack: () => api.get("/integrations/slack"),
  updateSlack: (payload) => api.put("/integrations/slack", payload),
  email: () => api.get("/integrations/email"),
  updateEmail: (payload) => api.put("/integrations/email", payload),
  sendEmail: (payload) => api.post("/integrations/email/send", payload),
  emailHistory: () => api.get("/integrations/email/history"),
};

export const analyticsApi = {
  slaRisk: (params) => api.get("/analytics/sla-risk", { params }),
  userRisk: (params) => api.get("/analytics/user-risk", { params }),
  teamRisk: (params) => api.get("/analytics/team-risk", { params }),
};

export const settingsApi = {
  profile: () => api.get("/settings/profile"),
  updateProfile: (payload) => api.put("/settings/profile", payload),
  workspace: () => api.get("/settings/workspace"),
  updateWorkspace: (payload) => api.put("/settings/workspace", payload),
  organization: () => api.get("/settings/organization"),
  updateOrganization: (payload) => api.put("/settings/organization", payload),
};

export const approvalsApi = {
  dashboard: (params) => api.get("/approvals/dashboard", { params }),
  list: (params) => api.get("/approvals", { params }),
  update: (id, payload) => api.patch(`/approvals/${id}`, payload),
};

export const announcementsApi = {
  list: (params) => api.get("/announcements", { params }),
  create: (payload) => api.post("/announcements", payload),
  update: (id, payload) => api.put(`/announcements/${id}`, payload),
  markRead: (id) => api.patch(`/announcements/${id}/read`),
};

export const meetingsApi = {
  list: (params) => api.get("/meetings", { params }),
  summarize: (payload) => api.post("/meetings/summarize", payload),
  detail: (id) => api.get(`/meetings/${id}`),
  createTasks: (id) => api.post(`/meetings/${id}/tasks`),
};

export const selfNotesApi = {
  list: (params) => api.get("/self-notes", { params }),
  create: (payload) => api.post("/self-notes", payload),
  update: (id, payload) => api.put(`/self-notes/${id}`, payload),
  remove: (id) => api.delete(`/self-notes/${id}`),
};

export const contactsApi = {
  list: (params) => api.get("/contacts", { params }),
};

export const onboardingApi = {
  list: (params) => api.get("/onboarding", { params }),
  me: () => api.get("/onboarding/me"),
  updateStep: (id, payload) => api.patch(`/onboarding/steps/${id}`, payload),
};

export const searchApi = {
  global: (params) => api.get("/search/global", { params }),
  ai: (payload) => api.post("/search/ai", payload),
};
