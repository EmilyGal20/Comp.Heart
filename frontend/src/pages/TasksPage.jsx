import { useEffect, useMemo, useState } from "react";
import { Add, AttachFile, AutoAwesome, CalendarMonth, CheckCircle, MailOutline, Timeline, ViewKanban, ViewList } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { aiApi, integrationsApi, tasksApi, usersApi, workApi } from "../api/endpoints";
import CardListScroll from "../components/CardListScroll";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import { borderLaneAccent, borderSubtle, surfaceSubtle } from "../styles/muiSurfaces";
import PageHeader from "../components/PageHeader";
import PageState from "../components/PageState";
import PaginationControls from "../components/PaginationControls";
import StatusPill from "../components/StatusPill";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../store/AuthContext";
import { useRealtime } from "../store/RealtimeContext";

const statusOptions = ["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE"];
const priorityOptions = ["low", "medium", "high", "critical"];
const emptyTaskForm = {
  title: "",
  description: "",
  status: "TODO",
  priority: "medium",
  assignee_id: "",
  due_at: "",
  sla_hours: 24,
  tags: "",
  sprint_id: "",
  external_refs: "",
};

function formatDate(value) {
  return value ? dayjs(value).format("MMM D, YYYY HH:mm") : "No due date";
}

function formatDateInput(value) {
  return value ? dayjs(value).format("YYYY-MM-DDTHH:mm") : "";
}

function commentAuthorLabel(c) {
  if (c?.author?.full_name) return c.author.full_name;
  if (c?.author?.email) return c.author.email;
  if (c?.user?.full_name) return c.user.full_name;
  if (c?.user?.email) return c.user.email;
  return "Unknown user";
}

function toPayload(form, organizationId) {
  return {
    ...form,
    organization_id: organizationId,
    assignee_id: form.assignee_id || null,
    due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
    sla_hours: Number(form.sla_hours) || 24,
    tags: String(form.tags || "").split(",").map((item) => item.trim()).filter(Boolean),
    sprint_id: form.sprint_id || null,
    external_refs: String(form.external_refs || "").split("\n").map((item) => item.trim()).filter(Boolean),
  };
}

