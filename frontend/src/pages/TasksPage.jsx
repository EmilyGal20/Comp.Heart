import { useEffect, useMemo, useRef, useState } from "react";
import { Add, AttachFile, AutoAwesome, CalendarMonth, ChatBubbleOutline, Search, Timeline, ViewKanban, ViewList, Visibility, VisibilityOff } from "@mui/icons-material";
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, Grid, InputAdornment, List, ListItem, ListItemText, MenuItem, Stack, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import dayjs from "dayjs";
import { knowledgeApi, organizationsApi, tasksApi, usersApi, workApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import { useAuth } from "../store/AuthContext";
import { useRealtime } from "../store/RealtimeContext";

const statusOptions = ["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE"];
const priorityOptions = ["low", "medium", "high", "critical"];
const emptyForm = { title: "", description: "", status: "TODO", priority: "medium", assignee_id: "", due_at: "", sla_hours: 24, tags: "", sprint_id: "" };
const fmt = (v) => (v ? dayjs(v).format("MMM D, HH:mm") : "TBD");
const localDt = (v) => (v ? dayjs(v).format("YYYY-MM-DDTHH:mm") : "");

function TasksPage() {
  const { user, activeOrganizationId } = useAuth();
  const { versions, connectionState, lastEvent } = useRealtime();
  const [tasks, setTasks] = useState([]), [users, setUsers] = useState([]), [teams, setTeams] = useState([]), [sprints, setSprints] = useState([]);
  const [selected, setSelected] = useState(null), [comments, setComments] = useState([]), [activity, setActivity] = useState([]), [attachments, setAttachments] = useState([]), [subtasks, setSubtasks] = useState([]), [messages, setMessages] = useState([]);
  const [form, setForm] = useState(emptyForm), [createForm, setCreateForm] = useState(emptyForm), [subtaskTitle, setSubtaskTitle] = useState("");
  const [commentDraft, setCommentDraft] = useState(""), [messageDraft, setMessageDraft] = useState(""), [aiResult, setAiResult] = useState("");
  const [loading, setLoading] = useState(true), [detailLoading, setDetailLoading] = useState(false), [error, setError] = useState(""), [tab, setTab] = useState(0), [view, setView] = useState("list"), [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState({ search: "", status: "", priority: "", assignee_id: "", watched_only: false });
  const fileRef = useRef(null);
  const orgId = activeOrganizationId || user.organization_id;

  const loadList = async () => {
    setLoading(true);
    try {
      const [t, u, tm, s] = await Promise.all([
        tasksApi.list({ organization_id: orgId, search: filters.search || undefined, status: filters.status || undefined, priority: filters.priority || undefined, assignee_id: filters.assignee_id || undefined, watched_only: filters.watched_only || undefined }),
        usersApi.list({ organization_id: orgId }),
        organizationsApi.teams(orgId),
        workApi.sprints({ organization_id: orgId }),
      ]);
      setTasks(t.data); setUsers(u.data); setTeams(tm.data); setSprints(s.data); setError("");
    } catch { setError("Unable to load tasks"); } finally { setLoading(false); }
  };

  const loadDetail = async (id) => {
    setDetailLoading(true);
    const [task, c, a, at, st, m] = await Promise.all([tasksApi.detail(id), tasksApi.comments(id), tasksApi.activity(id), tasksApi.attachments(id), tasksApi.subtasks(id), workApi.messages(id)]);
    setSelected(task.data); setComments(c.data); setActivity(a.data); setAttachments(at.data); setSubtasks(st.data); setMessages(m.data);
    setForm({ title: task.data.title, description: task.data.description, status: task.data.status, priority: task.data.priority, assignee_id: task.data.assignee?.id || "", due_at: localDt(task.data.due_at), sla_hours: task.data.sla_hours, tags: (task.data.tags || []).join(", "), sprint_id: task.data.sprint_id || "" });
    setDetailLoading(false);
  };

  useEffect(() => { loadList(); }, [orgId, filters.search, filters.status, filters.priority, filters.assignee_id, filters.watched_only, versions.tasks, versions.activity]);
  useEffect(() => { if (selected?.id && lastEvent?.event_type?.includes("task")) loadDetail(selected.id); }, [lastEvent?.timestamp]);

  const grouped = useMemo(() => statusOptions.map((status) => ({ status, items: tasks.filter((task) => task.status === status) })), [tasks]);
  const byDate = useMemo(() => Object.entries(tasks.reduce((acc, task) => { const k = task.due_at ? dayjs(task.due_at).format("MMM D") : "No due date"; acc[k] = acc[k] || []; acc[k].push(task); return acc; }, {})), [tasks]);
  const canEdit = useMemo(() => selected && (["SUPER_ADMIN", "ADMIN"].includes(user.role) || selected.assignee?.id === user.id || selected.creator?.id === user.id || (user.role === "MANAGER" && selected.assignee?.team?.id === user.team?.id)), [selected, user]);
  const watching = Boolean(selected?.watchers?.some((item) => item.user?.id === user.id));

  const openTask = async (id) => { setTab(0); setAiResult(""); await loadDetail(id); };
  const saveTask = async () => { await tasksApi.update(selected.id, { ...form, assignee_id: form.assignee_id || null, due_at: form.due_at ? new Date(form.due_at).toISOString() : null, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean), sprint_id: form.sprint_id || null }); await loadList(); await loadDetail(selected.id); };
  const createTask = async () => { await tasksApi.create({ ...createForm, organization_id: orgId, assignee_id: createForm.assignee_id || null, due_at: createForm.due_at ? new Date(createForm.due_at).toISOString() : null, tags: createForm.tags.split(",").map((t) => t.trim()).filter(Boolean), sprint_id: createForm.sprint_id || null }); setCreateOpen(false); setCreateForm(emptyForm); await loadList(); };
  const sendComment = async () => { if (!commentDraft.trim()) return; await tasksApi.addComment(selected.id, { content: commentDraft }); setCommentDraft(""); await loadDetail(selected.id); };
  const sendMessage = async () => { if (!messageDraft.trim()) return; await workApi.sendMessage(selected.id, messageDraft); setMessageDraft(""); await loadDetail(selected.id); };
  const upload = async (e) => { const file = e.target.files?.[0]; if (!file) return; await tasksApi.uploadAttachment(selected.id, file); e.target.value = ""; await loadDetail(selected.id); };
  const createSubtask = async () => { if (!subtaskTitle.trim()) return; await tasksApi.createSubtask(selected.id, { title: subtaskTitle, description: "", priority: "medium", tags: [] }); setSubtaskTitle(""); await loadDetail(selected.id); };
  const requestApproval = async () => { await workApi.requestApproval(selected.id); await loadDetail(selected.id); };
  const approve = async () => { const pending = selected.approvals?.find((a) => a.status === "PENDING"); if (pending) { await workApi.updateApproval(pending.id, "APPROVED"); await loadDetail(selected.id); } };
  const runAi = async (action) => { const r = await tasksApi.aiAssist(selected.id, action); setAiResult(r.data.result); setTab(5); };
  const toggleWatch = async () => { if (watching) await tasksApi.unwatch(selected.id); else await tasksApi.watch(selected.id); await loadDetail(selected.id); };

  const renderCard = (task) => <Box key={task.id} onClick={() => openTask(task.id)} sx={{ p: 1.5, borderRadius: 3, cursor: "pointer", bgcolor: "rgba(255,255,255,0.03)" }}><Typography variant="subtitle2">{task.title}</Typography><Typography variant="body2" sx={{ color: "rgba(226,232,240,0.62)" }}>{task.assignee?.full_name || "Unassigned"}</Typography><Stack direction="row" spacing={1} sx={{ mt: 1 }}><StatusPill value={task.status} /><StatusPill value={task.priority} /></Stack></Box>;

  return (
    <>
      <PageHeader eyebrow="Work Management" title="Tasks, planning, chat, and approvals" description="A modern task surface with list, board, calendar, and timeline views plus sprint assignment, fast chat, and approval flows." actions={[<Chip key="live" label={`Realtime ${connectionState}`} color={connectionState === "connected" ? "success" : "default"} />, <Button key="new" startIcon={<Add />} variant="contained" onClick={() => setCreateOpen(true)}>New task</Button>]} />
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      <GlassPanel title="Task workspace" subtitle={`${tasks.length} tasks visible`} action={<Stack direction={{ xs: "column", xl: "row" }} spacing={1}><TextField size="small" label="Search" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} /><TextField select size="small" label="Status" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}><MenuItem value="">All</MenuItem>{statusOptions.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField><TextField select size="small" label="Priority" value={filters.priority} onChange={(e) => setFilters((p) => ({ ...p, priority: e.target.value }))}><MenuItem value="">All</MenuItem>{priorityOptions.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField><Button variant={filters.watched_only ? "contained" : "outlined"} onClick={() => setFilters((p) => ({ ...p, watched_only: !p.watched_only }))}>Watched</Button>{["list", "board", "calendar", "timeline"].map((v) => <Button key={v} variant={view === v ? "contained" : "outlined"} startIcon={v === "list" ? <ViewList /> : v === "board" ? <ViewKanban /> : v === "calendar" ? <CalendarMonth /> : <Timeline />} onClick={() => setView(v)}>{v}</Button>)}</Stack>}>
        {loading ? <CircularProgress /> : null}
        {!loading && view === "list" ? <Table><TableHead><TableRow><TableCell>Task</TableCell><TableCell>Status</TableCell><TableCell>Priority</TableCell><TableCell>Sprint</TableCell><TableCell>Due</TableCell></TableRow></TableHead><TableBody>{tasks.map((task) => <TableRow key={task.id} hover onClick={() => openTask(task.id)} sx={{ cursor: "pointer" }}><TableCell>{task.title}</TableCell><TableCell><StatusPill value={task.status} /></TableCell><TableCell><StatusPill value={task.priority} /></TableCell><TableCell>{task.sprint_id ? `Sprint ${task.sprint_id}` : "Backlog"}</TableCell><TableCell>{fmt(task.due_at)}</TableCell></TableRow>)}</TableBody></Table> : null}
        {!loading && view === "board" ? <Grid container spacing={2}>{grouped.map((col) => <Grid item xs={12} md={6} xl={2.4} key={col.status}><Stack spacing={1}><Typography variant="subtitle2">{col.status}</Typography>{col.items.map(renderCard)}</Stack></Grid>)}</Grid> : null}
        {!loading && view === "calendar" ? <Grid container spacing={2}>{byDate.map(([day, items]) => <Grid item xs={12} md={6} key={day}><GlassPanel title={day}><Stack spacing={1}>{items.map(renderCard)}</Stack></GlassPanel></Grid>)}</Grid> : null}
        {!loading && view === "timeline" ? <Stack spacing={1}>{tasks.map((task) => <Stack key={task.id} sx={{ p: 1.5, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }}><Typography variant="subtitle2">{task.title}</Typography><Box sx={{ mt: 1, height: 8, borderRadius: 99, bgcolor: "rgba(255,255,255,0.06)", overflow: "hidden" }}><Box sx={{ width: `${Math.min(task.risk_score || 20, 100)}%`, height: "100%", bgcolor: task.sla_status === "breached" ? "error.main" : "info.main" }} /></Box><Typography variant="body2" sx={{ mt: 1, color: "rgba(226,232,240,0.62)" }}>Due {fmt(task.due_at)} • {task.sprint_id ? `Sprint ${task.sprint_id}` : "Backlog"}</Typography></Stack>)}</Stack> : null}
      </GlassPanel>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Create task</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField label="Title" value={createForm.title} onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))} /><TextField label="Description" multiline minRows={4} value={createForm.description} onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))} /><TextField select label="Sprint" value={createForm.sprint_id} onChange={(e) => setCreateForm((p) => ({ ...p, sprint_id: e.target.value }))}><MenuItem value="">Backlog</MenuItem>{sprints.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</TextField></Stack></DialogContent><DialogActions><Button onClick={() => setCreateOpen(false)}>Cancel</Button><Button variant="contained" onClick={createTask}>Create</Button></DialogActions></Dialog>

      <Drawer anchor="right" open={Boolean(selected?.id)} onClose={() => setSelected(null)}><Box sx={{ width: { xs: 380, md: 820 }, p: 3 }}>{detailLoading || !selected ? <CircularProgress /> : <Stack spacing={2.2}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}><Box sx={{ flex: 1 }}><TextField fullWidth variant="standard" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} InputProps={{ readOnly: !canEdit, disableUnderline: !canEdit, sx: { fontSize: 28, fontWeight: 700 } }} /><Typography variant="body2" sx={{ color: "rgba(226,232,240,0.6)", mt: 1 }}>Updated {fmt(selected.updated_at)} • {selected.watchers?.length || 0} watcher(s)</Typography></Box><Stack direction="row" spacing={1}><Button variant={watching ? "contained" : "outlined"} startIcon={watching ? <VisibilityOff /> : <Visibility />} onClick={toggleWatch}>{watching ? "Watching" : "Watch"}</Button><StatusPill value={selected.status} /><StatusPill value={selected.priority} /></Stack></Stack>
        <Grid container spacing={2}><Grid item xs={12} md={8}><TextField fullWidth multiline minRows={6} label="Description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} InputProps={{ readOnly: !canEdit }} /></Grid><Grid item xs={12} md={4}><Stack spacing={1.2}><TextField select label="Priority" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))} disabled={!canEdit}>{priorityOptions.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField><TextField select label="Sprint" value={form.sprint_id} onChange={(e) => setForm((p) => ({ ...p, sprint_id: e.target.value }))} disabled={!canEdit}><MenuItem value="">Backlog</MenuItem>{sprints.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</TextField><TextField type="datetime-local" label="Due date" value={form.due_at} onChange={(e) => setForm((p) => ({ ...p, due_at: e.target.value }))} InputLabelProps={{ shrink: true }} disabled={!canEdit} /><Button startIcon={<Save />} variant="contained" onClick={saveTask} disabled={!canEdit}>Save</Button><Button onClick={requestApproval}>Request approval</Button>{selected.approvals?.some((a) => a.status === "PENDING") ? <Button color="success" onClick={approve}>Approve pending</Button> : null}</Stack></Grid></Grid>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable"><Tab label="Comments" /><Tab label="Activity" /><Tab label="Chat" icon={<ChatBubbleOutline />} iconPosition="start" /><Tab label="Attachments" /><Tab label="Subtasks" /><Tab label="AI" /></Tabs><Divider />
        {tab === 0 ? <Stack spacing={2}><TextField multiline minRows={3} label="Add comment" value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} /><Button variant="contained" onClick={sendComment}>Post</Button><List sx={{ p: 0 }}>{comments.map((entry) => <ListItem key={entry.id} sx={{ px: 0 }}><ListItemText primary={`${entry.author?.full_name || "Unknown"} • ${fmt(entry.created_at)}`} secondary={entry.content} /></ListItem>)}</List></Stack> : null}
        {tab === 1 ? <Stack spacing={1}>{activity.map((entry) => <Stack key={entry.id} sx={{ p: 1.3, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }}><Typography variant="subtitle2">{entry.message}</Typography><Typography variant="body2" sx={{ color: "rgba(226,232,240,0.62)" }}>{entry.user?.full_name || "System"} • {fmt(entry.created_at)}</Typography></Stack>)}{(selected.approvals || []).map((approval) => <Chip key={approval.id} label={`Approval ${approval.status}`} />)}</Stack> : null}
        {tab === 2 ? <Stack spacing={2}><TextField multiline minRows={2} label="Send message" value={messageDraft} onChange={(e) => setMessageDraft(e.target.value)} /><Button variant="contained" onClick={sendMessage}>Send</Button><List sx={{ p: 0 }}>{messages.map((entry) => <ListItem key={entry.id} sx={{ px: 0 }}><ListItemText primary={`${entry.user?.full_name || "Unknown"} • ${fmt(entry.created_at)}`} secondary={entry.message} /></ListItem>)}</List></Stack> : null}
        {tab === 3 ? <Stack spacing={2}><input ref={fileRef} hidden type="file" onChange={upload} /><Button startIcon={<AttachFile />} variant="outlined" onClick={() => fileRef.current?.click()}>Upload</Button><List sx={{ p: 0 }}>{attachments.map((entry) => <ListItem key={entry.id} sx={{ px: 0 }}><ListItemText primary={entry.file_name} secondary={`${entry.uploader?.full_name || "Unknown"} • ${fmt(entry.created_at)}`} /><Button component="a" href={`http://localhost:7155${entry.file_path}`} target="_blank">Download</Button></ListItem>)}</List></Stack> : null}
        {tab === 4 ? <Stack spacing={2}>{subtasks.map((entry) => <Stack key={entry.id} direction="row" justifyContent="space-between" sx={{ p: 1.3, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }}><Typography variant="subtitle2">{entry.title}</Typography><StatusPill value={entry.status} /></Stack>)}<TextField label="New subtask title" value={subtaskTitle} onChange={(e) => setSubtaskTitle(e.target.value)} /><Button variant="contained" onClick={createSubtask}>Create subtask</Button></Stack> : null}
        {tab === 5 ? <Stack spacing={2}><Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>{["Summarize task", "Suggest next steps", "Break into subtasks"].map((action) => <Button key={action} startIcon={<AutoAwesome />} variant="outlined" onClick={() => runAi(action)}>{action}</Button>)}</Stack>{aiResult ? <Box sx={{ p: 2, borderRadius: 3, bgcolor: "rgba(116,184,255,0.08)" }}><Typography sx={{ whiteSpace: "pre-wrap" }}>{aiResult}</Typography></Box> : null}</Stack> : null}
      </Stack>}</Box></Drawer>
    </>
  );
}

export default TasksPage;
