import { useEffect, useMemo, useRef, useState } from "react";
import {
  Add, AttachFile, AutoAwesome, Comment, DashboardCustomize, History, Save,
  Search, TrackChanges, Visibility, VisibilityOff, ViewKanban,
} from "@mui/icons-material";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, Drawer, Grid, InputAdornment, List, ListItem, ListItemText,
  MenuItem, Stack, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { knowledgeApi, organizationsApi, tasksApi, usersApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import { useAuth } from "../store/AuthContext";
import { useRealtime } from "../store/RealtimeContext";

const statusOptions = ["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE"];
const priorityOptions = ["low", "medium", "high", "critical"];
const emptyTaskForm = { title: "", description: "", status: "TODO", priority: "medium", assignee_id: "", due_at: "", sla_hours: 24, tags: "", related_knowledge_id: "", related_knowledge_ids: [], parent_task_id: null };
const emptySubtaskForm = { title: "", description: "", priority: "medium", assignee_id: "", due_at: "", sla_hours: 24, tags: "" };

const formatDateTime = (value) => (value ? dayjs(value).format("MMM D, HH:mm") : "TBD");
const toDatetimeLocal = (value) => (value ? dayjs(value).format("YYYY-MM-DDTHH:mm") : "");
const activityIcon = (actionType) => {
  if (actionType === "comment_added") return <Comment fontSize="small" color="info" />;
  if (actionType === "status_changed") return <TrackChanges fontSize="small" color="warning" />;
  if (actionType === "attachment_added") return <AttachFile fontSize="small" color="secondary" />;
  return <History fontSize="small" color="action" />;
};

function TasksPage() {
  const { user, activeOrganizationId } = useAuth();
  const { versions, connectionState, lastEvent } = useRealtime();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [knowledgeItems, setKnowledgeItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [createForm, setCreateForm] = useState(emptyTaskForm);
  const [subtaskForm, setSubtaskForm] = useState(emptySubtaskForm);
  const [commentDraft, setCommentDraft] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState({ search: "", status: "", priority: "", sla_status: "", assignee_id: "", team_id: "", watched_only: false });
  const fileInputRef = useRef(null);
  const currentOrgId = activeOrganizationId || user.organization_id;
  const canManageUsers = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(user.role);

  const loadList = async () => {
    setLoading(true);
    try {
      const scopedOrgId = activeOrganizationId || undefined;
      const [taskResponse, userResponse, knowledgeResponse, teamsResponse] = await Promise.all([
        tasksApi.list({ organization_id: scopedOrgId, search: filters.search || undefined, status: filters.status || undefined, priority: filters.priority || undefined, sla_status: filters.sla_status || undefined, assignee_id: filters.assignee_id || undefined, team_id: filters.team_id || undefined, watched_only: filters.watched_only || undefined }),
        usersApi.list({ organization_id: scopedOrgId }),
        knowledgeApi.list({ organization_id: scopedOrgId }),
        currentOrgId ? organizationsApi.teams(currentOrgId) : Promise.resolve({ data: [] }),
      ]);
      setTasks(taskResponse.data); setUsers(userResponse.data); setKnowledgeItems(knowledgeResponse.data); setTeams(teamsResponse.data); setError("");
    } catch {
      setError("Unable to load tasks right now.");
    } finally {
      setLoading(false);
    }
  };

  const loadTaskDetail = async (taskId) => {
    setDetailLoading(true);
    const [taskResponse, commentsResponse, activityResponse, attachmentsResponse, subtasksResponse] = await Promise.all([
      tasksApi.detail(taskId), tasksApi.comments(taskId), tasksApi.activity(taskId), tasksApi.attachments(taskId), tasksApi.subtasks(taskId),
    ]);
    const task = taskResponse.data;
    setSelectedTask(task); setComments(commentsResponse.data); setActivity(activityResponse.data); setAttachments(attachmentsResponse.data); setSubtasks(subtasksResponse.data);
    setTaskForm({ title: task.title, description: task.description, status: task.status, priority: task.priority, assignee_id: task.assignee?.id || "", due_at: toDatetimeLocal(task.due_at), sla_hours: task.sla_hours, tags: (task.tags || []).join(", "), related_knowledge_id: task.related_knowledge?.id || "", related_knowledge_ids: task.related_knowledge_ids || [], parent_task_id: task.parent_task_id || null });
    setDetailLoading(false);
  };

  useEffect(() => { loadList(); }, [activeOrganizationId, filters.search, filters.status, filters.priority, filters.sla_status, filters.assignee_id, filters.team_id, filters.watched_only, versions.tasks, versions.users]);
  useEffect(() => { if (selectedId && lastEvent?.event_type?.startsWith("task_")) loadTaskDetail(selectedId); }, [lastEvent?.timestamp, selectedId]);

  const openTask = async (taskId) => { setSelectedId(taskId); setTab(0); setAiResult(""); await loadTaskDetail(taskId); };
  const canEdit = useMemo(() => {
    if (!selectedTask) return false;
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
    if (user.role === "MANAGER") return selectedTask.creator?.id === user.id || selectedTask.assignee?.team?.id === user.team?.id;
    return selectedTask.assignee?.id === user.id || selectedTask.creator?.id === user.id;
  }, [selectedTask, user]);
  const canReassign = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(user.role);
  const watching = Boolean(selectedTask?.watchers?.some((entry) => entry.user?.id === user.id));

  const saveTask = async () => {
    if (!selectedTask) return;
    try {
      await tasksApi.update(selectedTask.id, { title: taskForm.title, description: taskForm.description, status: taskForm.status, priority: taskForm.priority, assignee_id: taskForm.assignee_id || null, due_at: taskForm.due_at ? new Date(taskForm.due_at).toISOString() : null, sla_hours: Number(taskForm.sla_hours), related_knowledge_id: taskForm.related_knowledge_id || null, related_knowledge_ids: taskForm.related_knowledge_ids, tags: taskForm.tags.split(",").map((item) => item.trim()).filter(Boolean), parent_task_id: taskForm.parent_task_id || null });
      await loadList(); await loadTaskDetail(selectedTask.id);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to save task");
    }
  };

  const createTask = async () => {
    try {
      await tasksApi.create({ title: createForm.title, description: createForm.description, organization_id: currentOrgId, status: createForm.status, priority: createForm.priority, assignee_id: createForm.assignee_id || null, due_at: createForm.due_at ? new Date(createForm.due_at).toISOString() : null, sla_hours: Number(createForm.sla_hours), related_knowledge_id: createForm.related_knowledge_id || null, related_knowledge_ids: createForm.related_knowledge_ids, tags: createForm.tags.split(",").map((item) => item.trim()).filter(Boolean) });
      setCreateOpen(false); setCreateForm(emptyTaskForm); await loadList();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to create task");
    }
  };

  const quickStatusUpdate = async (status) => { if (!selectedTask) return; await tasksApi.updateStatus(selectedTask.id, status); await loadList(); await loadTaskDetail(selectedTask.id); };
  const postComment = async () => { if (!selectedTask || !commentDraft.trim()) return; await tasksApi.addComment(selectedTask.id, { content: commentDraft }); setCommentDraft(""); await loadTaskDetail(selectedTask.id); };
  const uploadAttachment = async (event) => { const file = event.target.files?.[0]; if (!selectedTask || !file) return; await tasksApi.uploadAttachment(selectedTask.id, file); await loadTaskDetail(selectedTask.id); event.target.value = ""; };
  const runAi = async (action) => { if (!selectedTask) return; const response = await tasksApi.aiAssist(selectedTask.id, action); setAiResult(response.data.result); setTab(4); };
  const toggleWatch = async () => { if (!selectedTask) return; if (watching) await tasksApi.unwatch(selectedTask.id); else await tasksApi.watch(selectedTask.id); await loadTaskDetail(selectedTask.id); await loadList(); };
  const createSubtask = async () => {
    if (!selectedTask || !subtaskForm.title.trim()) return;
    await tasksApi.createSubtask(selectedTask.id, { title: subtaskForm.title, description: subtaskForm.description, priority: subtaskForm.priority, assignee_id: subtaskForm.assignee_id || null, due_at: subtaskForm.due_at ? new Date(subtaskForm.due_at).toISOString() : null, sla_hours: Number(subtaskForm.sla_hours), tags: subtaskForm.tags.split(",").map((item) => item.trim()).filter(Boolean) });
    setSubtaskForm(emptySubtaskForm); await loadTaskDetail(selectedTask.id); await loadList();
  };

  const groupedTasks = useMemo(() => statusOptions.map((status) => ({ status, items: tasks.filter((task) => task.status === status) })), [tasks]);
  const renderMeta = (task) => <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap><StatusPill value={task.status} /><StatusPill value={task.priority} />{task.subtask_progress?.total ? <Chip size="small" label={`${task.subtask_progress.done}/${task.subtask_progress.total} subtasks`} /> : null}{task.risk_score ? <Chip size="small" label={`Risk ${task.risk_score}`} color={task.risk_score > 70 ? "error" : "default"} /> : null}</Stack>;

  return (
    <>
      <PageHeader eyebrow={user.role === "USER" ? "My Tasks" : "Collaborative Task Workspace"} title={user.role === "USER" ? "Tasks, updates, and collaboration" : "Operational work, collaboration, and AI assistance"} description="Create work, follow updates live, collaborate in context, and move tasks through list or board views." actions={[<Chip key="live" label={`Realtime ${connectionState}`} color={connectionState === "connected" ? "success" : "default"} />, <Button key="create" startIcon={<Add />} variant="contained" onClick={() => setCreateOpen(true)}>New task</Button>]} />
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      <GlassPanel title="Task workspace" subtitle={`${tasks.length} tasks visible in your current scope`} action={<Stack direction={{ xs: "column", xl: "row" }} spacing={1.2}><TextField size="small" label="Search" value={filters.search} onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value }))} sx={{ minWidth: 180 }} InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} /><TextField select size="small" label="Status" value={filters.status} onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value }))} sx={{ minWidth: 140 }}><MenuItem value="">All</MenuItem>{statusOptions.map((status) => <MenuItem key={status} value={status}>{status.replaceAll("_", " ")}</MenuItem>)}</TextField><TextField select size="small" label="Priority" value={filters.priority} onChange={(event) => setFilters((previous) => ({ ...previous, priority: event.target.value }))} sx={{ minWidth: 140 }}><MenuItem value="">All</MenuItem>{priorityOptions.map((priority) => <MenuItem key={priority} value={priority}>{priority}</MenuItem>)}</TextField>{canManageUsers ? <TextField select size="small" label="Assignee" value={filters.assignee_id} onChange={(event) => setFilters((previous) => ({ ...previous, assignee_id: event.target.value }))} sx={{ minWidth: 170 }}><MenuItem value="">All</MenuItem>{users.map((assignee) => <MenuItem key={assignee.id} value={assignee.id}>{assignee.full_name}</MenuItem>)}</TextField> : null}{canManageUsers ? <TextField select size="small" label="Team" value={filters.team_id} onChange={(event) => setFilters((previous) => ({ ...previous, team_id: event.target.value }))} sx={{ minWidth: 160 }}><MenuItem value="">All</MenuItem>{teams.map((team) => <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>)}</TextField> : null}<Button variant={filters.watched_only ? "contained" : "outlined"} onClick={() => setFilters((previous) => ({ ...previous, watched_only: !previous.watched_only }))}>Watched</Button><Button variant={viewMode === "list" ? "contained" : "outlined"} startIcon={<DashboardCustomize />} onClick={() => setViewMode("list")}>List</Button><Button variant={viewMode === "board" ? "contained" : "outlined"} startIcon={<ViewKanban />} onClick={() => setViewMode("board")}>Board</Button></Stack>}>
        {loading ? <CircularProgress /> : viewMode === "list" ? (
          <Table><TableHead><TableRow><TableCell>Task</TableCell><TableCell>Status</TableCell><TableCell>Priority</TableCell><TableCell>Assignee</TableCell><TableCell>Due</TableCell><TableCell>SLA</TableCell><TableCell>Risk</TableCell></TableRow></TableHead><TableBody>{tasks.map((task) => <TableRow key={task.id} hover onClick={() => openTask(task.id)} sx={{ cursor: "pointer" }}><TableCell><Typography variant="subtitle2">{task.title}</Typography><Typography variant="body2" sx={{ color: "rgba(226,232,240,0.56)" }}>{task.description.slice(0, 100)}...</Typography></TableCell><TableCell><StatusPill value={task.status} /></TableCell><TableCell><StatusPill value={task.priority} /></TableCell><TableCell>{task.assignee?.full_name || "Unassigned"}</TableCell><TableCell>{formatDateTime(task.due_at)}</TableCell><TableCell><StatusPill value={task.sla_status} /></TableCell><TableCell>{task.risk_score}</TableCell></TableRow>)}</TableBody></Table>
        ) : (
          <Grid container spacing={2}>{groupedTasks.map((column) => <Grid item xs={12} md={6} xl={2.4} key={column.status}><Stack spacing={1.25}><Typography variant="subtitle2">{column.status.replaceAll("_", " ")}</Typography>{column.items.map((task) => <Box key={task.id} onClick={() => openTask(task.id)} sx={{ p: 1.6, borderRadius: 3, cursor: "pointer", bgcolor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.08)" }}><Typography variant="subtitle2">{task.title}</Typography><Typography variant="body2" sx={{ color: "rgba(226,232,240,0.62)", mb: 1.2 }}>{task.assignee?.full_name || "Unassigned"}</Typography>{renderMeta(task)}</Box>)}</Stack></Grid>)}</Grid>
        )}
      </GlassPanel>
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Create task</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField label="Title" value={createForm.title} onChange={(event) => setCreateForm((previous) => ({ ...previous, title: event.target.value }))} /><TextField label="Description" value={createForm.description} onChange={(event) => setCreateForm((previous) => ({ ...previous, description: event.target.value }))} multiline minRows={4} /><Stack direction={{ xs: "column", md: "row" }} spacing={2}><TextField select fullWidth label="Priority" value={createForm.priority} onChange={(event) => setCreateForm((previous) => ({ ...previous, priority: event.target.value }))}>{priorityOptions.map((priority) => <MenuItem key={priority} value={priority}>{priority}</MenuItem>)}</TextField><TextField select fullWidth label="Assignee" value={createForm.assignee_id} onChange={(event) => setCreateForm((previous) => ({ ...previous, assignee_id: event.target.value }))}><MenuItem value="">Unassigned</MenuItem>{users.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.full_name}</MenuItem>)}</TextField></Stack><TextField type="datetime-local" label="Due date" value={createForm.due_at} onChange={(event) => setCreateForm((previous) => ({ ...previous, due_at: event.target.value }))} InputLabelProps={{ shrink: true }} /><TextField label="Tags" value={createForm.tags} onChange={(event) => setCreateForm((previous) => ({ ...previous, tags: event.target.value }))} helperText="Comma separated labels" /></Stack></DialogContent><DialogActions><Button onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={createTask} variant="contained">Create</Button></DialogActions></Dialog>
      <Drawer anchor="right" open={Boolean(selectedId)} onClose={() => { setSelectedId(null); setSelectedTask(null); }}><Box sx={{ width: { xs: 380, md: 820 }, p: 3 }}>{detailLoading || !selectedTask ? <CircularProgress /> : <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}><Box sx={{ flex: 1 }}><TextField fullWidth variant="standard" value={taskForm.title} onChange={(event) => setTaskForm((previous) => ({ ...previous, title: event.target.value }))} InputProps={{ readOnly: !canEdit, disableUnderline: !canEdit, sx: { fontSize: 28, fontWeight: 700 } }} /><Typography variant="body2" sx={{ color: "rgba(226,232,240,0.6)", mt: 1 }}>Updated {formatDateTime(selectedTask.updated_at)} • {selectedTask.watchers?.length || 0} watcher(s)</Typography></Box><Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap><Button variant={watching ? "contained" : "outlined"} startIcon={watching ? <VisibilityOff /> : <Visibility />} onClick={toggleWatch}>{watching ? "Watching" : "Watch task"}</Button><StatusPill value={selectedTask.status} /><StatusPill value={selectedTask.priority} /><StatusPill value={selectedTask.sla_status} /></Stack></Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>{statusOptions.map((status) => <Button key={status} size="small" variant={taskForm.status === status ? "contained" : "outlined"} onClick={() => quickStatusUpdate(status)} disabled={!canEdit}>{status.replaceAll("_", " ")}</Button>)}</Stack>
        <Grid container spacing={2}><Grid item xs={12} md={8}><TextField fullWidth multiline minRows={7} label="Description" value={taskForm.description} onChange={(event) => setTaskForm((previous) => ({ ...previous, description: event.target.value }))} InputProps={{ readOnly: !canEdit }} /></Grid><Grid item xs={12} md={4}><Stack spacing={1.5}><TextField select label="Priority" value={taskForm.priority} onChange={(event) => setTaskForm((previous) => ({ ...previous, priority: event.target.value }))} disabled={!canEdit}>{priorityOptions.map((priority) => <MenuItem key={priority} value={priority}>{priority}</MenuItem>)}</TextField><TextField select label="Assignee" value={taskForm.assignee_id} onChange={(event) => setTaskForm((previous) => ({ ...previous, assignee_id: event.target.value }))} disabled={!canReassign}><MenuItem value="">Unassigned</MenuItem>{users.map((assignee) => <MenuItem key={assignee.id} value={assignee.id}>{assignee.full_name}</MenuItem>)}</TextField><TextField type="datetime-local" label="Due date" value={taskForm.due_at} onChange={(event) => setTaskForm((previous) => ({ ...previous, due_at: event.target.value }))} disabled={!canEdit} InputLabelProps={{ shrink: true }} /><TextField type="number" label="SLA hours" value={taskForm.sla_hours} onChange={(event) => setTaskForm((previous) => ({ ...previous, sla_hours: event.target.value }))} disabled={!canEdit} /><TextField label="Tags" value={taskForm.tags} onChange={(event) => setTaskForm((previous) => ({ ...previous, tags: event.target.value }))} helperText="Comma separated" disabled={!canEdit} /><Button startIcon={<Save />} variant="contained" onClick={saveTask} disabled={!canEdit}>Save task</Button></Stack></Grid></Grid>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>{(selectedTask.tags || []).map((tag) => <Chip key={tag} size="small" label={tag} />)}{selectedTask.related_knowledge_items?.map((item) => <Chip key={item.id} size="small" label={item.title} variant="outlined" />)}{selectedTask.subtask_progress?.total ? <Chip size="small" label={`${selectedTask.subtask_progress.done}/${selectedTask.subtask_progress.total} subtasks complete`} color="info" /> : null}</Stack>
        <Tabs value={tab} onChange={(_, next) => setTab(next)}><Tab label="Comments" /><Tab label="Activity" /><Tab label="Attachments" /><Tab label="Subtasks" /><Tab label="AI Helper" /></Tabs><Divider />
        {tab === 0 ? <Stack spacing={2}><TextField multiline minRows={3} label="Add comment" placeholder="Use @name or @email-handle to mention teammates" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} /><Button variant="contained" onClick={postComment}>Post comment</Button><List sx={{ p: 0 }}>{comments.map((entry) => <ListItem key={entry.id} sx={{ px: 0, alignItems: "flex-start" }}><ListItemText primary={`${entry.author?.full_name || "Unknown"} • ${formatDateTime(entry.created_at)}`} secondary={<Typography variant="body2" sx={{ color: "rgba(226,232,240,0.72)", whiteSpace: "pre-wrap" }}>{entry.content}</Typography>} /></ListItem>)}</List></Stack> : null}
        {tab === 1 ? <Stack spacing={1.5}>{activity.map((entry) => <Stack key={entry.id} direction="row" spacing={1.5} sx={{ p: 1.5, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }}><Box sx={{ pt: 0.5 }}>{activityIcon(entry.action_type)}</Box><Box><Typography variant="subtitle2">{entry.message}</Typography><Typography variant="body2" sx={{ color: "rgba(226,232,240,0.62)" }}>{entry.user?.full_name || "System"} • {formatDateTime(entry.created_at)}</Typography>{entry.field_changed ? <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.56)" }}>{entry.field_changed}: {entry.old_value || "empty"} → {entry.new_value || "empty"}</Typography> : null}</Box></Stack>)}</Stack> : null}
        {tab === 2 ? <Stack spacing={2}><input ref={fileInputRef} type="file" hidden onChange={uploadAttachment} /><Button startIcon={<AttachFile />} variant="outlined" onClick={() => fileInputRef.current?.click()} disabled={!canEdit}>Upload attachment</Button><List sx={{ p: 0 }}>{attachments.map((attachment) => <ListItem key={attachment.id} sx={{ px: 0 }}><ListItemText primary={attachment.file_name} secondary={`${attachment.uploader?.full_name || "Unknown"} • ${formatDateTime(attachment.created_at)}`} /><Button component="a" href={`http://localhost:7155${attachment.file_path}`} target="_blank">Download</Button></ListItem>)}</List></Stack> : null}
        {tab === 3 ? <Stack spacing={2}><Typography variant="subtitle2">Existing subtasks</Typography>{subtasks.map((subtask) => <Stack key={subtask.id} direction={{ xs: "column", md: "row" }} justifyContent="space-between" sx={{ p: 1.5, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }}><div><Typography variant="subtitle2">{subtask.title}</Typography><Typography variant="body2" sx={{ color: "rgba(226,232,240,0.62)" }}>{subtask.assignee?.full_name || "Unassigned"}</Typography></div><Stack direction="row" spacing={1}><StatusPill value={subtask.priority} /><StatusPill value={subtask.status} /></Stack></Stack>)}{canEdit ? <GlassPanel title="Create subtask" subtitle="Break larger work into smaller execution units"><Stack spacing={1.5}><TextField label="Title" value={subtaskForm.title} onChange={(event) => setSubtaskForm((previous) => ({ ...previous, title: event.target.value }))} /><TextField label="Description" value={subtaskForm.description} onChange={(event) => setSubtaskForm((previous) => ({ ...previous, description: event.target.value }))} multiline minRows={3} /><Stack direction={{ xs: "column", md: "row" }} spacing={1.5}><TextField select fullWidth label="Priority" value={subtaskForm.priority} onChange={(event) => setSubtaskForm((previous) => ({ ...previous, priority: event.target.value }))}>{priorityOptions.map((priority) => <MenuItem key={priority} value={priority}>{priority}</MenuItem>)}</TextField><TextField select fullWidth label="Assignee" value={subtaskForm.assignee_id} onChange={(event) => setSubtaskForm((previous) => ({ ...previous, assignee_id: event.target.value }))}><MenuItem value="">Unassigned</MenuItem>{users.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.full_name}</MenuItem>)}</TextField></Stack><TextField type="datetime-local" label="Due date" value={subtaskForm.due_at} onChange={(event) => setSubtaskForm((previous) => ({ ...previous, due_at: event.target.value }))} InputLabelProps={{ shrink: true }} /><TextField label="Tags" value={subtaskForm.tags} onChange={(event) => setSubtaskForm((previous) => ({ ...previous, tags: event.target.value }))} /><Button onClick={createSubtask} variant="contained">Create subtask</Button></Stack></GlassPanel> : null}</Stack> : null}
        {tab === 4 ? <Stack spacing={2}><Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>{["Summarize task", "Suggest next steps", "Break into subtasks"].map((action) => <Button key={action} startIcon={<AutoAwesome />} variant="outlined" onClick={() => runAi(action)}>{action}</Button>)}</Stack>{aiResult ? <Box sx={{ p: 2, borderRadius: 3, bgcolor: "rgba(116,184,255,0.08)" }}><Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>{aiResult}</Typography></Box> : <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.6)" }}>Choose an AI action to get a summary, next-step guidance, or subtask ideas.</Typography>}</Stack> : null}
      </Stack>}</Box></Drawer>
    </>
  );
}

export default TasksPage;
