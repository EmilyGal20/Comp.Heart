import { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import { automationApi } from "../api/endpoints";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import { borderSubtle, surfaceSubtle } from "../styles/muiSurfaces";
import { useAuth } from "../store/AuthContext";

const initialForm = {
  name: "",
  description: "",
  trigger_type: "task.updated",
  condition_json: '{"sla_status":"breached"}',
  action_json: '{"type":"notify","audience":"assignee_and_admin","severity":"high"}',
  scope_json: '{"target":"organization"}',
  is_enabled: true,
};

function AutomationPage() {
  const { activeOrganizationId, user } = useAuth();
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const load = () => automationApi.list({ organization_id: activeOrganizationId || undefined }).then((response) => setRules(response.data));
  useEffect(() => { if (!(user.role === "SUPER_ADMIN" && !activeOrganizationId)) load(); else setRules([]); }, [activeOrganizationId]);

  const openForm = (rule = null) => {
    setEditing(rule);
    setForm(rule ? { ...rule, condition_json: rule.condition_json, action_json: rule.action_json, scope_json: rule.scope_json || "{}" } : initialForm);
    setDialogOpen(true);
  };

  const submit = async () => {
    try {
      const payload = { ...form, organization_id: activeOrganizationId || user.organization_id, condition_json: JSON.parse(form.condition_json), action_json: JSON.parse(form.action_json), scope_json: JSON.parse(form.scope_json || "{}") };
      if (editing) await automationApi.update(editing.id, payload);
      else await automationApi.create(payload);
      setDialogOpen(false);
      setEditing(null);
      setForm(initialForm);
      setError("");
      load();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to save automation");
    }
  };

  return (
    <>
      <PageHeader eyebrow="Automation Engine" title="Automation builder" description="Design readable rules with separate trigger, conditions, actions, and scope so workflow logic stays visible and maintainable." actions={[<Button key="new" variant="contained" onClick={() => openForm()}>Create rule</Button>]} />
      {error ? <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert> : null}
      <Grid container spacing={3}>
        {user.role === "SUPER_ADMIN" && !activeOrganizationId ? <Grid item xs={12}><GlassPanel title="Select an organization" subtitle="Automation management is organization-scoped"><Typography variant="body2">Choose an organization from the header switcher to build or edit automation rules.</Typography></GlassPanel></Grid> : null}
        <Grid item xs={12}>
          <GlassPanel title="Automation library" subtitle="Extensible rules for approvals, recurring tasks, document updates, and SLA events">
            <Grid container spacing={2}>
              {rules.map((rule) => (
                <Grid item xs={12} lg={6} key={rule.id}>
                  <Box sx={{ p: 1.8, borderRadius: 3.5, bgcolor: (theme) => surfaceSubtle(theme), border: (theme) => `1px solid ${borderSubtle(theme)}` }}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Typography variant="subtitle1">{rule.name}</Typography>
                      <Switch checked={rule.is_enabled} onChange={() => automationApi.toggle(rule.id).then(load)} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.7 }}>{rule.description}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1.2 }} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={rule.trigger_type} color="info" />
                      <Chip size="small" label={rule.last_triggered_at ? "Recently triggered" : "No runs yet"} />
                    </Stack>
                    <Grid container spacing={1.2} sx={{ mt: 1.5 }}>
                      <Grid item xs={12} md={4}><Typography variant="caption">Trigger</Typography><Typography variant="body2">{rule.trigger_type}</Typography></Grid>
                      <Grid item xs={12} md={4}><Typography variant="caption">Conditions</Typography><Typography variant="body2">{rule.condition_json}</Typography></Grid>
                      <Grid item xs={12} md={4}><Typography variant="caption">Actions</Typography><Typography variant="body2">{rule.action_json}</Typography></Grid>
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editing ? "Edit automation rule" : "Create automation rule"}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}><TextField fullWidth label="Rule name" value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Description" multiline minRows={3} value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} /></Grid>
            <Grid item xs={12} md={6}><GlassPanel title="Trigger"><TextField select fullWidth label="Trigger type" value={form.trigger_type} onChange={(event) => setForm((previous) => ({ ...previous, trigger_type: event.target.value }))}>{["task.created","task.updated","knowledge.updated","approval.updated","recurring.generated"].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField></GlassPanel></Grid>
            <Grid item xs={12} md={6}><GlassPanel title="Scope"><TextField fullWidth label="Scope JSON" multiline minRows={5} value={form.scope_json} onChange={(event) => setForm((previous) => ({ ...previous, scope_json: event.target.value }))} /></GlassPanel></Grid>
            <Grid item xs={12} md={6}><GlassPanel title="Conditions"><TextField fullWidth label="Condition JSON" multiline minRows={6} value={form.condition_json} onChange={(event) => setForm((previous) => ({ ...previous, condition_json: event.target.value }))} /></GlassPanel></Grid>
            <Grid item xs={12} md={6}><GlassPanel title="Actions"><TextField fullWidth label="Action JSON" multiline minRows={6} value={form.action_json} onChange={(event) => setForm((previous) => ({ ...previous, action_json: event.target.value }))} /></GlassPanel></Grid>
          </Grid>
        </DialogContent>
        <DialogActions><Button onClick={() => setDialogOpen(false)}>Cancel</Button><Button variant="contained" onClick={submit}>Save</Button></DialogActions>
      </Dialog>
    </>
  );
}

export default AutomationPage;