function TasksPage() {
  const { user, activeOrganizationId } = useAuth();
  const { versions, lastEvent, connectionState } = useRealtime();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const organizationId = activeOrganizationId || user.organization_id;

  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messageMeta, setMessageMeta] = useState(null);
  const [messagePage, setMessagePage] = useState(1);
  const [markingTaskDone, setMarkingTaskDone] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [filters, setFilters] = useState({ search: "", status: "", priority: "", assignee_id: "", watched_only: false });
  const [view, setView] = useState("list");
  const [tab, setTab] = useState(0);

  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [createForm, setCreateForm] = useState(emptyTaskForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const [commentDraft, setCommentDraft] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState([]);
  const [emailRecipients, setEmailRecipients] = useState([]);
  const [emailForm, setEmailForm] = useState({ recipient_ids: [], subject: "", body: "" });

  const currentUserCanCreate = ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"].includes(user.role);
  const canEditSelected = useMemo(() => {
    if (!selected) return false;
    if (["SUPER_ADMIN", "ADMIN"].includes(user.role)) return true;
    if (user.role === "MANAGER" && selected.assignee?.team?.id && user.team?.id) {
      return selected.assignee.team.id === user.team.id || selected.creator?.id === user.id;
    }
    return selected.assignee?.id === user.id || selected.creator?.id === user.id;
  }, [selected, user]);
  const isWatching = Boolean(selected?.watchers?.some((item) => item.user?.id === user.id));

  const groupedTasks = useMemo(() => statusOptions.map((status) => ({ status, items: tasks.filter((task) => task.status === status) })), [tasks]);
  const calendarGroups = useMemo(() => {
    const groups = tasks.reduce((accumulator, task) => {
      const key = task.due_at ? dayjs(task.due_at).format("MMM D") : "No due date";
      accumulator[key] = accumulator[key] || [];
      accumulator[key].push(task);
      return accumulator;
    }, {});
    return Object.entries(groups);
  }, [tasks]);

  const resetDetail = () => {
    setSelected(null);
    setComments([]);
    setActivity([]);
    setAttachments([]);
    setSubtasks([]);
    setMessages([]);
    setMessageMeta(null);
    setMessagePage(1);
    setDetailError("");
    setAiResult("");
  };

  const loadDetail = async (taskId, nextMessagePage = 1) => {
    setDetailLoading(true);
    setDetailError("");
    try {
      const [taskResponse, commentsResponse, activityResponse, attachmentsResponse, subtasksResponse, messagesResponse] = await Promise.all([
        tasksApi.detail(taskId),
        tasksApi.comments(taskId),
        tasksApi.activity(taskId),
        tasksApi.attachments(taskId),
        tasksApi.subtasks(taskId),
        workApi.messages(taskId, { paginated: true, page: nextMessagePage, page_size: 12 }),
      ]);
      const task = taskResponse.data;
      setSelected(task);
      setComments(commentsResponse.data || []);
      setActivity(activityResponse.data || []);
      setAttachments(attachmentsResponse.data || []);
      setSubtasks(subtasksResponse.data || []);
      setMessages(messagesResponse.data.items || []);
      setMessageMeta(messagesResponse.data.meta || null);
      setMessagePage(nextMessagePage);
      setTaskForm({
        title: task.title || "",
        description: task.description || "",
        status: task.status || "TODO",
        priority: task.priority || "medium",
        assignee_id: task.assignee?.id || "",
        due_at: formatDateInput(task.due_at),
        sla_hours: task.sla_hours || 24,
        tags: (task.tags || []).join(", "),
        sprint_id: task.sprint_id || "",
        external_refs: (task.external_refs || []).join("\n"),
      });
    } catch (requestError) {
      setDetailError(requestError.response?.data?.detail || "Unable to load task details");
    } finally {
      setDetailLoading(false);
    }
  };

  const loadList = async () => {
    if (user.role === "SUPER_ADMIN" && !organizationId) {
      setTasks([]);
      setMeta(null);
      setUsers([]);
      setSprints([]);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    try {
      const [tasksResponse, usersResponse, sprintsResponse] = await Promise.all([
        tasksApi.list({
          paginated: true,
          page,
          page_size: 18,
          organization_id: organizationId,
          search: filters.search || undefined,
          status: filters.status || undefined,
          priority: filters.priority || undefined,
          assignee_id: filters.assignee_id || undefined,
          watched_only: filters.watched_only || undefined,
        }),
        usersApi.list({ paginated: true, page: 1, page_size: 100, organization_id: organizationId }),
        workApi.sprints({ organization_id: organizationId }),
      ]);
      setTasks(tasksResponse.data.items || []);
      setMeta(tasksResponse.data.meta || null);
      setUsers(usersResponse.data.items || usersResponse.data || []);
      setSprints(sprintsResponse.data || []);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, [
    organizationId,
    page,
    filters.search,
    filters.status,
    filters.priority,
    filters.assignee_id,
    filters.watched_only,
    versions.tasks,
    versions.analytics,
    versions.activity,
  ]);

  useEffect(() => {
    usersApi.selectableRecipients().then((response) => setEmailRecipients(response.data || [])).catch(() => setEmailRecipients([]));
  }, [organizationId]);

  useEffect(() => {
    setPage(1);
  }, [organizationId, filters.search, filters.status, filters.priority, filters.assignee_id, filters.watched_only]);

  const openTaskId = searchParams.get("taskId");
  useEffect(() => {
    if (!openTaskId) return;
    const n = Number(openTaskId);
    if (Number.isNaN(n) || n <= 0) {
      setSearchParams({}, { replace: true });
      return;
    }
    void loadDetail(n, 1);
    setSearchParams({}, { replace: true });
  }, [openTaskId, setSearchParams]);

  useEffect(() => {
    if (!selected?.id || !lastEvent?.event_type) return;
    if (lastEvent.event_type.startsWith("task_") || lastEvent.event_type.startsWith("chat_") || lastEvent.event_type.startsWith("notification_")) {
      loadDetail(selected.id, messagePage);
    }
  }, [lastEvent?.timestamp]);

  const saveTask = async () => {
    try {
      await tasksApi.update(selected.id, toPayload(taskForm, organizationId));
      await loadList();
      await loadDetail(selected.id, messagePage);
    } catch (requestError) {
      setDetailError(requestError.response?.data?.detail || "Unable to save task");
    }
  };

  const createTask = async () => {
    try {
      await tasksApi.create(toPayload(createForm, organizationId));
      setCreateOpen(false);
      setCreateForm(emptyTaskForm);
      await loadList();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to create task");
    }
  };

  const sendComment = async () => {
    if (!commentDraft.trim()) return;
    await tasksApi.addComment(selected.id, { content: commentDraft });
    setCommentDraft("");
    await loadDetail(selected.id, messagePage);
  };

  const markTaskDone = async () => {
    if (!selected?.id) return;
    setMarkingTaskDone(true);
    setDetailError("");
    const id = selected.id;
    try {
      await tasksApi.updateStatus(id, "DONE");
      resetDetail();
      await loadList();
      navigate(`/task-archive?taskId=${id}`);
    } catch (e) {
      const d = e.response?.data?.detail;
      setDetailError(Array.isArray(d) ? d.map((x) => x?.msg || x).join(" ") : d || e.message || "Could not mark this task as done");
    } finally {
      setMarkingTaskDone(false);
    }
  };

  const sendMessage = async () => {
    if (!messageDraft.trim()) return;
    await workApi.sendMessage(selected.id, messageDraft);
    setMessageDraft("");
    await loadDetail(selected.id, 1);
  };

  const createSubtask = async () => {
    if (!subtaskTitle.trim()) return;
    await tasksApi.createSubtask(selected.id, { title: subtaskTitle, description: "", priority: "medium", tags: [] });
    setSubtaskTitle("");
    await loadDetail(selected.id, messagePage);
  };

  const toggleWatch = async () => {
    if (!selected) return;
    if (isWatching) await tasksApi.unwatch(selected.id);
    else await tasksApi.watch(selected.id);
    await loadDetail(selected.id, messagePage);
  };

  const runAi = async (action) => {
    const response = await tasksApi.aiAssist(selected.id, action);
    setAiResult(response.data.result);
    setTab(5);
  };

  const generateAiTasks = async () => {
    const response = await aiApi.generateTasks({ prompt: aiPrompt, task_count: 4, organization_id: organizationId, sprint_id: createForm.sprint_id || null });
    setAiSuggestions(response.data.suggestions || []);
    setSelectedSuggestions((response.data.suggestions || []).map((_, index) => index));
  };

  const createSelectedAiTasks = async () => {
    const selectedItems = aiSuggestions.filter((_, index) => selectedSuggestions.includes(index));
    await Promise.all(selectedItems.map((item) => tasksApi.create({
      organization_id: organizationId,
      title: item.title,
      description: item.description,
      status: "TODO",
      priority: item.priority,
      assignee_id: item.suggested_assignee_id,
      due_at: new Date(Date.now() + item.due_in_days * 86400000).toISOString(),
      sla_hours: item.sla_hours,
      tags: item.tags,
      sprint_id: createForm.sprint_id || null,
    })));
    setAiOpen(false);
    setAiPrompt("");
    setAiSuggestions([]);
    setSelectedSuggestions([]);
    await loadList();
  };

  const sendEmail = async () => {
    try {
      await integrationsApi.sendEmail({ ...emailForm, task_id: selected?.id || null });
      setEmailOpen(false);
      setEmailForm({ recipient_ids: [], subject: "", body: "" });
    } catch (requestError) {
      setDetailError(requestError.response?.data?.detail || "Unable to send email");
    }
  };

  const requestApproval = async () => {
    try {
      await workApi.requestApproval(selected.id);
      await loadDetail(selected.id, messagePage);
    } catch (requestError) {
      setDetailError(requestError.response?.data?.detail || "Unable to request approval");
    }
  };

  const approvePending = async () => {
    const pending = selected?.approvals?.find((item) => item.status === "PENDING");
    if (!pending) return;
    try {
      await workApi.updateApproval(pending.id, "APPROVED");
      await loadDetail(selected.id, messagePage);
    } catch (requestError) {
      setDetailError(requestError.response?.data?.detail || "Unable to approve task");
    }
  };

  const downloadAttachment = async (attachment) => {
    try {
      const response = await tasksApi.downloadAttachment(selected.id, attachment.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.file_name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setDetailError("Unable to download attachment");
    }
  };

  const uploadAttachment = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await tasksApi.uploadAttachment(selected.id, file);
      await loadDetail(selected.id, messagePage);
    } catch (requestError) {
      setDetailError(requestError.response?.data?.detail || "Unable to upload attachment");
    } finally {
      event.target.value = "";
    }
  };

  const renderTaskCard = (task) => (
    <Box key={task.id} onClick={() => loadDetail(task.id)} sx={{ p: 1.7, borderRadius: 3.5, cursor: "pointer", bgcolor: (theme) => surfaceSubtle(theme), border: (theme) => `1px solid ${borderSubtle(theme)}` }}>
      <Typography variant="subtitle2">{task.title}</Typography>
      <Typography variant="body2" sx={{ mt: 0.7, color: "text.secondary" }}>
        {task.assignee?.full_name || "Unassigned"} · {formatDate(task.due_at)}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 1.1 }} flexWrap="wrap" useFlexGap>
        <StatusPill value={task.status} />
        <StatusPill value={task.priority} />
        <Chip size="small" label={`${task.risk_score || 0} risk`} />
      </Stack>
    </Box>
  );

  return (
    <>
      <PageHeader
        eyebrow={organizationId ? "Execution Workspace" : "Select organization"}
        title="Tasks, delivery flow, and collaborative detail"
        description="Run day-to-day work from one place with stronger validation, stable realtime collaboration, secure attachments, and predictable loading states."
        actions={[
          <Chip key="socket" label={`Realtime ${connectionState}`} color={connectionState === "connected" ? "success" : "default"} variant="outlined" />,
          currentUserCanCreate ? <Button key="ai" variant="outlined" startIcon={<AutoAwesome />} onClick={() => setAiOpen(true)}>Generate with AI</Button> : null,
          currentUserCanCreate ? <Button key="create" variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>New task</Button> : null,
        ].filter(Boolean)}
      />

      {error ? <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert> : null}

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <GlassPanel
            title="Task workspace"
            subtitle={meta ? `${meta.total} tasks in your visible scope` : "Current delivery view"}
            action={
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
                <TextField size="small" label="Search" value={filters.search} onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value }))} />
                <TextField select size="small" label="Status" value={filters.status} onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value }))} sx={{ minWidth: 140 }}>
                  <MenuItem value="">All</MenuItem>
                  {statusOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Priority" value={filters.priority} onChange={(event) => setFilters((previous) => ({ ...previous, priority: event.target.value }))} sx={{ minWidth: 140 }}>
                  <MenuItem value="">All</MenuItem>
                  {priorityOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Assignee" value={filters.assignee_id} onChange={(event) => setFilters((previous) => ({ ...previous, assignee_id: event.target.value }))} sx={{ minWidth: 180 }}>
                  <MenuItem value="">Everyone</MenuItem>
                  {users.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.full_name}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="View" value={view} onChange={(event) => setView(event.target.value)} sx={{ minWidth: 150 }}>
                  <MenuItem value="list"><ViewList fontSize="small" /> List</MenuItem>
                  <MenuItem value="board"><ViewKanban fontSize="small" /> Board</MenuItem>
                  <MenuItem value="calendar"><CalendarMonth fontSize="small" /> Calendar</MenuItem>
                  <MenuItem value="timeline"><Timeline fontSize="small" /> Timeline</MenuItem>
                </TextField>
                <Button variant={filters.watched_only ? "contained" : "outlined"} onClick={() => setFilters((previous) => ({ ...previous, watched_only: !previous.watched_only }))}>
                  Watched only
                </Button>
              </Stack>
            }
          >
            {user.role === "SUPER_ADMIN" && !organizationId ? (
              <PageState empty title="Choose an organization to view tasks" description="Task execution remains organization-scoped, even for super admins. Select a company from the header to work inside its delivery context." />
            ) : (
              <>
                <PageState loading={loading} error={error} empty={!loading && !error && tasks.length === 0} title="No tasks match the current filters" description="Try widening the filters, clearing watched-only mode, or creating a new task." onRetry={loadList} />
                {!loading && !error && tasks.length > 0 ? (
                  <>
                    {view === "list" ? (
                      <CardListScroll count={tasks.length}>
                        <Stack spacing={1.1}>
                          {tasks.map((task) => (
                            <Box key={task.id} onClick={() => loadDetail(task.id)} sx={{ p: 1.8, borderRadius: 3.5, cursor: "pointer", bgcolor: (theme) => surfaceSubtle(theme), border: (theme) => `1px solid ${borderSubtle(theme)}` }}>
                              <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
                                <Box>
                                  <Typography variant="subtitle1">{task.title}</Typography>
                                  <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.6 }}>
                                    {task.assignee?.full_name || "Unassigned"} · {formatDate(task.due_at)}
                                  </Typography>
                                </Box>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                  <StatusPill value={task.status} />
                                  <StatusPill value={task.priority} />
                                  <Chip size="small" label={task.sla_status || "on_track"} />
                                </Stack>
                              </Stack>
                            </Box>
                          ))}
                        </Stack>
                      </CardListScroll>
                    ) : null}

                    {view === "board" ? (
                      <Grid container spacing={2}>
                        {groupedTasks.map((column) => (
                          <Grid item xs={12} md={6} xl={2.4} key={column.status}>
                            <GlassPanel title={column.status.replaceAll("_", " ")} subtitle={`${column.items.length} tasks`}>
                              <CardListScroll count={column.items.length}>
                                <Stack spacing={1.1}>
                                  {column.items.length ? column.items.map(renderTaskCard) : <Typography variant="body2" sx={{ color: "text.secondary" }}>No tasks in this lane.</Typography>}
                                </Stack>
                              </CardListScroll>
                            </GlassPanel>
                          </Grid>
                        ))}
                      </Grid>
                    ) : null}

                    {view === "calendar" ? (
                      <Stack spacing={2}>
                        {calendarGroups.map(([label, items]) => (
                          <GlassPanel key={label} title={label} subtitle={`${items.length} scheduled items`}>
                            <CardListScroll count={items.length}>
                              <Stack spacing={1.1}>{items.length ? items.map(renderTaskCard) : <Typography variant="body2" color="text.secondary">No items.</Typography>}</Stack>
                            </CardListScroll>
                          </GlassPanel>
                        ))}
                      </Stack>
                    ) : null}

                    {view === "timeline" ? (
                      <CardListScroll count={tasks.length} rowEstimatePx={96}>
                        <Stack spacing={1.4}>
                          {tasks.map((task) => (
                            <Box key={task.id} onClick={() => loadDetail(task.id)} sx={{ p: 1.8, borderRadius: 3.5, cursor: "pointer", bgcolor: (theme) => surfaceSubtle(theme), borderLeft: (theme) => `3px solid ${borderLaneAccent(theme)}` }}>
                              <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                                <Box>
                                  <Typography variant="subtitle1">{task.title}</Typography>
                                  <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.6 }}>
                                    {formatDate(task.created_at)} → {formatDate(task.due_at)}
                                  </Typography>
                                </Box>
                                <Stack direction="row" spacing={1}>
                                  <StatusPill value={task.priority} />
                                  <StatusPill value={task.status} />
                                </Stack>
                              </Stack>
                            </Box>
                          ))}
                        </Stack>
                      </CardListScroll>
                    ) : null}

                    <PaginationControls meta={meta} page={page} onChange={setPage} />
                  </>
                ) : null}
              </>
            )}
          </GlassPanel>
        </Grid>
      </Grid>

      <Drawer anchor="right" open={Boolean(selected)} onClose={resetDetail}>
        <Stack sx={{ width: { xs: 360, md: 620 }, p: 3 }} spacing={2}>
          <PageState loading={detailLoading} error={detailError} onRetry={() => selected?.id && loadDetail(selected.id, messagePage)} />
          {selected && !detailLoading ? (
            <>
              <Stack direction="row" justifyContent="space-between" spacing={1.2}>
                <Box>
                  <Typography variant="h5">{selected.title}</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.7 }}>
                    {selected.creator?.full_name || "Unknown creator"} · {formatDate(selected.created_at)}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <StatusPill value={selected.status} />
                  <StatusPill value={selected.priority} />
                  <Chip size="small" label={`${selected.risk_score || 0} risk`} />
                </Stack>
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {canEditSelected && selected.status !== "DONE" ? (
                  <Button
                    variant="contained"
                    startIcon={<CheckCircle />}
                    disabled={markingTaskDone}
                    onClick={() => { void markTaskDone(); }}
                  >
                    {markingTaskDone ? "Finishing…" : "Mark as done"}
                  </Button>
                ) : null}
                {selected.status === "DONE" ? (
                  <Button variant="outlined" onClick={() => navigate(`/task-archive?taskId=${selected.id}`)}>View in archive</Button>
                ) : null}
                <Button variant="outlined" onClick={toggleWatch}>{isWatching ? "Unwatch" : "Watch"}</Button>
                {canEditSelected ? <Button variant="outlined" onClick={saveTask}>Save changes</Button> : null}
                <Button variant="outlined" onClick={requestApproval}>Request approval</Button>
                {["SUPER_ADMIN", "ADMIN"].includes(user.role) ? <Button variant="outlined" onClick={approvePending}>Approve pending</Button> : null}
                <Button variant="outlined" startIcon={<MailOutline />} onClick={() => setEmailOpen(true)}>Send update</Button>
              </Stack>

              <Grid container spacing={2}>
                <Grid item xs={12} md={8}><TextField fullWidth label="Title" value={taskForm.title} disabled={!canEditSelected} onChange={(event) => setTaskForm((previous) => ({ ...previous, title: event.target.value }))} /></Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth select label="Assignee" value={taskForm.assignee_id} disabled={!canEditSelected} onChange={(event) => setTaskForm((previous) => ({ ...previous, assignee_id: event.target.value }))}>
                    <MenuItem value="">Unassigned</MenuItem>
                    {users.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.full_name}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12}><TextField fullWidth multiline minRows={4} label="Description" value={taskForm.description} disabled={!canEditSelected} onChange={(event) => setTaskForm((previous) => ({ ...previous, description: event.target.value }))} /></Grid>
                <Grid item xs={12} md={3}>
                  <TextField fullWidth select label="Status" value={taskForm.status} disabled={!canEditSelected} onChange={(event) => setTaskForm((previous) => ({ ...previous, status: event.target.value }))}>
                    {statusOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField fullWidth select label="Priority" value={taskForm.priority} disabled={!canEditSelected} onChange={(event) => setTaskForm((previous) => ({ ...previous, priority: event.target.value }))}>
                    {priorityOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={3}><TextField fullWidth label="Due date" type="datetime-local" value={taskForm.due_at} disabled={!canEditSelected} onChange={(event) => setTaskForm((previous) => ({ ...previous, due_at: event.target.value }))} InputLabelProps={{ shrink: true }} /></Grid>
                <Grid item xs={12} md={3}><TextField fullWidth label="SLA hours" type="number" value={taskForm.sla_hours} disabled={!canEditSelected} onChange={(event) => setTaskForm((previous) => ({ ...previous, sla_hours: event.target.value }))} /></Grid>
                <Grid item xs={12} md={6}><TextField fullWidth label="Tags" value={taskForm.tags} disabled={!canEditSelected} onChange={(event) => setTaskForm((previous) => ({ ...previous, tags: event.target.value }))} helperText="Comma-separated" /></Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth select label="Sprint" value={taskForm.sprint_id} disabled={!canEditSelected} onChange={(event) => setTaskForm((previous) => ({ ...previous, sprint_id: event.target.value }))}>
                    <MenuItem value="">Backlog</MenuItem>
                    {sprints.map((sprint) => <MenuItem key={sprint.id} value={sprint.id}>{sprint.name}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12}><TextField fullWidth multiline minRows={3} label="External references" value={taskForm.external_refs} disabled={!canEditSelected} onChange={(event) => setTaskForm((previous) => ({ ...previous, external_refs: event.target.value }))} helperText="One reference per line" /></Grid>
              </Grid>

              <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable">
                <Tab label={`Comments (${comments.length})`} />
                <Tab label={`Activity (${activity.length})`} />
                <Tab label={`Chat (${messageMeta?.total || messages.length})`} />
                <Tab label={`Attachments (${attachments.length})`} />
                <Tab label={`Subtasks (${subtasks.length})`} />
                <Tab label="AI" />
              </Tabs>

              {tab === 0 ? (
                <Stack spacing={1.2}>
                  <TextField fullWidth multiline minRows={3} label="Add comment" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} />
                  <Button variant="contained" onClick={sendComment}>Post comment</Button>
                  <Divider />
                  {comments.length ? comments.map((item) => (
                    <Box key={item.id} sx={{ p: 1.6, borderRadius: 3, bgcolor: (theme) => surfaceSubtle(theme) }}>
                      <Typography variant="subtitle2">{commentAuthorLabel(item)}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>{formatDate(item.created_at)}</Typography>
                      <Typography variant="body2" sx={{ mt: 0.8, whiteSpace: "pre-wrap" }}>{item.content}</Typography>
                    </Box>
                  )) : <Typography variant="body2" sx={{ color: "text.secondary" }}>No comments yet.</Typography>}
                </Stack>
              ) : null}

              {tab === 1 ? (
                <Stack spacing={1.2}>
                  {activity.length ? activity.map((item) => (
                    <Box key={item.id} sx={{ p: 1.6, borderRadius: 3, bgcolor: (theme) => surfaceSubtle(theme) }}>
                      <Typography variant="subtitle2">{item.message}</Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.7 }}>{item.action_type} · {formatDate(item.created_at)}</Typography>
                    </Box>
                  )) : <Typography variant="body2" sx={{ color: "text.secondary" }}>No activity yet.</Typography>}
                </Stack>
              ) : null}

              {tab === 2 ? (
                <Stack spacing={1.2}>
                  <TextField fullWidth multiline minRows={2} label="Send a quick message" value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} />
                  <Button variant="contained" onClick={sendMessage}>Send message</Button>
                  <Divider />
                  {messages.length ? messages.map((item) => (
                    <Box key={item.id} sx={{ p: 1.6, borderRadius: 3, bgcolor: (theme) => surfaceSubtle(theme) }}>
                      <Typography variant="subtitle2">{item.user?.full_name || "Unknown"}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>{formatDate(item.created_at)}</Typography>
                      <Typography variant="body2" sx={{ mt: 0.8, whiteSpace: "pre-wrap" }}>{item.message}</Typography>
                    </Box>
                  )) : <Typography variant="body2" sx={{ color: "text.secondary" }}>No messages yet.</Typography>}
                  <PaginationControls meta={messageMeta} page={messagePage} onChange={(nextPage) => loadDetail(selected.id, nextPage)} />
                </Stack>
              ) : null}

              {tab === 3 ? (
                <Stack spacing={1.2}>
                  <Button variant="outlined" startIcon={<AttachFile />} component="label">
                    Upload attachment
                    <input hidden type="file" onChange={uploadAttachment} />
                  </Button>
                  {attachments.length ? attachments.map((item) => (
                    <Stack key={item.id} direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1.5, borderRadius: 3, bgcolor: (theme) => surfaceSubtle(theme) }}>
                      <Box>
                        <Typography variant="subtitle2">{item.file_name}</Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>Uploaded {formatDate(item.created_at)}</Typography>
                      </Box>
                      <Button onClick={() => downloadAttachment(item)}>Download</Button>
                    </Stack>
                  )) : <Typography variant="body2" sx={{ color: "text.secondary" }}>No attachments yet.</Typography>}
                </Stack>
              ) : null}

              {tab === 4 ? (
                <Stack spacing={1.2}>
                  <TextField fullWidth label="New subtask" value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} />
                  <Button variant="contained" onClick={createSubtask}>Create subtask</Button>
                  {subtasks.length ? subtasks.map((item) => (
                    <Box key={item.id} sx={{ p: 1.5, borderRadius: 3, bgcolor: (theme) => surfaceSubtle(theme) }}>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Typography variant="subtitle2">{item.title}</Typography>
                        <Stack direction="row" spacing={1}>
                          <StatusPill value={item.priority} />
                          <StatusPill value={item.status} />
                        </Stack>
                      </Stack>
                    </Box>
                  )) : <Typography variant="body2" sx={{ color: "text.secondary" }}>No subtasks yet.</Typography>}
                </Stack>
              ) : null}

              {tab === 5 ? (
                <Stack spacing={1.2}>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button variant="outlined" onClick={() => runAi("summarize")}>Summarize task</Button>
                    <Button variant="outlined" onClick={() => runAi("next_steps")}>Suggest next steps</Button>
                    <Button variant="outlined" onClick={() => runAi("subtasks")}>Break into subtasks</Button>
                  </Stack>
                  <GlassPanel title="AI result" subtitle="Task-aware guidance within your organization scope">
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: "text.primary" }}>
                      {aiResult || "Run an AI helper to generate a task summary, suggested next steps, or subtask plan."}
                    </Typography>
                  </GlassPanel>
                </Stack>
              ) : null}
            </>
          ) : null}
        </Stack>
      </Drawer>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Create task</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={8}><TextField fullWidth label="Title" value={createForm.title} onChange={(event) => setCreateForm((previous) => ({ ...previous, title: event.target.value }))} /></Grid>
            <Grid item xs={12} md={4}>
              <TextField select fullWidth label="Assignee" value={createForm.assignee_id} onChange={(event) => setCreateForm((previous) => ({ ...previous, assignee_id: event.target.value }))}>
                <MenuItem value="">Unassigned</MenuItem>
                {users.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.full_name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12}><TextField fullWidth multiline minRows={4} label="Description" value={createForm.description} onChange={(event) => setCreateForm((previous) => ({ ...previous, description: event.target.value }))} /></Grid>
            <Grid item xs={12} md={3}><TextField select fullWidth label="Status" value={createForm.status} onChange={(event) => setCreateForm((previous) => ({ ...previous, status: event.target.value }))}>{statusOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}</TextField></Grid>
            <Grid item xs={12} md={3}><TextField select fullWidth label="Priority" value={createForm.priority} onChange={(event) => setCreateForm((previous) => ({ ...previous, priority: event.target.value }))}>{priorityOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}</TextField></Grid>
            <Grid item xs={12} md={3}><TextField fullWidth type="datetime-local" label="Due date" value={createForm.due_at} onChange={(event) => setCreateForm((previous) => ({ ...previous, due_at: event.target.value }))} InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12} md={3}><TextField fullWidth type="number" label="SLA hours" value={createForm.sla_hours} onChange={(event) => setCreateForm((previous) => ({ ...previous, sla_hours: event.target.value }))} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth label="Tags" value={createForm.tags} onChange={(event) => setCreateForm((previous) => ({ ...previous, tags: event.target.value }))} helperText="Comma-separated" /></Grid>
            <Grid item xs={12} md={6}>
              <TextField select fullWidth label="Sprint" value={createForm.sprint_id} onChange={(event) => setCreateForm((previous) => ({ ...previous, sprint_id: event.target.value }))}>
                <MenuItem value="">Backlog</MenuItem>
                {sprints.map((sprint) => <MenuItem key={sprint.id} value={sprint.id}>{sprint.name}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createTask}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={aiOpen} onClose={() => setAiOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Generate tasks with AI</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField fullWidth multiline minRows={4} label="Goal or prompt" value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} />
            <Button variant="contained" startIcon={<AutoAwesome />} onClick={generateAiTasks}>Generate suggestions</Button>
            {aiSuggestions.map((item, index) => (
              <Box key={`${item.title}-${index}`} sx={{ p: 1.6, borderRadius: 3, bgcolor: (theme) => surfaceSubtle(theme) }}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Box>
                    <Typography variant="subtitle2">{item.title}</Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.7 }}>{item.rationale}</Typography>
                  </Box>
                  <Button
                    variant={selectedSuggestions.includes(index) ? "contained" : "outlined"}
                    onClick={() => setSelectedSuggestions((previous) => previous.includes(index) ? previous.filter((value) => value !== index) : [...previous, index])}
                  >
                    {selectedSuggestions.includes(index) ? "Selected" : "Select"}
                  </Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAiOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createSelectedAiTasks} disabled={!selectedSuggestions.length}>Create selected</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={emailOpen} onClose={() => setEmailOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Send task update</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              select
              fullWidth
              label="Recipients"
              SelectProps={{ multiple: true }}
              value={emailForm.recipient_ids}
              onChange={(event) => setEmailForm((previous) => ({ ...previous, recipient_ids: event.target.value }))}
            >
              {emailRecipients.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.full_name} · {entry.email}</MenuItem>)}
            </TextField>
            <TextField fullWidth label="Subject" value={emailForm.subject} onChange={(event) => setEmailForm((previous) => ({ ...previous, subject: event.target.value }))} />
            <TextField fullWidth multiline minRows={4} label="Body" value={emailForm.body} onChange={(event) => setEmailForm((previous) => ({ ...previous, body: event.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={sendEmail}>Send</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default TasksPage;
