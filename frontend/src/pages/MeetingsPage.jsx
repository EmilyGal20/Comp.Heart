import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { meetingsApi, tasksApi } from "../api/endpoints";
import CardListScroll from "../components/CardListScroll";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import PageState from "../components/PageState";
import PaginationControls from "../components/PaginationControls";
import PageHeader from "../components/PageHeader";
import { surfaceSubtle } from "../styles/muiSurfaces";
import { useAuth } from "../store/AuthContext";

const emptyMeeting = { title: "", raw_notes: "" };

function normalizeListPayload(data) {
  if (data == null) {
    return { list: [], meta: null };
  }
  if (Array.isArray(data)) {
    return { list: data, meta: null };
  }
  if (Array.isArray(data.items)) {
    return { list: data.items, meta: data.meta ?? null };
  }
  return { list: [], meta: null };
}

function normalizeMeeting(m) {
  if (!m) return null;
  return {
    ...m,
    action_items: Array.isArray(m.action_items) ? m.action_items : [],
    decisions: Array.isArray(m.decisions) ? m.decisions : [],
    followups: Array.isArray(m.followups) ? m.followups : [],
  };
}

function buildMeetingTaskDraft(meeting) {
  const title = meeting?.title
    ? `Follow-up: ${String(meeting.title).slice(0, 200)}`
    : "Follow-up from meeting";
  const lines = [
    `Created from meeting summary #${meeting.id}.`,
    "",
    "---",
    "Summary",
    String(meeting.summary || "").trim(),
  ];
  if (meeting.raw_notes) {
    lines.push("", "---", "Source notes (excerpt)", String(meeting.raw_notes).slice(0, 4000));
  }
  const description = lines.filter(Boolean).join("\n");
  return { title: title.slice(0, 220), description: description.slice(0, 10000) };
}

