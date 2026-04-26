import { useCallback, useEffect, useMemo, useState } from "react";
import { AutoAwesome, PlayArrow } from "@mui/icons-material";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { aiApi, tasksApi, workApi } from "../api/endpoints";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import PageState from "../components/PageState";
import StatusPill from "../components/StatusPill";
import { useAuth } from "../store/AuthContext";
import { useRealtime } from "../store/RealtimeContext";
import { borderSubtle, surfaceSubtle, surfaceSubtleWeaker, surfaceSubtleRow } from "../styles/muiSurfaces";

const sprintFormDefault = { name: "", goal: "", start_date: "", end_date: "" };
const templateFormDefault = {
  name: "",
  title_template: "",
  description_template: "",
  default_priority: "medium",
  default_tags: "",
  default_sla: 24,
};

function PlanningPage() {
  const { activeOrganizationId, user } = useAuth();
  const { versions } = useRealtime();
  const [sprints, setSprints] = useState([]);
  const [backlog, setBacklog] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [selectedSprintId, setSelectedSprintId] = useState("");
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [sprintOpen, setSprintOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [sprintForm, setSprintForm] = useState(sprintFormDefault);
  const [templateForm, setTemplateForm] = useState(templateFormDefault);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const orgId = activeOrganizationId || user.organization_id;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sprintsResponse, backlogResponse, templatesResponse, recurringResponse] = await Promise.all([
        workApi.sprints({ organization_id: orgId }),
        workApi.backlog({ organization_id: orgId }),
        workApi.templates({ organization_id: orgId }),
        workApi.recurring({ organization_id: orgId }),
      ]);
      setSprints(Array.isArray(sprintsResponse.data) ? sprintsResponse.data : []);
      setBacklog(Array.isArray(backlogResponse.data) ? backlogResponse.data : []);
      setTemplates(Array.isArray(templatesResponse.data) ? templatesResponse.data : []);
      setRecurring(Array.isArray(recurringResponse.data) ? recurringResponse.data : []);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load planning workspace");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load, versions.tasks, versions.activity, versions.analytics]);

  const activeSprint = useMemo(
    () =>
      sprints.find((item) => item.id === Number(selectedSprintId)) ||
      sprints.find((item) => item.status === "ACTIVE") ||
      sprints[0] ||
      null,
    [selectedSprintId, sprints]
  );

  const createSprint = async () => {
    await workApi.createSprint({
      ...sprintForm,
      organization_id: orgId,
      start_date: sprintForm.start_date || null,
      end_date: sprintForm.end_date || null,
    });
    setSprintOpen(false);
    setSprintForm(sprintFormDefault);
    await load();
  };

  const createTemplate = async () => {
    await workApi.createTemplate({
      ...templateForm,
      organization_id: orgId,
      default_tags: templateForm.default_tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    });
    setTemplateOpen(false);
    setTemplateForm(templateFormDefault);
    await load();
  };

  const moveTask = async (taskId, sprintId) => {
    await workApi.assignTaskSprint(taskId, sprintId || null);
    await load();
  };

  const reorderBacklog = async (taskId, beforeTaskId = null) => {
    const next = [...backlog];
    const dragged = next.find((task) => task.id === taskId);
    if (!dragged) return;
    const filtered = next.filter((task) => task.id !== taskId);
    const targetIndex = beforeTaskId ? filtered.findIndex((task) => task.id === beforeTaskId) : filtered.length;
    filtered.splice(targetIndex < 0 ? filtered.length : targetIndex, 0, dragged);
    await workApi.reorderBacklog(
      filtered.map((task) => task.id),
      { organization_id: orgId }
    );
    await load();
  };

  const generateAiPlan = async () => {
    const response = await aiApi.suggestTaskPlan({
      prompt: aiPrompt,
      task_count: 4,
      organization_id: orgId,
      sprint_id: activeSprint?.id || null,
    });
    const suggestions = response.data?.suggestions || [];
    setAiSuggestions(suggestions);
    setSelectedSuggestions(suggestions.map((_, index) => index));
  };

  const createAiTasks = async () => {
    const chosen = aiSuggestions.filter((_, index) => selectedSuggestions.includes(index));
    await Promise.all(
      chosen.map((item) =>
        tasksApi.create({
          organization_id: orgId,
          title: item.title,
          description: item.description,
          status: "TODO",
          priority: item.priority,
          assignee_id: item.suggested_assignee_id,
          due_at: new Date(Date.now() + item.due_in_days * 86400000).toISOString(),
          sla_hours: item.sla_hours,
          tags: item.tags,
          related_knowledge_ids: item.related_knowledge_ids,
          sprint_id: activeSprint?.id || null,
        })
      )
    );
    setAiOpen(false);
    setAiPrompt("");
    setAiSuggestions([]);
    setSelectedSuggestions([]);
    await load();
  };

  const taskCard = (task, sprintId = null) => (
    <Box
      key={task.id}
      draggable
      onDragStart={() => setDraggedTaskId(task.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={async (event) => {
        event.preventDefault();
        if (sprintId === null && draggedTaskId) {
          await reorderBacklog(draggedTaskId, task.id);
        }
      }}
      sx={{
        p: 1.7,
        borderRadius: 2.5,
        bgcolor: (theme) => surfaceSubtleRow(theme),
        border: (theme) => `1px solid ${borderSubtle(theme)}`,
        cursor: "grab",
      }}
    >
      <Typography variant="subtitle2">{task.title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
        {task.assignee?.full_name || "Unassigned"}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 1.2 }} flexWrap="wrap" useFlexGap>
        <StatusPill value={task.priority} />
        <StatusPill value={task.status} />
      </Stack>
      {sprintId ? (
        <Button sx={{ mt: 1.25 }} size="small" onClick={() => moveTask(task.id, null)}>
          Move to backlog
        </Button>
      ) : activeSprint ? (
        <Button sx={{ mt: 1.25 }} size="small" onClick={() => moveTask(task.id, activeSprint.id)}>
          Add to sprint
        </Button>
      ) : null}
    </Box>
  );

  const isEmpty = !loading && !error && !sprints.length && !backlog.length && !templates.length && !recurring.length;

  return (
    <>
      <PageHeader
        eyebrow="Planning"
        title="Backlog, sprint shaping, and reusable work patterns"
        description="Plan work with drag-and-drop backlog movement, sprint focus, reusable templates, AI-generated work breakdowns, and scheduled recurring execution."
        actions={[
          <Button key="ai" startIcon={<AutoAwesome />} variant="outlined" onClick={() => setAiOpen(true)}>
            Generate with AI
          </Button>,
          <Button key="sprint" variant="contained" onClick={() => setSprintOpen(true)}>
            New sprint
          </Button>,
          <Button key="template" variant="outlined" onClick={() => setTemplateOpen(true)}>
            New template
          </Button>,
        ]}
      />
      <PageState
        loading={loading}
        error={error}
        empty={isEmpty}
        title="Planning workspace is empty"
        description="Create a sprint, shape the backlog, or add a reusable template to start coordinating work."
        onRetry={load}
      />
      {!loading && !error ? (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, xl: 3.5 }}>
            <GlassPanel title="Sprint lanes" subtitle="Active and upcoming cycles with progress at a glance">
              <Stack spacing={1.4}>
                {sprints.map((sprint) => (
                  <Box key={sprint.id} sx={{ p: 1.75, borderRadius: 2.5, bgcolor: (theme) => surfaceSubtle(theme) }}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Typography variant="subtitle2">{sprint.name}</Typography>
                      <StatusPill value={sprint.status} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {sprint.goal}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={sprint.progress.total ? (sprint.progress.done / sprint.progress.total) * 100 : 0}
                      sx={{ mt: 1.5, height: 8, borderRadius: 999 }}
                    />
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                      <Button size="small" onClick={() => setSelectedSprintId(sprint.id)}>
                        Focus
                      </Button>
                      {sprint.status !== "ACTIVE" ? (
                        <Button size="small" onClick={() => workApi.updateSprintStatus(sprint.id, { status: "ACTIVE" }).then(load)}>
                          Start
                        </Button>
                      ) : null}
                      {sprint.status !== "COMPLETED" ? (
                        <Button size="small" onClick={() => workApi.updateSprintStatus(sprint.id, { status: "COMPLETED" }).then(load)}>
                          Complete
                        </Button>
                      ) : null}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </GlassPanel>
          </Grid>
          <Grid size={{ xs: 12, xl: 8.5 }}>
            <GlassPanel
              title={activeSprint ? `${activeSprint.name} planning board` : "Backlog board"}
              subtitle="Drag work into the sprint, reorder the backlog, and keep iteration focus visible."
            >
              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, md: 5.5 }}>
                  <Box
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={async (event) => {
                      event.preventDefault();
                      if (draggedTaskId) await moveTask(draggedTaskId, null);
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ mb: 1.4 }}>
                      Backlog
                    </Typography>
                    <Stack spacing={1.25}>
                      {backlog.map((task) => taskCard(task, null))}
                      {!backlog.length ? (
                        <Box sx={{ p: 3, borderRadius: 3, bgcolor: (theme) => surfaceSubtleWeaker(theme) }}>
                          <Typography variant="body2">Backlog is clear right now.</Typography>
                        </Box>
                      ) : null}
                    </Stack>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 6.5 }}>
                  <Box
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={async (event) => {
                      event.preventDefault();
                      if (draggedTaskId && activeSprint) await moveTask(draggedTaskId, activeSprint.id);
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ mb: 1.4 }}>
                      Sprint focus
                    </Typography>
                    <Stack spacing={1.25}>
                      {(activeSprint?.tasks || []).map((task) => taskCard(task, activeSprint?.id))}
                      {!activeSprint?.tasks?.length ? (
                        <Box sx={{ p: 3, borderRadius: 3, bgcolor: "rgba(116,184,255,0.06)" }}>
                          <Typography variant="body2">Drop backlog tasks here to shape the sprint.</Typography>
                        </Box>
                      ) : null}
                    </Stack>
                  </Box>
                </Grid>
              </Grid>
            </GlassPanel>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <GlassPanel title="Task templates" subtitle="Reusable operating patterns for common work streams">
              <Stack spacing={1.2}>
                {templates.map((template) => (
                  <Stack
                    key={template.id}
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ p: 1.5, borderRadius: 2.5, bgcolor: (theme) => surfaceSubtle(theme) }}
                  >
                    <Box>
                      <Typography variant="subtitle2">{template.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {template.title_template}
                      </Typography>
                    </Box>
                    <Button size="small" onClick={() => workApi.createTaskFromTemplate(template.id).then(load)}>
                      Use
                    </Button>
                  </Stack>
                ))}
              </Stack>
            </GlassPanel>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <GlassPanel title="Recurring tasks" subtitle="Scheduled generation with safe manual trigger visibility">
              <Stack spacing={1.2}>
                {recurring.map((item) => (
                  <Box key={item.id} sx={{ p: 1.5, borderRadius: 2.5, bgcolor: (theme) => surfaceSubtle(theme) }}>
                    <Typography variant="subtitle2">{item.template?.name || "Recurring task"}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
                      {item.frequency} · next {new Date(item.next_run_at).toLocaleString()}
                    </Typography>
                  </Box>
                ))}
                <Divider sx={{ borderColor: (theme) => borderSubtle(theme) }} />
                <Button startIcon={<PlayArrow />} variant="outlined" onClick={() => workApi.runRecurring().then(load)}>
                  Run due recurring tasks now
                </Button>
              </Stack>
            </GlassPanel>
          </Grid>
        </Grid>
      ) : null}

      <Dialog open={sprintOpen} onClose={() => setSprintOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create sprint</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={sprintForm.name}
              onChange={(event) => setSprintForm((previous) => ({ ...previous, name: event.target.value }))}
            />
            <TextField
              label="Goal"
              value={sprintForm.goal}
              onChange={(event) => setSprintForm((previous) => ({ ...previous, goal: event.target.value }))}
              multiline
              minRows={3}
            />
            <TextField
              type="date"
              label="Start date"
              InputLabelProps={{ shrink: true }}
              value={sprintForm.start_date}
              onChange={(event) => setSprintForm((previous) => ({ ...previous, start_date: event.target.value }))}
            />
            <TextField
              type="date"
              label="End date"
              InputLabelProps={{ shrink: true }}
              value={sprintForm.end_date}
              onChange={(event) => setSprintForm((previous) => ({ ...previous, end_date: event.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSprintOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createSprint}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={templateOpen} onClose={() => setTemplateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create template</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={templateForm.name}
              onChange={(event) => setTemplateForm((previous) => ({ ...previous, name: event.target.value }))}
            />
            <TextField
              label="Title template"
              value={templateForm.title_template}
              onChange={(event) => setTemplateForm((previous) => ({ ...previous, title_template: event.target.value }))}
            />
            <TextField
              label="Description template"
              value={templateForm.description_template}
              onChange={(event) => setTemplateForm((previous) => ({ ...previous, description_template: event.target.value }))}
              multiline
              minRows={4}
            />
            <TextField
              select
              label="Priority"
              value={templateForm.default_priority}
              onChange={(event) => setTemplateForm((previous) => ({ ...previous, default_priority: event.target.value }))}
            >
              {["low", "medium", "high", "critical"].map((priority) => (
                <MenuItem key={priority} value={priority}>
                  {priority}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Default tags"
              value={templateForm.default_tags}
              onChange={(event) => setTemplateForm((previous) => ({ ...previous, default_tags: event.target.value }))}
            />
            <TextField
              type="number"
              label="Default SLA"
              value={templateForm.default_sla}
              onChange={(event) => setTemplateForm((previous) => ({ ...previous, default_sla: Number(event.target.value) }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createTemplate}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={aiOpen} onClose={() => setAiOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Generate sprint-ready tasks with AI</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1.2 }}>
            <TextField
              label="Prompt"
              multiline
              minRows={3}
              placeholder="Prepare onboarding flow for new support employee"
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
            />
            <Button variant="outlined" startIcon={<AutoAwesome />} onClick={generateAiPlan}>
              Generate suggestions
            </Button>
            <Stack spacing={1.2}>
              {aiSuggestions.map((item, index) => (
                <Stack
                  key={`${item.title}-${index}`}
                  direction="row"
                  spacing={1.5}
                  alignItems="flex-start"
                  sx={{ p: 1.5, borderRadius: 2.5, bgcolor: (theme) => surfaceSubtle(theme) }}
                >
                  <Checkbox
                    checked={selectedSuggestions.includes(index)}
                    onChange={() =>
                      setSelectedSuggestions((previous) =>
                        previous.includes(index) ? previous.filter((value) => value !== index) : [...previous, index]
                      )
                    }
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2">{item.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.7, whiteSpace: "pre-wrap" }}>
                      {item.description}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={item.priority} />
                      <Chip size="small" label={`Due in ${item.due_in_days}d`} />
                      <Chip size="small" label={item.risk_level} color={item.risk_level === "high" ? "warning" : "default"} />
                    </Stack>
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAiOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createAiTasks} disabled={!selectedSuggestions.length}>
            Create selected tasks
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default PlanningPage;
