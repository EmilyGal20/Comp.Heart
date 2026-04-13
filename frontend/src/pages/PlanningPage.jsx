import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { workApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import { useAuth } from "../store/AuthContext";
import { useRealtime } from "../store/RealtimeContext";

const sprintFormDefault = { name: "", goal: "", start_date: "", end_date: "" };
const templateFormDefault = { name: "", title_template: "", description_template: "", default_priority: "medium", default_tags: "", default_sla: 24 };

function PlanningPage() {
  const { activeOrganizationId, user } = useAuth();
  const { versions } = useRealtime();
  const [sprints, setSprints] = useState([]);
  const [backlog, setBacklog] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [selectedSprintId, setSelectedSprintId] = useState("");
  const [sprintOpen, setSprintOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [sprintForm, setSprintForm] = useState(sprintFormDefault);
  const [templateForm, setTemplateForm] = useState(templateFormDefault);
  const [error, setError] = useState("");

  const orgId = activeOrganizationId || user.organization_id;

  const load = async () => {
    try {
      setError("");
      const [sprintsResponse, backlogResponse, templatesResponse, recurringResponse, reportResponse] = await Promise.all([
        workApi.sprints({ organization_id: orgId }),
        workApi.backlog({ organization_id: orgId }),
        workApi.templates({ organization_id: orgId }),
        workApi.recurring({ organization_id: orgId }),
        workApi.reports({ organization_id: orgId }),
      ]);
      setSprints(sprintsResponse.data);
      setBacklog(backlogResponse.data);
      setTemplates(templatesResponse.data);
      setRecurring(recurringResponse.data);
      setApprovals(reportResponse.data.overdue_tasks || []);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load planning workspace");
    }
  };

  useEffect(() => {
    load();
  }, [orgId, versions.activity, versions.tasks]);

  const activeSprint = useMemo(() => sprints.find((item) => item.id === Number(selectedSprintId)) || sprints.find((item) => item.status === "ACTIVE") || null, [selectedSprintId, sprints]);

  const createSprint = async () => {
    await workApi.createSprint({ ...sprintForm, organization_id: orgId, start_date: sprintForm.start_date || null, end_date: sprintForm.end_date || null });
    setSprintOpen(false);
    setSprintForm(sprintFormDefault);
    await load();
  };

  const createTemplate = async () => {
    await workApi.createTemplate({ ...templateForm, organization_id: orgId, default_tags: templateForm.default_tags.split(",").map((item) => item.trim()).filter(Boolean) });
    setTemplateOpen(false);
    setTemplateForm(templateFormDefault);
    await load();
  };

  const moveTask = async (taskId, sprintId) => {
    await workApi.assignTaskSprint(taskId, sprintId || null);
    await load();
  };

  return (
    <>
      <PageHeader
        eyebrow="Planning"
        title="Backlog, sprints, and reusable work patterns"
        description="Shape upcoming work with a cleaner backlog, active sprint boards, task templates, recurring task schedules, and approval visibility."
        actions={[
          <Button key="sprint" variant="contained" onClick={() => setSprintOpen(true)}>New sprint</Button>,
          <Button key="template" variant="outlined" onClick={() => setTemplateOpen(true)}>New template</Button>,
        ]}
      />
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={4}>
          <GlassPanel title="Sprints" subtitle="Active and upcoming iterations">
            <Stack spacing={1.3}>
              {sprints.map((sprint) => (
                <Stack key={sprint.id} sx={{ p: 1.6, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }} spacing={1}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography variant="subtitle2">{sprint.name}</Typography>
                    <StatusPill value={sprint.status} />
                  </Stack>
                  <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.65)" }}>{sprint.goal}</Typography>
                  <Chip size="small" label={`${sprint.progress.done}/${sprint.progress.total} done`} />
                  <Stack direction="row" spacing={1}>
                    <Button size="small" onClick={() => setSelectedSprintId(sprint.id)}>Focus</Button>
                    {sprint.status !== "ACTIVE" ? <Button size="small" onClick={() => workApi.updateSprintStatus(sprint.id, { status: "ACTIVE" }).then(load)}>Start</Button> : null}
                    {sprint.status !== "COMPLETED" ? <Button size="small" onClick={() => workApi.updateSprintStatus(sprint.id, { status: "COMPLETED" }).then(load)}>Complete</Button> : null}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} lg={8}>
          <GlassPanel title={activeSprint ? `${activeSprint.name} board` : "Backlog board"} subtitle="Move work between backlog and the focused sprint">
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ mb: 1.2 }}>Backlog</Typography>
                <Stack spacing={1.2}>
                  {backlog.map((task) => (
                    <Stack key={task.id} sx={{ p: 1.5, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }} spacing={1}>
                      <Typography variant="subtitle2">{task.title}</Typography>
                      <Stack direction="row" spacing={1}>
                        <StatusPill value={task.priority} />
                        <StatusPill value={task.status} />
                      </Stack>
                      {activeSprint ? <Button size="small" onClick={() => moveTask(task.id, activeSprint.id)}>Add to sprint</Button> : null}
                    </Stack>
                  ))}
                </Stack>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ mb: 1.2 }}>Sprint tasks</Typography>
                <Stack spacing={1.2}>
                  {(activeSprint?.tasks || []).map((task) => (
                    <Stack key={task.id} sx={{ p: 1.5, borderRadius: 3, bgcolor: "rgba(116,184,255,0.08)" }} spacing={1}>
                      <Typography variant="subtitle2">{task.title}</Typography>
                      <Stack direction="row" spacing={1}>
                        <StatusPill value={task.priority} />
                        <StatusPill value={task.status} />
                      </Stack>
                      <Button size="small" onClick={() => moveTask(task.id, null)}>Move to backlog</Button>
                    </Stack>
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} md={6}>
          <GlassPanel title="Task templates" subtitle="Repeatable work patterns">
            <Stack spacing={1.2}>
              {templates.map((template) => (
                <Stack key={template.id} direction="row" justifyContent="space-between" sx={{ p: 1.4, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }}>
                  <div>
                    <Typography variant="subtitle2">{template.name}</Typography>
                    <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.65)" }}>{template.title_template}</Typography>
                  </div>
                  <Button size="small" onClick={() => workApi.createTaskFromTemplate(template.id).then(load)}>Use</Button>
                </Stack>
              ))}
            </Stack>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} md={6}>
          <GlassPanel title="Recurring tasks" subtitle="Automated future task creation">
            <Stack spacing={1.2}>
              {recurring.map((item) => (
                <Stack key={item.id} sx={{ p: 1.4, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }}>
                  <Typography variant="subtitle2">{item.template?.name || "Recurring task"}</Typography>
                  <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.65)" }}>{item.frequency} • next {new Date(item.next_run_at).toLocaleString()}</Typography>
                </Stack>
              ))}
              <Button variant="outlined" onClick={() => workApi.runRecurring().then(load)}>Run due recurring tasks</Button>
            </Stack>
          </GlassPanel>
        </Grid>
      </Grid>
      <Dialog open={sprintOpen} onClose={() => setSprintOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create sprint</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={sprintForm.name} onChange={(event) => setSprintForm((previous) => ({ ...previous, name: event.target.value }))} />
            <TextField label="Goal" value={sprintForm.goal} onChange={(event) => setSprintForm((previous) => ({ ...previous, goal: event.target.value }))} multiline minRows={3} />
            <TextField type="date" label="Start date" InputLabelProps={{ shrink: true }} value={sprintForm.start_date} onChange={(event) => setSprintForm((previous) => ({ ...previous, start_date: event.target.value }))} />
            <TextField type="date" label="End date" InputLabelProps={{ shrink: true }} value={sprintForm.end_date} onChange={(event) => setSprintForm((previous) => ({ ...previous, end_date: event.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSprintOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createSprint}>Create</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={templateOpen} onClose={() => setTemplateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create template</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={templateForm.name} onChange={(event) => setTemplateForm((previous) => ({ ...previous, name: event.target.value }))} />
            <TextField label="Title template" value={templateForm.title_template} onChange={(event) => setTemplateForm((previous) => ({ ...previous, title_template: event.target.value }))} />
            <TextField label="Description template" value={templateForm.description_template} onChange={(event) => setTemplateForm((previous) => ({ ...previous, description_template: event.target.value }))} multiline minRows={4} />
            <TextField select label="Priority" value={templateForm.default_priority} onChange={(event) => setTemplateForm((previous) => ({ ...previous, default_priority: event.target.value }))}>
              {["low", "medium", "high", "critical"].map((priority) => <MenuItem key={priority} value={priority}>{priority}</MenuItem>)}
            </TextField>
            <TextField label="Default tags" value={templateForm.default_tags} onChange={(event) => setTemplateForm((previous) => ({ ...previous, default_tags: event.target.value }))} />
            <TextField type="number" label="Default SLA" value={templateForm.default_sla} onChange={(event) => setTemplateForm((previous) => ({ ...previous, default_sla: event.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createTemplate}>Create</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default PlanningPage;
