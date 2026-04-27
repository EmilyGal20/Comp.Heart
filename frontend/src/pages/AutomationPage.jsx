import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { automationApi } from "../api/endpoints";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import { borderSubtle, surfaceSubtle } from "../styles/muiSurfaces";
import { useAuth } from "../store/AuthContext";

const TRIGGER_OPTIONS = [
  { value: "task.created", label: "Task created" },
  { value: "task.updated", label: "Task updated" },
  { value: "task.overdue", label: "Task overdue" },
  { value: "knowledge.updated", label: "Knowledge article updated" },
  { value: "approval.updated", label: "Approval updated" },
  { value: "recurring.generated", label: "Recurring task generated" },
];

const SCOPE_OPTIONS = [{ value: "organization", label: "This organization" }];

const CONDITION_MODES = [
  { value: "none", label: "Always (when the trigger fires)" },
  { value: "sla_status", label: "Task SLA status is…" },
  { value: "priority", label: "Task priority is…" },
  { value: "status", label: "Task status is…" },
  { value: "category", label: "Knowledge category is…" },
];

const SLA_OPTIONS = ["on_track", "warning", "breached"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"];
const STATUS_OPTIONS = ["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE"];

const ACTION_TYPES = [
  { value: "notify", label: "Send a notification" },
  { value: "ai_suggest", label: "Boost in AI answers (suggest)" },
];

const AUDIENCE_OPTIONS = [
  { value: "managers", label: "Managers" },
  { value: "assignee_and_admin", label: "Assignee & admins" },
  { value: "assignee", label: "Assignee only" },
];

const SEVERITY_OPTIONS = ["low", "medium", "high", "critical"];
const AI_WEIGHTS = [
  { value: "boost", label: "Boost related answers" },
  { value: "normal", label: "Normal" },
];

function parseJsonObject(val) {
  if (val == null) return {};
  if (typeof val === "object" && !Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      return JSON.parse(val || "{}");
    } catch {
      return {};
    }
  }
  return {};
}

function conditionModeFromObject(obj) {
  const keys = Object.keys(obj);
  if (keys.length === 0) return { mode: "none" };
  if (obj.sla_status != null) {
    return { mode: "sla_status", conditionSla: String(obj.sla_status) };
  }
  if (obj.priority != null) {
    return { mode: "priority", conditionPriority: String(obj.priority) };
  }
  if (obj.status != null) {
    return { mode: "status", conditionStatus: String(obj.status) };
  }
  if (obj.category != null) {
    return { mode: "category", conditionCategory: String(obj.category) };
  }
  return { mode: "none", _custom: true };
}

function actionStateFromObject(obj) {
  const type = obj.type === "ai_suggest" ? "ai_suggest" : "notify";
  if (type === "ai_suggest") {
    return {
      actionType: "ai_suggest",
      actionWeight: obj.weight || "boost",
    };
  }
  return {
    actionType: "notify",
    actionAudience: obj.audience || "managers",
    actionSeverity: obj.severity || "medium",
  };
}

function buildCondition(state) {
  const { conditionMode, conditionSla, conditionPriority, conditionStatus, conditionCategory } = state;
  switch (conditionMode) {
    case "sla_status":
      return { sla_status: conditionSla };
    case "priority":
      return { priority: conditionPriority };
    case "status":
      return { status: conditionStatus };
    case "category":
      return { category: conditionCategory };
    default:
      return {};
  }
}

function buildAction(state) {
  if (state.actionType === "ai_suggest") {
    return { type: "ai_suggest", weight: state.actionWeight || "boost" };
  }
  return {
    type: "notify",
    audience: state.actionAudience || "managers",
    severity: state.actionSeverity || "medium",
  };
}

function buildScope(state) {
  return { target: state.scopeTarget || "organization" };
}

function formatConditionSummary(strOrObj) {
  const c = parseJsonObject(strOrObj);
  if (Object.keys(c).length === 0) return "Always";
  if (c.sla_status) return `SLA: ${c.sla_status.replaceAll("_", " ")}`;
  if (c.priority) return `Priority: ${c.priority}`;
  if (c.status) return `Status: ${c.status.replaceAll("_", " ")}`;
  if (c.category) return `Category: ${c.category}`;
  return "Custom condition";
}

function formatActionSummary(strOrObj) {
  const a = parseJsonObject(strOrObj);
  if (a.type === "ai_suggest") {
    return `AI suggest · ${a.weight || "boost"}`;
  }
  if (a.type === "notify" || a.audience) {
    return `Notify ${(a.audience || "team").replaceAll("_", " ")} · ${a.severity || "medium"}`;
  }
  return "Action";
}

function formatScopeSummary(strOrObj) {
  const s = parseJsonObject(strOrObj);
  if (s.target === "organization" || !s.target) return "This organization";
  return `Scope: ${s.target || "—"}`;
}

const emptyForm = () => ({
  name: "",
  description: "",
  trigger_type: "task.updated",
  is_enabled: true,
  scopeTarget: "organization",
  conditionMode: "none",
  conditionSla: "breached",
  conditionPriority: "high",
  conditionStatus: "TODO",
  conditionCategory: "operations",
  actionType: "notify",
  actionAudience: "managers",
  actionSeverity: "high",
  actionWeight: "boost",
});

