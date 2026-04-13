import { useEffect, useState } from "react";
import { Button, Grid, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { automationApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../store/AuthContext";

const initialForm = {
  name: "",
  description: "",
  trigger_type: "task.created",
  condition_json: '{"priority":"high"}',
  action_json: '{"type":"notify","audience":"managers","severity":"high"}',
  is_enabled: true,
};

function AutomationPage() {
  const { activeOrganizationId, user } = useAuth();
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(initialForm);

  const load = () => automationApi.list({ organization_id: activeOrganizationId || undefined }).then((response) => setRules(response.data));

  useEffect(() => {
    if (user.role === "SUPER_ADMIN" && !activeOrganizationId) {
      setRules([]);
      return;
    }
    load();
  }, [activeOrganizationId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await automationApi.create({
      ...form,
      organization_id: activeOrganizationId || user.organization_id,
      condition_json: JSON.parse(form.condition_json),
      action_json: JSON.parse(form.action_json),
    });
    setForm(initialForm);
    load();
  };

  return (
    <>
      <PageHeader
        eyebrow="Automation Engine"
        title={user.role === "MANAGER" ? "Team and workflow automations" : "Rules, triggers, and org actions"}
        description="Manage local trigger logic for overdue tasks, manager alerts, knowledge surfacing, and future automation growth."
      />
      <Grid container spacing={2.5}>
        {user.role === "SUPER_ADMIN" && !activeOrganizationId ? (
          <Grid item xs={12}>
            <GlassPanel title="Select an organization" subtitle="Automation management is org-scoped">
              <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.68)" }}>
                Pick an organization from the header to inspect or edit its automation rules.
              </Typography>
            </GlassPanel>
          </Grid>
        ) : null}
        <Grid item xs={12} lg={7}>
          <GlassPanel title="Automation rules" subtitle="Enabled rules actively shape notifications and AI guidance">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Trigger</TableCell>
                  <TableCell>Condition</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Enabled</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>{rule.name}</TableCell>
                    <TableCell>{rule.trigger_type}</TableCell>
                    <TableCell><Typography variant="body2">{rule.condition_json}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{rule.action_json}</Typography></TableCell>
                    <TableCell><Switch checked={rule.is_enabled} onChange={() => automationApi.toggle(rule.id).then(load)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} lg={5}>
          <GlassPanel title="Create automation" subtitle="Organization-scoped IF / THEN rule">
            <Stack component="form" spacing={2} onSubmit={handleSubmit}>
              <TextField label="Rule name" value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} required />
              <TextField label="Description" value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} multiline minRows={3} required />
              <TextField select label="Trigger type" value={form.trigger_type} onChange={(event) => setForm((previous) => ({ ...previous, trigger_type: event.target.value }))}>
                <MenuItem value="task.created">task.created</MenuItem>
                <MenuItem value="task.updated">task.updated</MenuItem>
                <MenuItem value="knowledge.updated">knowledge.updated</MenuItem>
              </TextField>
              <TextField label="Condition JSON" value={form.condition_json} onChange={(event) => setForm((previous) => ({ ...previous, condition_json: event.target.value }))} multiline minRows={3} />
              <TextField label="Action JSON" value={form.action_json} onChange={(event) => setForm((previous) => ({ ...previous, action_json: event.target.value }))} multiline minRows={3} />
              <Button type="submit" variant="contained">Save automation</Button>
            </Stack>
          </GlassPanel>
        </Grid>
      </Grid>
    </>
  );
}

export default AutomationPage;
