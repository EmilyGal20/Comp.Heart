import { useEffect, useMemo, useRef, useState } from "react";
import {
  AttachFile,
  AutoAwesome,
  Comment,
  History,
  Save,
  TrackChanges,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  Grid,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import SearchIcon from "@mui/icons-material/Search";
import { knowledgeApi, organizationsApi, tasksApi, usersApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import { useAuth } from "../store/AuthContext";

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
  related_knowledge_id: "",
  related_knowledge_ids: [],
};

function formatDateTime(value) {
  return value ? dayjs(value).format("MMM D, HH:mm") : "TBD";
}

function toDatetimeLocal(value) {
  return value ? dayjs(value).format("YYYY-MM-DDTHH:mm") : "";
}

function activityIcon(actionType) {
  if (actionType === "comment_added") return <Comment fontSize="small" color="info" />;
  if (actionType === "status_changed") return <TrackChanges fontSize="small" color="warning" />;
  if (actionType === "attachment_added") return <AttachFile fontSize="small" color="secondary" />;
  return <History fontSize="small" color="action" />;
}

function TasksPage() {
  const { user, activeOrganizationId } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [knowledgeItems, setKnowledgeItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [commentDraft, setCommentDraft] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    priority: "",
    sla_status: "",
    assignee_id: "",
    team_id: "",
  });

  const canManageUsers = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(user.role);

  const loadList = async () => {
    setLoading(true);
    setError("");
    try {
      const scopedOrgId = activeOrganizationId || undefined;
      const [taskResponse, userResponse, knowledgeResponse, teamsResponse] = await Promise.all([
        tasksApi.list({
          organization_id: scopedOrgId,
          search: filters.search || undefined,
          status: filters.status || undefined,
          priority: filters.priority || undefined,
          sla_status: filters.sla_status || undefined,
          assignee_id: filters.assignee_id || undefined,
          team_id: filters.team_id || undefined,
        }),
        usersApi.list({ organization_id: scopedOrgId }),
        knowledgeApi.list({ organization_id: scopedOrgId }),
        activeOrganizationId || user.organization_id ? organizationsApi.teams(activeOrganizationId || user.organization_id) : Promise.resolve({ data: [] }),
      ]);
      setTasks(taskResponse.data);
      setUsers(userResponse.data);
      setKnowledgeItems(knowledgeResponse.data);
      setTeams(teamsResponse.data);
    } catch (requestError) {
      setError("Unable to load tasks right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, [activeOrganizationId, filters.search, filters.status, filters.priority, filters.sla_status, filters.assignee_id, filters.team_id]);

  const loadTaskDetail = async (taskId) => {
    setDetailLoading(true);
    try {
      const [taskResponse, commentsResponse, activityResponse, attachmentsResponse] = await Promise.all([
        tasksApi.detail(taskId),
        tasksApi.comments(taskId),
        tasksApi.activity(taskId),
        tasksApi.attachments(taskId),
      ]);
      const task = taskResponse.data;
      setSelectedTask(task);
      setComments(commentsResponse.data);
      setActivity(activityResponse.data);
      setAttachments(attachmentsResponse.data);
      setTaskForm({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assignee_id: task.assignee?.id || "",
        due_at: toDatetimeLocal(task.due_at),
        sla_hours: task.sla_hours,
        tags: (task.tags || []).join(", "),
        related_knowledge_id: task.related_knowledge?.id || "",
        related_knowledge_ids: task.related_knowledge_ids || [],
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const openTask = async (taskId) => {
    setSelectedId(taskId);
    setTab(0);
    setAiResult("");
    await loadTaskDetail(taskId);
  };

  const canEdit = useMemo(() => {
    if (!selectedTask) return false;
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
    if (user.role === "MANAGER") {
      return selectedTask.creator?.id === user.id || selectedTask.assignee?.team?.id === user.team?.id;
    }
    return selectedTask.assignee?.id === user.id;
  }, [selectedTask, user]);

  const canReassign = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(user.role);

  const saveTask = async () => {
    if (!selectedTask) return;
    try {
      await tasksApi.update(selectedTask.id, {
        title: taskForm.title,
        description: taskForm.description,
        status: taskForm.status,
        priority: taskForm.priority,
        assignee_id: taskForm.assignee_id || null,
        due_at: taskForm.due_at ? new Date(taskForm.due_at).toISOString() : null,
        sla_hours: Number(taskForm.sla_hours),
        related_knowledge_id: taskForm.related_knowledge_id || null,
        related_knowledge_ids: taskForm.related_knowledge_ids,
        tags: taskForm.tags.split(",").map((item) => item.trim()).filter(Boolean),
      });
      await loadList();
      await loadTaskDetail(selectedTask.id);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to save task");
    }
  };

  const quickStatusUpdate = async (status) => {
    if (!selectedTask) return;
    try {
      await tasksApi.updateStatus(selectedTask.id, status);
      await loadList();
      await loadTaskDetail(selectedTask.id);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to update status");
    }
  };

  const postComment = async () => {
    if (!selectedTask || !commentDraft.trim()) return;
    await tasksApi.addComment(selectedTask.id, { content: commentDraft });
    setCommentDraft("");
    await loadTaskDetail(selectedTask.id);
  };

  const uploadAttachment = async (event) => {
    const file = event.target.files?.[0];
    if (!selectedTask || !file) return;
    await tasksApi.uploadAttachment(selectedTask.id, file);
    await loadTaskDetail(selectedTask.id);
    event.target.value = "";
  };

  const runAi = async (action) => {
    if (!selectedTask) return;
    const response = await tasksApi.aiAssist(selectedTask.id, action);
    setAiResult(response.data.result);
    setTab(3);
  };

  const linkedKnowledge = useMemo(
    () => knowledgeItems.filter((item) => taskForm.related_knowledge_ids.includes(item.id)),
    [knowledgeItems, taskForm.related_knowledge_ids]
  );

  return (
    <>
      <PageHeader
        eyebrow={user.role === "USER" ? "My Tasks" : "Collaborative Task Workspace"}
        title={user.role === "USER" ? "Tasks, updates, and collaboration" : "Operational work, collaboration, and AI assistance"}
        description="Edit live task details, collaborate through comments and attachments, review activity history, and use AI to move work forward."
      />
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      <GlassPanel
        title="Task workspace"
        subtitle={`${tasks.length} tasks visible in your current scope`}
        action={
          <Stack direction={{ xs: "column", xl: "row" }} spacing={1.2}>
            <TextField
              size="small"
              label="Search"
              value={filters.search}
              onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value }))}
              sx={{ minWidth: 180 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
            />
            <TextField select size="small" label="Status" value={filters.status} onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value }))} sx={{ minWidth: 140 }}>
              <MenuItem value="">All</MenuItem>
              {statusOptions.map((status) => <MenuItem key={status} value={status}>{status.replaceAll("_", " ")}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Priority" value={filters.priority} onChange={(event) => setFilters((previous) => ({ ...previous, priority: event.target.value }))} sx={{ minWidth: 140 }}>
              <MenuItem value="">All</MenuItem>
              {priorityOptions.map((priority) => <MenuItem key={priority} value={priority}>{priority}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="SLA" value={filters.sla_status} onChange={(event) => setFilters((previous) => ({ ...previous, sla_status: event.target.value }))} sx={{ minWidth: 140 }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="on_track">On track</MenuItem>
              <MenuItem value="warning">Warning</MenuItem>
              <MenuItem value="breached">Breached</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
            </TextField>
            {canManageUsers ? (
              <TextField select size="small" label="Assignee" value={filters.assignee_id} onChange={(event) => setFilters((previous) => ({ ...previous, assignee_id: event.target.value }))} sx={{ minWidth: 170 }}>
                <MenuItem value="">All</MenuItem>
                {users.map((assignee) => <MenuItem key={assignee.id} value={assignee.id}>{assignee.full_name}</MenuItem>)}
              </TextField>
            ) : null}
            {canManageUsers ? (
              <TextField select size="small" label="Team" value={filters.team_id} onChange={(event) => setFilters((previous) => ({ ...previous, team_id: event.target.value }))} sx={{ minWidth: 160 }}>
                <MenuItem value="">All</MenuItem>
                {teams.map((team) => <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>)}
              </TextField>
            ) : null}
          </Stack>
        }
      >
        {loading ? <CircularProgress /> : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Task</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Assignee</TableCell>
                <TableCell>Due</TableCell>
                <TableCell>SLA</TableCell>
                <TableCell>Risk</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id} hover onClick={() => openTask(task.id)} sx={{ cursor: "pointer" }}>
                  <TableCell>
                    <Typography variant="subtitle2">{task.title}</Typography>
                    <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.56)" }}>{task.description.slice(0, 100)}...</Typography>
                  </TableCell>
                  <TableCell><StatusPill value={task.status} /></TableCell>
                  <TableCell><StatusPill value={task.priority} /></TableCell>
                  <TableCell>{task.assignee?.full_name || "Unassigned"}</TableCell>
                  <TableCell>{formatDateTime(task.due_at)}</TableCell>
                  <TableCell><StatusPill value={task.sla_status} /></TableCell>
                  <TableCell>{task.risk_score}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </GlassPanel>

      <Drawer anchor="right" open={Boolean(selectedId)} onClose={() => { setSelectedId(null); setSelectedTask(null); }}>
        <Box sx={{ width: { xs: 380, md: 760 }, p: 3 }}>
          {detailLoading || !selectedTask ? <CircularProgress /> : (
            <Stack spacing={2.5}>
              <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    fullWidth
                    variant="standard"
                    value={taskForm.title}
                    onChange={(event) => setTaskForm((previous) => ({ ...previous, title: event.target.value }))}
                    InputProps={{ readOnly: !canEdit, disableUnderline: !canEdit, sx: { fontSize: 28, fontWeight: 700 } }}
                  />
                  <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.6)", mt: 1 }}>
                    Updated {formatDateTime(selectedTask.updated_at)}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <StatusPill value={selectedTask.status} />
                  <StatusPill value={selectedTask.priority} />
                  <StatusPill value={selectedTask.sla_status} />
                </Stack>
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {statusOptions.map((status) => (
                  <Button key={status} size="small" variant={taskForm.status === status ? "contained" : "outlined"} onClick={() => quickStatusUpdate(status)} disabled={!canEdit}>
                    {status.replaceAll("_", " ")}
                  </Button>
                ))}
              </Stack>

              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={6}
                    label="Description"
                    value={taskForm.description}
                    onChange={(event) => setTaskForm((previous) => ({ ...previous, description: event.target.value }))}
                    InputProps={{ readOnly: !canEdit }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Stack spacing={1.5}>
                    <TextField select label="Priority" value={taskForm.priority} onChange={(event) => setTaskForm((previous) => ({ ...previous, priority: event.target.value }))} disabled={!canEdit}>
                      {priorityOptions.map((priority) => <MenuItem key={priority} value={priority}>{priority}</MenuItem>)}
                    </TextField>
                    <TextField select label="Assignee" value={taskForm.assignee_id} onChange={(event) => setTaskForm((previous) => ({ ...previous, assignee_id: event.target.value }))} disabled={!canReassign}>
                      <MenuItem value="">Unassigned</MenuItem>
                      {users.map((assignee) => <MenuItem key={assignee.id} value={assignee.id}>{assignee.full_name}</MenuItem>)}
                    </TextField>
                    <TextField type="datetime-local" label="Due date" value={taskForm.due_at} onChange={(event) => setTaskForm((previous) => ({ ...previous, due_at: event.target.value }))} disabled={!canEdit} InputLabelProps={{ shrink: true }} />
                    <TextField type="number" label="SLA hours" value={taskForm.sla_hours} onChange={(event) => setTaskForm((previous) => ({ ...previous, sla_hours: event.target.value }))} disabled={!canEdit} />
                    <TextField label="Tags" value={taskForm.tags} onChange={(event) => setTaskForm((previous) => ({ ...previous, tags: event.target.value }))} helperText="Comma separated" disabled={!canEdit} />
                    <TextField
                      select
                      label="Primary knowledge"
                      value={taskForm.related_knowledge_id}
                      onChange={(event) => setTaskForm((previous) => ({ ...previous, related_knowledge_id: event.target.value }))}
                      disabled={!canEdit}
                    >
                      <MenuItem value="">None</MenuItem>
                      {knowledgeItems.map((item) => <MenuItem key={item.id} value={item.id}>{item.title}</MenuItem>)}
                    </TextField>
                    <TextField
                      select
                      SelectProps={{ multiple: true }}
                      label="Linked knowledge"
                      value={taskForm.related_knowledge_ids}
                      onChange={(event) => setTaskForm((previous) => ({ ...previous, related_knowledge_ids: event.target.value }))}
                      disabled={!canEdit}
                    >
                      {knowledgeItems.map((item) => <MenuItem key={item.id} value={item.id}>{item.title}</MenuItem>)}
                    </TextField>
                    {canEdit ? (
                      <Button startIcon={<Save />} variant="contained" onClick={saveTask}>
                        Save task
                      </Button>
                    ) : null}
                  </Stack>
                </Grid>
              </Grid>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {linkedKnowledge.map((item) => <StatusPill key={item.id} value={item.category.toUpperCase()} />)}
                {selectedTask.tags?.map((tag) => (
                  <Typography key={tag} variant="caption" sx={{ px: 1.2, py: 0.75, borderRadius: 99, bgcolor: "rgba(255,255,255,0.06)" }}>
                    {tag}
                  </Typography>
                ))}
              </Stack>

              <Tabs value={tab} onChange={(_, next) => setTab(next)}>
                <Tab label="Comments" />
                <Tab label="Activity" />
                <Tab label="Attachments" />
                <Tab label="AI Helper" />
              </Tabs>
              <Divider />

              {tab === 0 ? (
                <Stack spacing={2}>
                  <TextField
                    multiline
                    minRows={3}
                    label="Add comment"
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                  />
                  <Button variant="contained" onClick={postComment}>Post comment</Button>
                  <List sx={{ p: 0 }}>
                    {comments.map((entry) => (
                      <ListItem key={entry.id} sx={{ px: 0, alignItems: "flex-start" }}>
                        <ListItemText
                          primary={`${entry.author?.full_name || "Unknown"} • ${formatDateTime(entry.created_at)}`}
                          secondary={<Typography variant="body2" sx={{ color: "rgba(226,232,240,0.72)", whiteSpace: "pre-wrap" }}>{entry.content}</Typography>}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Stack>
              ) : null}

              {tab === 1 ? (
                <Stack spacing={1.5}>
                  {activity.map((entry) => (
                    <Stack key={entry.id} direction="row" spacing={1.5} sx={{ p: 1.5, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }}>
                      <Box sx={{ pt: 0.5 }}>{activityIcon(entry.action_type)}</Box>
                      <Box>
                        <Typography variant="subtitle2">{entry.message}</Typography>
                        <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.62)" }}>
                          {entry.user?.full_name || "System"} • {formatDateTime(entry.created_at)}
                        </Typography>
                        {entry.field_changed ? (
                          <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.56)" }}>
                            {entry.field_changed}: {entry.old_value || "empty"} {"->"} {entry.new_value || "empty"}
                          </Typography>
                        ) : null}
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              ) : null}

              {tab === 2 ? (
                <Stack spacing={2}>
                  <input ref={fileInputRef} type="file" hidden onChange={uploadAttachment} />
                  {canEdit ? (
                    <Button startIcon={<AttachFile />} variant="outlined" onClick={() => fileInputRef.current?.click()}>
                      Upload attachment
                    </Button>
                  ) : null}
                  <List sx={{ p: 0 }}>
                    {attachments.map((attachment) => (
                      <ListItem key={attachment.id} sx={{ px: 0 }}>
                        <ListItemText
                          primary={attachment.file_name}
                          secondary={`${attachment.uploader?.full_name || "Unknown"} • ${formatDateTime(attachment.created_at)}`}
                        />
                        <Button component="a" href={`http://localhost:7155${attachment.file_path}`} target="_blank">Download</Button>
                      </ListItem>
                    ))}
                  </List>
                </Stack>
              ) : null}

              {tab === 3 ? (
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {["Summarize task", "Suggest next steps", "Break into subtasks"].map((action) => (
                      <Button key={action} startIcon={<AutoAwesome />} variant="outlined" onClick={() => runAi(action)}>
                        {action}
                      </Button>
                    ))}
                  </Stack>
                  {aiResult ? (
                    <Box sx={{ p: 2, borderRadius: 3, bgcolor: "rgba(116,184,255,0.08)" }}>
                      <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>{aiResult}</Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.6)" }}>
                      Choose an AI action to get a fast task summary, next steps, or subtask suggestions.
                    </Typography>
                  )}
                </Stack>
              ) : null}
            </Stack>
          )}
        </Box>
      </Drawer>
    </>
  );
}

export default TasksPage;