function ruleToFormState(rule) {
  const condObj = parseJsonObject(rule.condition_json);
  const actObj = parseJsonObject(rule.action_json);
  const scopeObj = parseJsonObject(rule.scope_json);
  const cm = conditionModeFromObject(condObj);
  const as = actionStateFromObject(actObj);
  return {
    name: rule.name || "",
    description: rule.description || "",
    trigger_type: rule.trigger_type || "task.updated",
    is_enabled: rule.is_enabled !== false,
    scopeTarget: scopeObj.target || "organization",
    ...cm,
    conditionSla: cm.conditionSla || "breached",
    conditionPriority: cm.conditionPriority || "high",
    conditionStatus: cm.conditionStatus || "TODO",
    conditionCategory: cm.conditionCategory || "operations",
    ...as,
    actionAudience: as.actionAudience || "managers",
    actionSeverity: as.actionSeverity || "medium",
    actionWeight: as.actionWeight || "boost",
  };
}

function AutomationPage() {
  const { activeOrganizationId, user } = useAuth();
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const load = () =>
    automationApi.list({ organization_id: activeOrganizationId || undefined }).then((response) => setRules(response.data));

  useEffect(() => {
    if (!(user.role === "SUPER_ADMIN" && !activeOrganizationId)) load();
    else setRules([]);
  }, [activeOrganizationId, user.role]);

  const hasCustomCondition = useMemo(
    () => (editing ? conditionModeFromObject(parseJsonObject(editing.condition_json))._custom : false),
    [editing]
  );

  const openForm = (rule = null) => {
    setEditing(rule);
    setForm(rule ? ruleToFormState(rule) : emptyForm());
    setError("");
    setDialogOpen(true);
  };

  const submit = async () => {
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        organization_id: activeOrganizationId || user.organization_id,
        trigger_type: form.trigger_type,
        condition_json: buildCondition(form),
        action_json: buildAction(form),
        scope_json: buildScope(form),
        is_enabled: form.is_enabled,
      };
      if (editing) {
        await automationApi.update(editing.id, payload);
      } else {
        await automationApi.create(payload);
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm());
      setError("");
      load();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to save automation");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Automation Engine"
        title="Automation builder"
        description="Define when a rule runs, what it should match, and what happens next — without editing raw JSON in the app."
        actions={[<Button key="new" variant="contained" onClick={() => openForm()}>Create rule</Button>]}
      />
      {error ? <Alert severity="error" sx={{ mb: 2.5 }}>{String(error)}</Alert> : null}
      <Grid container spacing={3}>
        {user.role === "SUPER_ADMIN" && !activeOrganizationId ? (
          <Grid item xs={12}>
            <GlassPanel title="Select an organization" subtitle="Automation management is organization-scoped">
              <Typography variant="body2">Choose an organization from the header switcher to build or edit automation rules.</Typography>
            </GlassPanel>
          </Grid>
        ) : null}
        <Grid item xs={12}>
          <GlassPanel title="Automation library" subtitle="Extensible rules for approvals, recurring tasks, document updates, and SLA events">
            <Grid container spacing={2}>
              {rules.map((rule) => (
                <Grid item xs={12} lg={6} key={rule.id}>
                  <Box
                    sx={{
                      p: 1.8,
                      borderRadius: 3.5,
                      bgcolor: (theme) => surfaceSubtle(theme),
                      border: (theme) => `1px solid ${borderSubtle(theme)}`,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Typography variant="subtitle1">{rule.name}</Typography>
                      <Switch
                        checked={rule.is_enabled}
                        onChange={() => automationApi.toggle(rule.id).then(load)}
                        inputProps={{ "aria-label": "enabled" }}
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.7 }}>{rule.description}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1.2 }} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={TRIGGER_OPTIONS.find((o) => o.value === rule.trigger_type)?.label || rule.trigger_type} color="info" />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={rule.last_triggered_at ? "Recently triggered" : "No runs yet"}
                      />
                    </Stack>
                    <Grid container spacing={1.2} sx={{ mt: 1.5 }}>
                      <Grid item xs={12} sm={4}>
                        <Typography variant="caption" color="text.secondary">When</Typography>
                        <Typography variant="body2">{formatConditionSummary(rule.condition_json)}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Typography variant="caption" color="text.secondary">Action</Typography>
                        <Typography variant="body2">{formatActionSummary(rule.action_json)}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Typography variant="caption" color="text.secondary">Scope</Typography>
                        <Typography variant="body2">{formatScopeSummary(rule.scope_json)}</Typography>
                      </Grid>
                    </Grid>
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                      <Button size="small" onClick={() => openForm(rule)}>Edit</Button>
                      <Button size="small" color="error" onClick={() => automationApi.remove(rule.id).then(load)}>Delete</Button>
                    </Stack>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </GlassPanel>
        </Grid>
      </Grid>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md" scroll="paper">
        <DialogTitle>{editing ? "Edit automation rule" : "Create automation rule"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1.5 }}>
            {hasCustomCondition && editing ? (
              <Alert severity="warning">
                This rule’s conditions use a pattern the simple editor doesn’t show. Saving will replace it with the match options below.
              </Alert>
            ) : null}
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>Rule enabled</Typography>
              <Switch
                checked={form.is_enabled}
                onChange={(e) => setForm((p) => ({ ...p, is_enabled: e.target.checked }))}
                inputProps={{ "aria-label": "enabled" }}
              />
            </Stack>
            <TextField
              fullWidth
              required
              label="Rule name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <TextField
              fullWidth
              required
              label="Description"
              multiline
              minRows={3}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <GlassPanel title="Trigger" subtitle="What event starts this rule">
                  <FormControl fullWidth size="small">
                    <InputLabel>Trigger</InputLabel>
                    <Select
                      label="Trigger"
                      value={form.trigger_type}
                      onChange={(e) => setForm((p) => ({ ...p, trigger_type: e.target.value }))}
                    >
                      {TRIGGER_OPTIONS.map((o) => (
                        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </GlassPanel>
              </Grid>
              <Grid item xs={12} md={6}>
                <GlassPanel title="Scope" subtitle="Where the rule applies">
                  <FormControl fullWidth size="small">
                    <InputLabel>Applies to</InputLabel>
                    <Select
                      label="Applies to"
                      value={form.scopeTarget}
                      onChange={(e) => setForm((p) => ({ ...p, scopeTarget: e.target.value }))}
                    >
                      {SCOPE_OPTIONS.map((o) => (
                        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </GlassPanel>
              </Grid>
            </Grid>
            <GlassPanel title="Conditions" subtitle="When should this rule’s actions run, after the trigger?">
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Match</InputLabel>
                <Select
                  label="Match"
                  value={form.conditionMode}
                  onChange={(e) => setForm((p) => ({ ...p, conditionMode: e.target.value }))}
                >
                  {CONDITION_MODES.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {form.conditionMode === "sla_status" ? (
                <FormControl fullWidth size="small">
                  <InputLabel>SLA status</InputLabel>
                  <Select
                    label="SLA status"
                    value={form.conditionSla}
                    onChange={(e) => setForm((p) => ({ ...p, conditionSla: e.target.value }))}
                  >
                    {SLA_OPTIONS.map((s) => (
                      <MenuItem key={s} value={s}>{s.replaceAll("_", " ")}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : null}
              {form.conditionMode === "priority" ? (
                <FormControl fullWidth size="small">
                  <InputLabel>Priority</InputLabel>
                  <Select
                    label="Priority"
                    value={form.conditionPriority}
                    onChange={(e) => setForm((p) => ({ ...p, conditionPriority: e.target.value }))}
                  >
                    {PRIORITY_OPTIONS.map((s) => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : null}
              {form.conditionMode === "status" ? (
                <FormControl fullWidth size="small">
                  <InputLabel>Task status</InputLabel>
                  <Select
                    label="Task status"
                    value={form.conditionStatus}
                    onChange={(e) => setForm((p) => ({ ...p, conditionStatus: e.target.value }))}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <MenuItem key={s} value={s}>{s.replaceAll("_", " ")}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : null}
              {form.conditionMode === "category" ? (
                <TextField
                  fullWidth
                  size="small"
                  label="Knowledge category"
                  value={form.conditionCategory}
                  onChange={(e) => setForm((p) => ({ ...p, conditionCategory: e.target.value }))}
                  helperText="Must match the category on the document when the trigger is knowledge-related."
                />
              ) : null}
            </GlassPanel>
            <GlassPanel title="Actions" subtitle="What happens when the rule matches">
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Action</InputLabel>
                <Select
                  label="Action"
                  value={form.actionType}
                  onChange={(e) => setForm((p) => ({ ...p, actionType: e.target.value }))}
                >
                  {ACTION_TYPES.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {form.actionType === "notify" ? (
                <Stack spacing={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Notify</InputLabel>
                    <Select
                      label="Notify"
                      value={form.actionAudience}
                      onChange={(e) => setForm((p) => ({ ...p, actionAudience: e.target.value }))}
                    >
                      {AUDIENCE_OPTIONS.map((o) => (
                        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth size="small">
                    <InputLabel>Severity</InputLabel>
                    <Select
                      label="Severity"
                      value={form.actionSeverity}
                      onChange={(e) => setForm((p) => ({ ...p, actionSeverity: e.target.value }))}
                    >
                      {SEVERITY_OPTIONS.map((s) => (
                        <MenuItem key={s} value={s}>{s}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              ) : (
                <FormControl fullWidth size="small">
                  <InputLabel>How to surface in AI</InputLabel>
                  <Select
                    label="How to surface in AI"
                    value={form.actionWeight}
                    onChange={(e) => setForm((p) => ({ ...p, actionWeight: e.target.value }))}
                  >
                    {AI_WEIGHTS.map((o) => (
                      <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </GlassPanel>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDialogOpen(false); setEditing(null); setForm(emptyForm()); }}>Cancel</Button>
          <Button variant="contained" onClick={submit} disabled={!form.name?.trim() || !form.description?.trim()}>Save</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default AutomationPage;