function MeetingsPage() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user, activeOrganizationId, scopedOrganization } = useAuth();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyMeeting);
  const [listError, setListError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [detailLoading, setDetailLoading] = useState(false);

  const canCreateTask = ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"].includes(user.role);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createTaskForm, setCreateTaskForm] = useState({ title: "", description: "", priority: "medium" });
  const [createTaskSaving, setCreateTaskSaving] = useState(false);
  const [createTaskError, setCreateTaskError] = useState("");
  const openCreateTaskDialog = () => {
    if (!selected) return;
    setCreateTaskError("");
    const draft = buildMeetingTaskDraft(selected);
    setCreateTaskForm({ title: draft.title, description: draft.description, priority: "medium" });
    setCreateTaskOpen(true);
  };

  const submitCreateTask = async () => {
    if (!selected?.organization_id) {
      setCreateTaskError("Missing organization for this meeting — cannot create a task.");
      return;
    }
    if (createTaskForm.title.trim().length < 4) {
      setCreateTaskError("Title must be at least 4 characters.");
      return;
    }
    if (createTaskForm.description.trim().length < 4) {
      setCreateTaskError("Description must be at least 4 characters.");
      return;
    }
    setCreateTaskSaving(true);
    setCreateTaskError("");
    try {
      const response = await tasksApi.create({
        title: createTaskForm.title.trim().slice(0, 220),
        description: createTaskForm.description.trim().slice(0, 10000),
        status: "TODO",
        priority: createTaskForm.priority,
        organization_id: selected.organization_id,
        assignee_id: null,
        due_at: null,
        sla_hours: 24,
        related_knowledge_id: null,
        related_knowledge_ids: [],
        tags: ["meeting"],
        external_refs: [`Meeting summary #${selected.id}`],
        parent_task_id: null,
        sprint_id: null,
      });
      setCreateTaskOpen(false);
      navigate(`/tasks?taskId=${response.data.id}`);
    } catch (e) {
      setCreateTaskError(e.response?.data?.detail || "Could not create the task. Check permissions and try again.");
    } finally {
      setCreateTaskSaving(false);
    }
  };

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const response = await meetingsApi.list({
        paginated: true,
        page,
        page_size: 12,
      });
      const { list, meta: nextMeta } = normalizeListPayload(response.data);
      setItems(list);
      setMeta(nextMeta);
      setListError("");
    } catch (requestError) {
      setListError(requestError.response?.data?.detail || "Unable to load meetings");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const loadMeetingById = useCallback(
    async (id) => {
      if (!id) {
        setSelected(null);
        setDetailError("");
        return;
      }
      setDetailLoading(true);
      setDetailError("");
      try {
        const res = await meetingsApi.detail(id);
        setSelected(normalizeMeeting(res.data));
      } catch (e) {
        setSelected(null);
        setDetailError(e.response?.data?.detail || "That meeting summary could not be opened.");
      } finally {
        setDetailLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const n = meetingId && !Number.isNaN(Number(meetingId)) ? Number(meetingId) : null;
    if (n) {
      loadMeetingById(n);
    } else {
      setSelected(null);
      setDetailError("");
    }
  }, [meetingId, loadMeetingById]);

  const openMeeting = (item) => {
    const id = item?.id;
    if (id) navigate(`/meetings/${id}`);
  };

  const clearSelection = () => {
    navigate("/meetings");
  };

  const summarize = async () => {
    const orgPayload =
      user.role === "SUPER_ADMIN" && activeOrganizationId ? { organization_id: activeOrganizationId } : {};
    const response = await meetingsApi.summarize({ ...form, ...orgPayload });
    setOpen(false);
    setForm(emptyMeeting);
    setSelected(normalizeMeeting(response.data));
    await loadList();
    if (response.data?.id) {
      navigate(`/meetings/${response.data.id}`, { replace: true });
    }
  };

  const orgHint =
    user.role === "SUPER_ADMIN" && !activeOrganizationId
      ? " (choose an org in the header to attach new summaries to that workspace)"
      : "";

  return (
    <>
      <PageHeader
        eyebrow="Meetings"
        title="AI meeting summaries"
        description={`Turn raw meeting notes into clean summaries, action items, decisions, and follow-ups, then create a follow-up task in one click.${orgHint}`}
        actions={[
          <Button key="new" variant="contained" onClick={() => setOpen(true)}>
            Summarize meeting
          </Button>,
        ]}
      />
      {user.role === "SUPER_ADMIN" && !activeOrganizationId ? (
        <Alert severity="info" sx={{ mb: 2.5 }}>
          Super admins: pick an <strong>Organization scope</strong> in the header so new summaries are stored for that company. You can still open any existing summary by ID from the list.
        </Alert>
      ) : null}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={5}>
          <GlassPanel title="Recent meeting summaries" subtitle="Structured meeting memory for your organization">
            <PageState
              loading={loading}
              error={listError}
              empty={!loading && !listError && items.length === 0}
              title="No meeting summaries yet"
              description="Paste notes or a transcript to create the first one."
              onRetry={loadList}
              minHeight={180}
            />
            <CardListScroll count={items.length} rowEstimatePx={100}>
            <Stack spacing={1.3}>
              {items.map((item) => (
                <Box
                  key={item.id}
                  onClick={() => openMeeting(item)}
                  sx={{
                    p: 1.7,
                    borderRadius: 3.5,
                    cursor: "pointer",
                    bgcolor: (theme) => surfaceSubtle(theme),
                    outline: Number(meetingId) === item.id ? "1px solid" : "none",
                    outlineColor: "primary.main",
                  }}
                >
                  <Typography variant="subtitle2">{item.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>{item.summary}</Typography>
                </Box>
              ))}
            </Stack>
            </CardListScroll>
            <PaginationControls meta={meta} onChange={setPage} disabled={loading} />
          </GlassPanel>
        </Grid>
        <Grid item xs={12} lg={7}>
          <GlassPanel
            title={selected?.title || "Meeting detail"}
            subtitle="Summary, action items, decisions, and follow-ups"
            action={
              meetingId && (selected || detailError) ? (
                <Button size="small" onClick={clearSelection}>
                  Back to all
                </Button>
              ) : null
            }
          >
            {detailLoading && meetingId ? (
              <Stack alignItems="center" py={3}>
                <CircularProgress size={32} />
              </Stack>
            ) : null}
            {detailError && !detailLoading ? <Alert severity="error" sx={{ mb: 2 }}>{detailError}</Alert> : null}
            {!detailLoading && selected ? (
              <Stack spacing={2}>
                {selected.creator ? (
                  <Typography variant="caption" color="text.secondary">
                    Created by {selected.creator.full_name || selected.creator.email}
                    {selected.created_at
                      ? ` · ${new Date(selected.created_at).toLocaleString()}`
                      : ""}
                    {scopedOrganization?.name ? ` · ${scopedOrganization.name}` : null}
                  </Typography>
                ) : null}
                {selected.raw_notes ? (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>Source notes</Typography>
                    <Typography variant="body2" color="text.primary" sx={{ whiteSpace: "pre-wrap" }}>{selected.raw_notes}</Typography>
                  </Box>
                ) : null}
                <Typography variant="body1" color="text.primary">{selected.summary}</Typography>
                <Box>
                  <Typography variant="subtitle2">Action items</Typography>
                  {selected.action_items.length ? (
                    selected.action_items.map((actionItem) => <Typography key={String(actionItem)} variant="body2" sx={{ mt: 0.6 }}>• {actionItem}</Typography>)
                  ) : (
                    <Typography variant="body2" color="text.secondary">None</Typography>
                  )}
                </Box>
                <Box>
                  <Typography variant="subtitle2">Decisions</Typography>
                  {selected.decisions.length ? (
                    selected.decisions.map((d) => <Typography key={String(d)} variant="body2" sx={{ mt: 0.6 }}>• {d}</Typography>)
                  ) : (
                    <Typography variant="body2" color="text.secondary">None</Typography>
                  )}
                </Box>
                <Box>
                  <Typography variant="subtitle2">Follow-ups</Typography>
                  {selected.followups.length ? (
                    selected.followups.map((f) => <Typography key={String(f)} variant="body2" sx={{ mt: 0.6 }}>• {f}</Typography>)
                  ) : (
                    <Typography variant="body2" color="text.secondary">None</Typography>
                  )}
                </Box>
                {canCreateTask && selected?.organization_id ? (
                  <Box sx={{ pt: 0.5 }}>
                    <Button
                      fullWidth
                      size="large"
                      variant="contained"
                      onClick={openCreateTaskDialog}
                    >
                      Create a task
                    </Button>
                  </Box>
                ) : canCreateTask ? (
                  <Alert severity="warning" sx={{ mt: 0.5 }}>This meeting has no organization context — you cannot create tasks here. Try a meeting under your org scope.</Alert>
                ) : null}
              </Stack>
            ) : null}
            {!detailLoading && !selected && !listError && !detailError ? (
              <Typography variant="body2" color="text.secondary">Select a meeting summary to review it, or open one from the list.</Typography>
            ) : null}
          </GlassPanel>
        </Grid>
      </Grid>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Summarize meeting</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Meeting title" value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} />
            <TextField
              label="Raw notes / transcript"
              multiline
              minRows={10}
              value={form.raw_notes}
              onChange={(event) => setForm((previous) => ({ ...previous, raw_notes: event.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={summarize}>Generate summary</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={createTaskOpen}
        onClose={() => {
          if (!createTaskSaving) {
            setCreateTaskOpen(false);
            setCreateTaskError("");
          }
        }}
        fullWidth
        maxWidth="md"
        aria-labelledby="create-task-from-meeting"
      >
        <DialogTitle id="create-task-from-meeting">Create a task from this meeting</DialogTitle>
        <DialogContent>
          <Stack spacing={2.25} sx={{ mt: 0.5 }}>
            {createTaskError ? <Alert severity="error">{createTaskError}</Alert> : null}
            <Typography variant="body2" color="text.secondary">
              Edit the title and body if you like, then create a task in the same organization as this summary. A link back to the meeting is stored in external references.
            </Typography>
            <TextField
              fullWidth
              required
              label="Task title"
              value={createTaskForm.title}
              onChange={(e) => setCreateTaskForm((p) => ({ ...p, title: e.target.value }))}
              inputProps={{ maxLength: 220 }}
            />
            <TextField
              fullWidth
              required
              multiline
              minRows={8}
              label="Description"
              value={createTaskForm.description}
              onChange={(e) => setCreateTaskForm((p) => ({ ...p, description: e.target.value }))}
              inputProps={{ maxLength: 10000 }}
            />
            <FormControl fullWidth size="small">
              <InputLabel>Priority</InputLabel>
              <Select
                label="Priority"
                value={createTaskForm.priority}
                onChange={(e) => setCreateTaskForm((p) => ({ ...p, priority: e.target.value }))}
              >
                <MenuItem value="low">low</MenuItem>
                <MenuItem value="medium">medium</MenuItem>
                <MenuItem value="high">high</MenuItem>
                <MenuItem value="critical">critical</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCreateTaskOpen(false); setCreateTaskError(""); }} disabled={createTaskSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={submitCreateTask}
            disabled={createTaskSaving || !createTaskForm.title.trim() || !createTaskForm.description.trim()}
          >
            {createTaskSaving ? "Creating…" : "Create task & open in Tasks"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default MeetingsPage;
