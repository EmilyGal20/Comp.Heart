import { useEffect, useMemo, useRef, useState } from "react";
import { Add, AttachFile, AutoAwesome, CalendarMonth, MailOutline, Search, Timeline, ViewKanban, ViewList, Visibility, VisibilityOff } from "@mui/icons-material";
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, Grid, InputAdornment, List, ListItem, ListItemText, MenuItem, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import dayjs from "dayjs";
import { aiApi, integrationsApi, tasksApi, usersApi, workApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import { useAuth } from "../store/AuthContext";
import { useRealtime } from "../store/RealtimeContext";

const statusOptions = ["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE"];
const priorityOptions = ["low", "medium", "high", "critical"];
const emptyForm = { title: "", description: "", status: "TODO", priority: "medium", assignee_id: "", due_at: "", sla_hours: 24, tags: "", sprint_id: "", external_refs: "" };
const fmt = (value) => (value ? dayjs(value).format("MMM D, HH:mm") : "TBD");
const localDt = (value) => (value ? dayjs(value).format("YYYY-MM-DDTHH:mm") : "");

function TasksPage() {
  const { user, activeOrganizationId } = useAuth();
  const { versions, connectionState, lastEvent } = useRealtime();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [selected, setSelected] = useState(null);
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [messages, setMessages] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(0);
  const [view, setView] = useState("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState([]);
  const [emailRecipients, setEmailRecipients] = useState([]);
  const [emailForm, setEmailForm] = useState({ recipient_ids: [], subject: "", body: "" });
  const [filters, setFilters] = useState({ search: "", status: "", priority: "", assignee_id: "", watched_only: false });
  const fileRef = useRef(null);
  const orgId = activeOrganizationId || user.organization_id;

  const loadList = async () => {
    setLoading(true);
    try {
      const [taskResponse, userResponse, sprintResponse] = await Promise.all([
        tasksApi.list({ organization_id: orgId, search: filters.search || undefined, status: filters.status || undefined, priority: filters.priority || undefined, assignee_id: filters.assignee_id || undefined, watched_only: filters.watched_only || undefined }),
        usersApi.list({ organization_id: orgId }),
        workApi.sprints({ organization_id: orgId }),
      ]);
      setTasks(taskResponse.data);
      setUsers(userResponse.data);
      setSprints(sprintResponse.data);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load tasks");
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id) => {
    setDetailLoading(true);
    const [task, commentResponse, activityResponse, attachmentResponse, subtaskResponse, messageResponse] = await Promise.all([
      tasksApi.detail(id),
      tasksApi.comments(id),
      tasksApi.activity(id),
      tasksApi.attachments(id),
      tasksApi.subtasks(id),
      workApi.messages(id),
    ]);
    setSelected(task.data);
    setComments(commentResponse.data);
    setActivity(activityResponse.data);
    setAttachments(attachmentResponse.data);
    setSubtasks(subtaskResponse.data);
    setMessages(messageResponse.data);
    setForm({
      title: task.data.title,
      description: task.data.description,
      status: task.data.status,
      priority: task.data.priority,
      assignee_id: task.data.assignee?.id || "",
      due_at: localDt(task.data.due_at),
      sla_hours: task.data.sla_hours,
      tags: (task.data.tags || []).join(", "),
      sprint_id: task.data.sprint_id || "",
      external_refs: (task.data.external_refs || []).join("\n"),
    });
    setDetailLoading(false);
  };

  useEffect(() => {
    loadList();
    usersApi.selectableRecipients().then((response) => setEmailRecipients(response.data)).catch(() => {});
  }, [orgId, filters.search, filters.status, filters.priority, filters.assignee_id, filters.watched_only, versions.tasks, versions.activity, versions.analytics]);

  useEffect(() => {
    if (selected?.id && lastEvent?.event_type?.includes("task")) loadDetail(selected.id);
  }, [lastEvent?.timestamp]);

  const grouped = useMemo(() => statusOptions.map((status) => ({ status, items: tasks.filter((task) => task.status === status) })), [tasks]);
  const byDate = useMemo(() => Object.entries(tasks.reduce((accumulator, task) => { const key = task.due_at ? dayjs(task.due_at).format("MMM D") : "No due date"; accumulator[key] = accumulator[key] || []; accumulator[key].push(task); return accumulator; }, {})), [tasks]);
  const canEdit = useMemo(() => selected && (["SUPER_ADMIN", "ADMIN"].includes(user.role) || selected.assignee?.id === user.id || selected.creator?.id === user.id || (user.role === "MANAGER" && selected.assignee?.team?.id === user.team?.id)), [selected, user]);
  const watching = Boolean(selected?.watchers?.some((item) => item.user?.id === user.id));

  const openTask = async (id) => { setTab(0); setAiResult(""); await loadDetail(id); };
  const saveTask = async () => { await tasksApi.update(selected.id, { ...form, assignee_id: form.assignee_id || null, due_at: form.due_at ? new Date(form.due_at).toISOString() : null, tags: form.tags.split(",").map((item) => item.trim()).filter(Boolean), sprint_id: form.sprint_id || null, external_refs: form.external_refs.split("\n").map((item) => item.trim()).filter(Boolean) }); await loadList(); await loadDetail(selected.id); };
  const createTask = async () => { await tasksApi.create({ ...createForm, organization_id: orgId, assignee_id: createForm.assignee_id || null, due_at: createForm.due_at ? new Date(createForm.due_at).toISOString() : null, tags: createForm.tags.split(",").map((item) => item.trim()).filter(Boolean), sprint_id: createForm.sprint_id || null, external_refs: createForm.external_refs.split("\n").map((item) => item.trim()).filter(Boolean) }); setCreateOpen(false); setCreateForm(emptyForm); await loadList(); };
  const sendComment = async () => { if (!commentDraft.trim()) return; await tasksApi.addComment(selected.id, { content: commentDraft }); setCommentDraft(""); await loadDetail(selected.id); };
  const sendMessage = async () => { if (!messageDraft.trim()) return; await workApi.sendMessage(selected.id, messageDraft); setMessageDraft(""); await loadDetail(selected.id); };
  const upload = async (event) => { const file = event.target.files?.[0]; if (!file) return; await tasksApi.uploadAttachment(selected.id, file); event.target.value = ""; await loadDetail(selected.id); };
  const createSubtask = async () => { if (!subtaskTitle.trim()) return; await tasksApi.createSubtask(selected.id, { title: subtaskTitle, description: "", priority: "medium", tags: [] }); setSubtaskTitle(""); await loadDetail(selected.id); };
  const requestApproval = async () => { await workApi.requestApproval(selected.id); await loadDetail(selected.id); };
  const approve = async () => { const pending = selected.approvals?.find((item) => item.status === "PENDING"); if (pending) { await workApi.updateApproval(pending.id, "APPROVED"); await loadDetail(selected.id); } };
  const runAi = async (action) => { const response = await tasksApi.aiAssist(selected.id, action); setAiResult(response.data.result); setTab(5); };
  const toggleWatch = async () => { if (watching) await tasksApi.unwatch(selected.id); else await tasksApi.watch(selected.id); await loadDetail(selected.id); };
  const generateAiTasks = async () => { const response = await aiApi.generateTasks({ prompt: aiPrompt, task_count: 4, organization_id: orgId, sprint_id: createForm.sprint_id || null }); setAiSuggestions(response.data.suggestions); setSelectedSuggestions(response.data.suggestions.map((_, index) => index)); };
  const createSelectedAiTasks = async () => { const chosen = aiSuggestions.filter((_, index) => selectedSuggestions.includes(index)); await Promise.all(chosen.map((item) => tasksApi.create({ organization_id: orgId, title: item.title, description: item.description, status: "TODO", priority: item.priority, assignee_id: item.suggested_assignee_id, due_at: new Date(Date.now() + item.due_in_days * 86400000).toISOString(), sla_hours: item.sla_hours, tags: item.tags, related_knowledge_ids: item.related_knowledge_ids, sprint_id: createForm.sprint_id || null }))); setAiOpen(false); setAiSuggestions([]); setSelectedSuggestions([]); setAiPrompt(""); await loadList(); };
  const sendEmail = async () => { await integrationsApi.sendEmail({ ...emailForm, task_id: selected?.id || null }); setEmailOpen(false); setEmailForm({ recipient_ids: [], subject: "", body: "" }); };
  const renderCard = (task) => <Box key={task.id} onClick={() => openTask(task.id)} sx={{ p: 1.7, borderRadius: 3.5, cursor: "pointer", bgcolor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.08)" }}><Typography variant="subtitle2">{task.title}</Typography><Typography variant="body2" sx={{ mt: 0.7, color: "rgba(226,232,240,0.62)" }}>{task.assignee?.full_name || "Unassigned"}</Typography><Stack direction="row" spacing={1} sx={{ mt: 1.1 }} flexWrap="wrap" useFlexGap><StatusPill value={task.status} /><StatusPill value={task.priority} /><Chip size="small" label={`${task.risk_score || 0} risk`} color={task.sla_status === "breached" ? "warning" : "default"} /></Stack></Box>;

  return (
    <>
      <PageHeader eyebrow="Work Management" title="Tasks, AI generation, approvals, and collaborative execution" description="A more breathable task workspace with list, board, calendar, and timeline views, richer task details, internal updates, and email-ready coordination." actions={[<Chip key="live" label={`Realtime ${connectionState}`} color={connectionState === "connected" ? "success" : "default"} />, <Button key="ai" startIcon={<AutoAwesome />} variant="outlined" onClick={() => setAiOpen(true)}>Generate with AI</Button>, <Button key="new" startIcon={<Add />} variant="contained" onClick={() => setCreateOpen(true)}>New task</Button>]} />
      {error ? <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert> : null}
      <GlassPanel title="Task workspace" subtitle={`${tasks.length} tasks visible across your current scope`} action={<Stack direction={{ xs: "column", xl: "row" }} spacing={1}><TextField size="small" label="Search" value={filters.search} onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value }))} InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} /><TextField size="small" select label="Status" value={filters.status} onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value }))}><MenuItem value="">All</MenuItem>{statusOptions.map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}</TextField><TextField size="small" select label="Priority" value={filters.priority} onChange={(event) => setFilters((previous) => ({ ...previous, priority: event.target.value }))}><MenuItem value="">All</MenuItem>{priorityOptions.map((priority) => <MenuItem key={priority} value={priority}>{priority}</MenuItem>)}</TextField><Button variant={filters.watched_only ? "contained" : "outlined"} onClick={() => setFilters((previous) => ({ ...previous, watched_only: !previous.watched_only }))}>Watched</Button>{["list", "board", "calendar", "timeline"].map((option) => <Button key={option} variant={view === option ? "contained" : "outlined"} startIcon={option === "list" ? <ViewList /> : option === "board" ? <ViewKanban /> : option === "calendar" ? <CalendarMonth /> : <Timeline />} onClick={() => setView(option)}>{option}</Button>)}</Stack>}>
        {loading ? <CircularProgress /> : null}
        {!loading && view === "list" ? <Stack spacing={1.1}>{tasks.map((task) => <Box key={task.id} onClick={() => openTask(task.id)} sx={{ p: 1.6, borderRadius: 3.5, cursor: "pointer", bgcolor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.08)" }}><Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" spacing={1.5}><Box><Typography variant="subtitle2">{task.title}</Typography><Typography variant="body2" sx={{ mt: 0.7, color: "rgba(226,232,240,0.62)" }}>{task.assignee?.full_name || "Unassigned"} · Due {fmt(task.due_at)}</Typography></Box><Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap><StatusPill value={task.status} /><StatusPill value={task.priority} /><Chip size="small" label={task.sprint_id ? `Sprint ${task.sprint_id}` : "Backlog"} /><Chip size="small" color={task.sla_status === "breached" ? "warning" : "default"} label={`${task.risk_score || 0} risk`} /></Stack></Stack></Box>)}</Stack> : null}
        {!loading && view === "board" ? <Grid container spacing={2.2}>{grouped.map((column) => <Grid item xs={12} md={6} xl={2.4} key={column.status}><Stack spacing={1.15}><Typography variant="subtitle2">{column.status}</Typography>{column.items.map(renderCard)}</Stack></Grid>)}</Grid> : null}
        {!loading && view === "calendar" ? <Grid container spacing={2.2}>{byDate.map(([day, items]) => <Grid item xs={12} md={6} key={day}><GlassPanel title={day}><Stack spacing={1}>{items.map(renderCard)}</Stack></GlassPanel></Grid>)}</Grid> : null}
        {!loading && view === "timeline" ? <Stack spacing={1.2}>{tasks.map((task) => <Box key={task.id} sx={{ p: 1.6, borderRadius: 3.5, bgcolor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.08)" }}><Typography variant="subtitle2">{task.title}</Typography><Box sx={{ mt: 1.2, height: 9, borderRadius: 99, bgcolor: "rgba(255,255,255,0.06)", overflow: "hidden" }}><Box sx={{ width: `${Math.min(task.risk_score || 20, 100)}%`, height: "100%", bgcolor: task.sla_status === "breached" ? "error.main" : "info.main" }} /></Box><Typography variant="body2" sx={{ mt: 1, color: "rgba(226,232,240,0.62)" }}>Due {fmt(task.due_at)} · {task.sprint_id ? `Sprint ${task.sprint_id}` : "Backlog"}</Typography></Box>)}</Stack> : null}
      </GlassPanel>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="md"><DialogTitle>Create task</DialogTitle><DialogContent><Grid container spacing={2} sx={{ mt: 0.5 }}><Grid item xs={12} md={8}><Stack spacing={2}><TextField label="Title" value={createForm.title} onChange={(event) => setCreateForm((previous) => ({ ...previous, title: event.target.value }))} /><TextField label="Description" multiline minRows={5} value={createForm.description} onChange={(event) => setCreateForm((previous) => ({ ...previous, description: event.target.value }))} /><TextField label="External references" multiline minRows={3} placeholder="GitHub issue, PR, Slack thread, or URL per line" value={createForm.external_refs} onChange={(event) => setCreateForm((previous) => ({ ...previous, external_refs: event.target.value }))} /></Stack></Grid><Grid item xs={12} md={4}><Stack spacing={2}><TextField select label="Priority" value={createForm.priority} onChange={(event) => setCreateForm((previous) => ({ ...previous, priority: event.target.value }))}>{priorityOptions.map((priority) => <MenuItem key={priority} value={priority}>{priority}</MenuItem>)}</TextField><TextField select label="Assignee" value={createForm.assignee_id} onChange={(event) => setCreateForm((previous) => ({ ...previous, assignee_id: event.target.value }))}><MenuItem value="">Unassigned</MenuItem>{users.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.full_name}</MenuItem>)}</TextField><TextField select label="Sprint" value={createForm.sprint_id} onChange={(event) => setCreateForm((previous) => ({ ...previous, sprint_id: event.target.value }))}><MenuItem value="">Backlog</MenuItem>{sprints.map((sprint) => <MenuItem key={sprint.id} value={sprint.id}>{sprint.name}</MenuItem>)}</TextField><TextField type="datetime-local" label="Due date" InputLabelProps={{ shrink: true }} value={createForm.due_at} onChange={(event) => setCreateForm((previous) => ({ ...previous, due_at: event.target.value }))} /><TextField label="Tags" value={createForm.tags} onChange={(event) => setCreateForm((previous) => ({ ...previous, tags: event.target.value }))} /></Stack></Grid></Grid></DialogContent><DialogActions><Button onClick={() => setCreateOpen(false)}>Cancel</Button><Button variant="contained" onClick={createTask}>Create</Button></DialogActions></Dialog>

      <Dialog open={aiOpen} onClose={() => setAiOpen(false)} fullWidth maxWidth="md"><DialogTitle>Generate tasks with AI</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField label="Prompt" multiline minRows={4} placeholder="Create rollout plan for client escalation process" value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} /><Button startIcon={<AutoAwesome />} variant="outlined" onClick={generateAiTasks}>Generate suggestions</Button><Stack spacing={1.2}>{aiSuggestions.map((item, index) => <Box key={`${item.title}-${index}`} sx={{ p: 1.6, borderRadius: 3.5, bgcolor: "rgba(255,255,255,0.03)" }}><Stack direction="row" justifyContent="space-between" spacing={1.5}><Box sx={{ flex: 1 }}><Typography variant="subtitle2">{item.title}</Typography><Typography variant="body2" sx={{ mt: 0.7, color: "rgba(226,232,240,0.64)", whiteSpace: "pre-wrap" }}>{item.description}</Typography><Stack direction="row" spacing={1} sx={{ mt: 1.1 }} flexWrap="wrap" useFlexGap><Chip size="small" label={item.priority} /><Chip size="small" label={`Due in ${item.due_in_days}d`} />{item.suggested_assignee_name ? <Chip size="small" label={item.suggested_assignee_name} /> : null}</Stack></Box><Button variant={selectedSuggestions.includes(index) ? "contained" : "outlined"} onClick={() => setSelectedSuggestions((previous) => previous.includes(index) ? previous.filter((value) => value !== index) : [...previous, index])}>{selectedSuggestions.includes(index) ? "Selected" : "Select"}</Button></Stack></Box>)}</Stack></Stack></DialogContent><DialogActions><Button onClick={() => setAiOpen(false)}>Cancel</Button><Button variant="contained" onClick={createSelectedAiTasks} disabled={!selectedSuggestions.length}>Create selected tasks</Button></DialogActions></Dialog>

      <Dialog open={emailOpen} onClose={() => setEmailOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Send task update by email</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField select label="Recipients" SelectProps={{ multiple: true }} value={emailForm.recipient_ids} onChange={(event) => setEmailForm((previous) => ({ ...previous, recipient_ids: event.target.value }))}>{emailRecipients.map((recipient) => <MenuItem key={recipient.id} value={recipient.id}>{recipient.full_name}</MenuItem>)}</TextField><TextField label="Subject" value={emailForm.subject} onChange={(event) => setEmailForm((previous) => ({ ...previous, subject: event.target.value }))} /><TextField label="Body" multiline minRows={6} value={emailForm.body} onChange={(event) => setEmailForm((previous) => ({ ...previous, body: event.target.value }))} /></Stack></DialogContent><DialogActions><Button onClick={() => setEmailOpen(false)}>Cancel</Button><Button variant="contained" onClick={sendEmail}>Send</Button></DialogActions></Dialog>

      <Drawer anchor="right" open={Boolean(selected?.id)} onClose={() => setSelected(null)}><Box sx={{ width: { xs: 420, lg: 900 }, p: { xs: 2.5, lg: 3.5 } }}>{detailLoading || !selected ? <CircularProgress /> : <Stack spacing={2.5}><Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}><Box sx={{ flex: 1 }}><TextField fullWidth variant="standard" value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} InputProps={{ readOnly: !canEdit, disableUnderline: !canEdit, sx: { fontSize: 28, fontWeight: 700 } }} /><Typography variant="body2" sx={{ color: "rgba(226,232,240,0.6)", mt: 1 }}>Updated {fmt(selected.updated_at)} · {selected.watchers?.length || 0} watcher(s)</Typography></Box><Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap><Button variant={watching ? "contained" : "outlined"} startIcon={watching ? <VisibilityOff /> : <Visibility />} onClick={toggleWatch}>{watching ? "Watching" : "Watch"}</Button><Button variant="outlined" startIcon={<MailOutline />} onClick={() => { setEmailForm({ recipient_ids: selected.assignee?.id ? [selected.assignee.id] : [], subject: `Update: ${selected.title}`, body: `Task: ${selected.title}\nStatus: ${selected.status}\n\nUpdate:\n` }); setEmailOpen(true); }}>Email update</Button><StatusPill value={selected.status} /><StatusPill value={selected.priority} /><Chip color={selected.sla_status === "breached" ? "warning" : "default"} label={`${selected.risk_score || 0} risk`} /></Stack></Stack><Grid container spacing={2.5}><Grid item xs={12} md={7.5}><TextField fullWidth multiline minRows={8} label="Description" value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} InputProps={{ readOnly: !canEdit }} /></Grid><Grid item xs={12} md={4.5}><Stack spacing={1.5}><TextField select label="Priority" value={form.priority} onChange={(event) => setForm((previous) => ({ ...previous, priority: event.target.value }))} disabled={!canEdit}>{priorityOptions.map((priority) => <MenuItem key={priority} value={priority}>{priority}</MenuItem>)}</TextField><TextField select label="Assignee" value={form.assignee_id} onChange={(event) => setForm((previous) => ({ ...previous, assignee_id: event.target.value }))} disabled={!canEdit}><MenuItem value="">Unassigned</MenuItem>{users.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.full_name}</MenuItem>)}</TextField><TextField select label="Sprint" value={form.sprint_id} onChange={(event) => setForm((previous) => ({ ...previous, sprint_id: event.target.value }))} disabled={!canEdit}><MenuItem value="">Backlog</MenuItem>{sprints.map((sprint) => <MenuItem key={sprint.id} value={sprint.id}>{sprint.name}</MenuItem>)}</TextField><TextField type="datetime-local" label="Due date" value={form.due_at} onChange={(event) => setForm((previous) => ({ ...previous, due_at: event.target.value }))} InputLabelProps={{ shrink: true }} disabled={!canEdit} /><TextField label="Tags" value={form.tags} onChange={(event) => setForm((previous) => ({ ...previous, tags: event.target.value }))} disabled={!canEdit} /><TextField label="External references" multiline minRows={4} value={form.external_refs} onChange={(event) => setForm((previous) => ({ ...previous, external_refs: event.target.value }))} disabled={!canEdit} /><Button variant="contained" onClick={saveTask} disabled={!canEdit}>Save changes</Button><Button onClick={requestApproval}>Request approval</Button>{selected.approvals?.some((item) => item.status === "PENDING") ? <Button color="success" onClick={approve}>Approve pending</Button> : null}</Stack></Grid></Grid><Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable"><Tab label="Comments" /><Tab label="Activity" /><Tab label="Chat" /><Tab label="Attachments" /><Tab label="Subtasks" /><Tab label="AI" /></Tabs><Divider sx={{ borderColor: "rgba(148,163,184,0.08)" }} />{tab === 0 ? <Stack spacing={2}><TextField multiline minRows={3} label="Add comment" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} /><Button variant="contained" onClick={sendComment}>Post comment</Button><List sx={{ p: 0 }}>{comments.map((entry) => <ListItem key={entry.id} sx={{ px: 0 }}><ListItemText primary={`${entry.author?.full_name || "Unknown"} · ${fmt(entry.created_at)}`} secondary={entry.content} /></ListItem>)}</List></Stack> : null}{tab === 1 ? <Stack spacing={1.1}>{activity.map((entry) => <Box key={entry.id} sx={{ p: 1.4, borderRadius: 3.5, bgcolor: "rgba(255,255,255,0.03)" }}><Typography variant="subtitle2">{entry.message}</Typography><Typography variant="body2" sx={{ mt: 0.7, color: "rgba(226,232,240,0.62)" }}>{entry.user?.full_name || "System"} · {fmt(entry.created_at)}</Typography></Box>)}</Stack> : null}{tab === 2 ? <Stack spacing={2}><TextField multiline minRows={2} label="Send message" value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} /><Button variant="contained" onClick={sendMessage}>Send update</Button><List sx={{ p: 0 }}>{messages.map((entry) => <ListItem key={entry.id} sx={{ px: 0 }}><ListItemText primary={`${entry.user?.full_name || "Unknown"} · ${fmt(entry.created_at)}`} secondary={entry.message} /></ListItem>)}</List></Stack> : null}{tab === 3 ? <Stack spacing={2}><input ref={fileRef} hidden type="file" onChange={upload} /><Button startIcon={<AttachFile />} variant="outlined" onClick={() => fileRef.current?.click()}>Upload</Button><List sx={{ p: 0 }}>{attachments.map((entry) => <ListItem key={entry.id} sx={{ px: 0 }}><ListItemText primary={entry.file_name} secondary={`${entry.uploader?.full_name || "Unknown"} · ${fmt(entry.created_at)}`} /><Button component="a" href={`http://localhost:7155${entry.file_path}`} target="_blank">Download</Button></ListItem>)}</List></Stack> : null}{tab === 4 ? <Stack spacing={2}>{subtasks.map((entry) => <Stack key={entry.id} direction="row" justifyContent="space-between" sx={{ p: 1.3, borderRadius: 3.5, bgcolor: "rgba(255,255,255,0.03)" }}><Typography variant="subtitle2">{entry.title}</Typography><StatusPill value={entry.status} /></Stack>)}<TextField label="New subtask title" value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} /><Button variant="contained" onClick={createSubtask}>Create subtask</Button></Stack> : null}{tab === 5 ? <Stack spacing={2}><Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>{["Summarize task", "Suggest next steps", "Break into subtasks"].map((action) => <Button key={action} startIcon={<AutoAwesome />} variant="outlined" onClick={() => runAi(action)}>{action}</Button>)}</Stack>{aiResult ? <Box sx={{ p: 2, borderRadius: 3.5, bgcolor: "rgba(116,184,255,0.08)" }}><Typography sx={{ whiteSpace: "pre-wrap" }}>{aiResult}</Typography></Box> : null}</Stack> : null}</Stack>}</Box></Drawer>
    </>
  );
}

export default TasksPage;
